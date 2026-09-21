import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { MESSAGES } from 'src/utils/messages';
import { LessonStatus, Role } from '@prisma/client';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createLessonDto: CreateLessonDto, userId: number) {
    const { moduleId, ...lessonData } = createLessonDto;

    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: {
          include: { teacher: true }
        }
      }
    });

    if (!module) {
      throw new NotFoundException(MESSAGES.MODULES.MODULE_NOT_FOUND(moduleId));
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_ADD);
    }

    return this.prisma.lesson.create({
      data: {
        ...lessonData,
        moduleId,
      }, 
    });
  }

  async findAllByModule(moduleId: number, page: number = 1, limit: number = 8, userId?: number) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(MESSAGES.MODULES.MODULE_NOT_FOUND(moduleId));
    }

    let studentId: number | undefined;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true }
      });
      studentId = user?.studentProfile?.id;
    }

    const skip = (page - 1) * limit;

    const [lessons, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { 
          moduleId,
          status: LessonStatus.PUBLISHED,
        },
        include: {
          lessonProgress: studentId ? {
            where: { studentId },
          } : false,
          exam: {
            select: { id: true }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy: { order: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.lesson.count({
        where: { 
          moduleId,
          status: LessonStatus.PUBLISHED,
        }
      })
    ]);

    const mappedLessons = lessons.map(lesson => {
      const { exam, _count, ...rest } = lesson;
      return {
        ...rest,
        commentsCount: _count.comments,
        hasTest: !!exam,
      };
    });

    return {
      data: mappedLessons,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async findOne(id: number, userId?: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        exam: true,
        module: {
          include: {
            course: {
              include: { teacher: true }
            }
          }
        }
      }
    });

    if (!lesson) {
      throw new NotFoundException(MESSAGES.LESSONS.LESSON_NOT_FOUND(id));
    }

    if (lesson.status === LessonStatus.DRAFT) {
      if (!userId) {
        throw new ForbiddenException(MESSAGES.LESSONS.LESSON_NOT_FOUND(id));
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { teacherProfile: true }
      });
      const isInstructor = user?.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
      const isOwner = user?.role === Role.OWNER;

      if (!isInstructor && !isOwner) {
        throw new ForbiddenException(MESSAGES.LESSONS.LESSON_NOT_FOUND(id));
      }
    }

    const latestComments = await this.prisma.comment.findMany({
      where: {
        lessonId: id,
        parentId: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true,
          }
        },
      }
    });

    const commentsCount = await this.prisma.comment.count({
      where: {
        lessonId: id,
      }
    });

    return {
      ...lesson,
      courseId: lesson.module.course.id,
      commentsCount,
      latestComments: latestComments,
    };
  }

  async update(id: number, updateLessonDto: UpdateLessonDto, userId: number) {
    const lesson = await this.findOne(id, userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_UPDATE);
    }

    const { moduleId, ...data } = updateLessonDto;

    return this.prisma.lesson.update({
      where: { id },
      data: {
        ...data,
        ...(moduleId && { moduleId }),
      },
    });
  }

  async remove(id: number, userId: number) {
    const lesson = await this.findOne(id, userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_DELETE);
    }

    await this.prisma.lesson.delete({
      where: { id },
    });

    return {
      message: MESSAGES.LESSONS.LESSON_DELETED,
    };
  }
}
