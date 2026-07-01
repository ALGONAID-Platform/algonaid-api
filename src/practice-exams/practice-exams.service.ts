import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreatePracticeExamDto } from './dto/create-practice-exam.dto';
import { UpdatePracticeExamDto } from './dto/update-practice-exam.dto';
import { MESSAGES } from 'src/utils/messages';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
const practiceExamSelectFields = {
  id: true,
  title: true,
  description: true,
  pdfUrl: true,
  grade: true,
  courseId: true,
  createdAt: true,
};

@Injectable()
export class PracticeExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPracticeExamDto: CreatePracticeExamDto, userId: number) {
    const { courseId, ...examData } = createPracticeExamDto;

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new NotFoundException(MESSAGES.COURSES.TEACHER_PROFILE_NOT_FOUND);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND(courseId));
      }

      const isInstructor = course.instructorId === teacher.id;
      const isOwnerOrAdmin = user?.role === Role.OWNER || user?.role === Role.ADMIN;

      if (!isInstructor && !isOwnerOrAdmin) {
        throw new ForbiddenException(MESSAGES.PRACTICE_EXAMS.UNAUTHORIZED_ADD);
      }
    }

    return this.prisma.practiceExam.create({
      data: {
        ...examData,
        courseId,
        teacherId: teacher.id,
      },
      select: practiceExamSelectFields,
    }); 
  }

  async findAll(courseId?: number) {
    if (courseId) {
      return this.prisma.practiceExam.findMany({
        where: { courseId },
        select: practiceExamSelectFields,
      });
    }

    return this.prisma.practiceExam.findMany({
      select: practiceExamSelectFields,
    });
  }

  async findOne(id: number) {
    const exam = await this.prisma.practiceExam.findUnique({
      where: { id },
      select: practiceExamSelectFields,
    });

    if (!exam) {
      throw new NotFoundException(MESSAGES.PRACTICE_EXAMS.NOT_FOUND(id));
    }

    return exam;
  }

  async update(id: number, updatePracticeExamDto: UpdatePracticeExamDto, userId: number) {
    const exam = await this.prisma.practiceExam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundException(MESSAGES.PRACTICE_EXAMS.NOT_FOUND(id));
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new NotFoundException(MESSAGES.COURSES.TEACHER_PROFILE_NOT_FOUND);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isOwner = exam.teacherId === teacher.id;
    const isOwnerOrAdmin = user?.role === Role.OWNER || user?.role === Role.ADMIN;

    if (!isOwner && !isOwnerOrAdmin) {
      throw new ForbiddenException(MESSAGES.PRACTICE_EXAMS.UNAUTHORIZED_UPDATE);
    }

    const { courseId, ...updateData } = updatePracticeExamDto;

    if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND(courseId));
      }
    }

    return this.prisma.practiceExam.update({
      where: { id },
      data: {
        ...updateData,
        ...(courseId && { courseId }),
      },
      select: practiceExamSelectFields,
    });
  }

  async remove(id: number, userId: number) {
    const exam = await this.prisma.practiceExam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundException(MESSAGES.PRACTICE_EXAMS.NOT_FOUND(id));
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new NotFoundException(MESSAGES.COURSES.TEACHER_PROFILE_NOT_FOUND);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isOwner = exam.teacherId === teacher.id;
    const isOwnerOrAdmin = user?.role === Role.OWNER || user?.role === Role.ADMIN;

    if (!isOwner && !isOwnerOrAdmin) {
      throw new ForbiddenException(MESSAGES.PRACTICE_EXAMS.UNAUTHORIZED_DELETE);
    }

    await this.prisma.practiceExam.delete({
      where: { id },
    });

    return {
      message: MESSAGES.PRACTICE_EXAMS.DELETED,
    };
  }
}
