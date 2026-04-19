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
}
