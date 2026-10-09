import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MESSAGES } from 'src/utils/messages';
import { LessonStatus, Role } from '@prisma/client';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createModuleDto: CreateModuleDto, userId: number) {
    const { courseId, title, description, imageUrl } = createModuleDto;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { teacher: true }
    });

    if (!course) {
      throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND(courseId));
    }

    // Check if the user is the instructor of the course or an OWNER
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.MODULES.UNAUTHORIZED_ADD);
    }

    return this.prisma.module.create({
      data: {
        title,
        description,
        courseId,
        imageUrl,
      },
    });
  }

  async findAll(userId?: number) {
    let studentId: number | undefined;
    let isOwner = false;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true }
      });
      studentId = user?.studentProfile?.id;
      isOwner = user?.role === Role.OWNER;
    }

    const modules = await this.prisma.module.findMany({
      include: {
        lessons: {
          where: {
            ...(!isOwner && { status: LessonStatus.PUBLISHED })
          },
          include: {
            exam: { select: { id: true } },
            lessonProgress: studentId ? {
              where: { studentId },
            } : false,
            _count: { select: { comments: true } }
          }
        },
        _count: {
          select: { 
            lessons: {
              where: { status: LessonStatus.PUBLISHED }
            }
          }
        }
      }
    });

    return modules.map((mod) => {
      const { lessons, _count, ...rest } = mod;

      let totalLessons = _count.lessons;
      let completedLessons = 0;

      const mappedLessons = lessons.map(lesson => {
        // @ts-ignore
        const { _count: lessonCount, ...lessonRest } = lesson;
        return {
          ...lessonRest,
          commentsCount: lessonCount?.comments || 0,
        };
      });

      if (studentId) {
        mappedLessons.forEach(lesson => {
          // @ts-ignore
          const progress = lesson.lessonProgress;
          if (progress && progress.length > 0 && progress[0].isCompleted) {
            completedLessons++;
          }
        });
      }

      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return {
        ...rest,
        totalLessons,
        completedLessons,
        progressPercentage: studentId ? progressPercentage : undefined,
      };
    });
  }

  async findByCourse(courseId: number, userId?: number) {
    let studentId: number | undefined;
    let isOwner = false;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true }
      });
      studentId = user?.studentProfile?.id;
      isOwner = user?.role === Role.OWNER;
    }

    const modules = await this.prisma.module.findMany({
      where: { courseId },
      include: {
        lessons: {
          where: {
            ...(!isOwner && { status: LessonStatus.PUBLISHED })
          },
          include: {
            exam: { select: { id: true } },
            lessonProgress: studentId ? {
              where: { studentId },
            } : false,
            _count: { select: { comments: true } }
          }
        },
        _count: {
          select: { 
            lessons: {
              where: { status: LessonStatus.PUBLISHED }
            }
          }
        }
      }
    });

    return modules.map((mod) => {
      const { lessons, _count, ...rest } = mod;

      let totalLessons = _count.lessons;
      let completedLessons = 0;

      const mappedLessons = lessons.map(lesson => {
        // @ts-ignore
        const { _count: lessonCount, ...lessonRest } = lesson;
        return {
          ...lessonRest,
          commentsCount: lessonCount?.comments || 0,
        };
      });

      if (studentId) {
        mappedLessons.forEach(lesson => {
          // @ts-ignore
          const progress = lesson.lessonProgress;
          if (progress && progress.length > 0 && progress[0].isCompleted) {
            completedLessons++;
          }
        });
      }

      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return {
        ...rest,
        totalLessons,
        completedLessons,
        progressPercentage: studentId ? progressPercentage : undefined,
      };
    });
  }

  async findOne(id: number, userId?: number) {
    let isOwner = false;
    let isStudent = false;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      isOwner = user?.role === Role.OWNER || user?.role === Role.STUDENT;
      isStudent = user?.role === Role.STUDENT;
    }

    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        lessons: {
          where: {
            ...((!isOwner || isStudent) && { status: LessonStatus.PUBLISHED })
          },
          include: {
            exam: { select: { id: true } }
          }
        },
        course: {
          include: {
            teacher: true
          }
        }
      },
    });

    if (!module) {
      throw new NotFoundException(MESSAGES.MODULES.MODULE_NOT_FOUND(id));
    }

    return module;
  }

  async update(id: number, updateModuleDto: UpdateModuleDto, userId: number) {
    const module = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.MODULES.UNAUTHORIZED_UPDATE);
    }

    return this.prisma.module.update({
      where: { id },
      data: updateModuleDto,
    });
  }

  async remove(id: number, userId: number) {
    const module = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.MODULES.UNAUTHORIZED_DELETE);
    }

    await this.prisma.module.delete({
      where: { id },
    });

    return {
      message: MESSAGES.MODULES.MODULE_DELETED,
    };
  }
}
