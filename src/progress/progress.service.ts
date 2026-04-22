import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) { }

 

  async updateProgress(studentUserId: number, dto: import('./dto/update-progress.dto').UpdateProgressDto) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const { lessonId, isCompleted = true } = dto;

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return await this.prisma.lessonProgress.upsert({
      where: {
        studentId_lessonId: {
          studentId: student.id,
          lessonId: lesson.id,
        },
      },
      update: {
        isCompleted: isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      create: {
        studentId: student.id,
        lessonId: lesson.id,
        isCompleted: isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  }

  async getCourseProgress(studentUserId: number, courseId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: {
          courseId: courseId,
        },
      },
    });

    if (lessons.length === 0) return { progress: 0 };

    const completedLessonsCount = await this.prisma.lessonProgress.count({
      where: {
        studentId: student.id,
        lessonId: {
          in: lessons.map((l) => l.id),
        },
        isCompleted: true,
      },
    });

    const progressPercentage = (completedLessonsCount / lessons.length) * 100;

    return {
      courseId,
      totalLessons: lessons.length,
      completedLessons: completedLessonsCount,
      progressPercentage: Math.round(progressPercentage),
    };
  }

  async getLastWatched(studentUserId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const lastProgress = await this.prisma.lessonProgress.findFirst({
      where: { studentId: student.id },
      orderBy: { id: 'desc' },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!lastProgress) {
      return null;
    }

    return {
      courseName: lastProgress.lesson.module.course.title,
      categoryName: lastProgress.lesson.module.title, // الفئة
      lesson: {
        id: lastProgress.lesson.id,
        title: lastProgress.lesson.title,
        description: lastProgress.lesson.description,
        content: lastProgress.lesson.content,
        videoUrl: lastProgress.lesson.videoUrl,
        pdfUrl: lastProgress.lesson.pdfUrl,
        order: lastProgress.lesson.order,
      },
      progress: {
        id: lastProgress.id,
        isCompleted: lastProgress.isCompleted,
        completedAt: lastProgress.completedAt,
      },
    };
  }

  async getLastAccessedModuleProgress(studentUserId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const lastProgress = await this.prisma.lessonProgress.findFirst({
      where: { studentId: student.id },
      orderBy: { id: 'desc' },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!lastProgress) {
      return null;
    }

    const module = lastProgress.lesson.module;

    const lessons = await this.prisma.lesson.findMany({
      where: {
        moduleId: module.id,
      },
      include: {
        lessonProgress: {
          where: { studentId: student.id },
        }
      }
    });

    let totalLessons = lessons.length;
    let completedLessons = 0;

    lessons.forEach(lesson => {
      // @ts-ignore
      const progressList = lesson.lessonProgress;
      if (progressList && progressList.length > 0 && progressList[0].isCompleted) {
        completedLessons++;
      }
    });

    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      moduleId: module.id,
      courseName: module.course.title,
      courseImage: module.course.thumbnail,
      moduleName: module.title,
      moduleDescription: module.description,
      totalLessons,
      completedLessons,
      progressPercentage,
    };
  }
}
