import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

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
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isInstructor = !!user.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to add lessons to this module');
    }

    return this.prisma.lesson.create({
      data: {
        ...lessonData,
        moduleId,
      },
    });
  }

  async findAllByModule(moduleId: number) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`);
    }

    return this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
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
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    return lesson;
  }

  async update(id: number, updateLessonDto: UpdateLessonDto, userId: number) {
    const lesson = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isInstructor = !!user.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to update this lesson');
    }

    return this.prisma.lesson.update({
      where: { id },
      data: updateLessonDto,
    });
  }

  async remove(id: number, userId: number) {
    const lesson = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isInstructor = !!user.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to delete this lesson');
    }

    await this.prisma.lesson.delete({
      where: { id },
    });

    return {
      message: 'Lesson deleted successfully',
    };
  }
}
