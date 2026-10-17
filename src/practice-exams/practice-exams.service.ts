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
      const isOwnerRole = user?.role === Role.OWNER;

      if (!isInstructor && !isOwnerRole) {
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

  private async checkCourseAccess(
    course: { id: number; isPaid: boolean; instructorId: number },
    userId?: number,
  ): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, teacherProfile: true },
    });
    if (!user) return false;
    if (user.role === Role.ADMIN || user.role === Role.OWNER) {
      return true;
    }
    if (user.teacherProfile && user.teacherProfile.id === course.instructorId) {
      return true;
    }
    if (user.studentProfile) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: user.studentProfile.id,
            courseId: course.id,
          },
        },
      });
      if (enrollment && enrollment.status === 'ACTIVE') return true;
    }
    return false;
  }

  private async isUserStaff(userId?: number): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user?.role === Role.ADMIN || user?.role === Role.OWNER;
  }

  async findAll(courseId?: number, userId?: number) {
    if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, isPaid: true, instructorId: true },
      });

      if (!course) {
        throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND(courseId));
      }

      if (course.isPaid) {
        const hasAccess = await this.checkCourseAccess(course, userId);
        if (!hasAccess) {
          throw new ForbiddenException('نماذج ومراجع هذه الدورة متاحة فقط للمشتركين والمسجلين فيها');
        }
      }

      return this.prisma.practiceExam.findMany({
        where: { courseId },
        select: practiceExamSelectFields,
      });
    }

    const isStaff = await this.isUserStaff(userId);
    if (isStaff) {
      return this.prisma.practiceExam.findMany({
        select: practiceExamSelectFields,
      });
    }

    let enrolledCourseIds: number[] = [];
    if (userId) {
      const student = await this.prisma.student.findUnique({ where: { userId } });
      if (student) {
        const enrollments = await this.prisma.enrollment.findMany({
          where: { studentId: student.id, status: 'ACTIVE' },
          select: { courseId: true },
        });
        enrolledCourseIds = enrollments.map((e) => e.courseId);
      }
    }

    return this.prisma.practiceExam.findMany({
      where: {
        OR: [
          { course: { isPaid: false } },
          { courseId: { in: enrolledCourseIds } },
        ],
      },
      select: practiceExamSelectFields,
    });
  }

  async findOne(id: number, userId?: number) {
    const exam = await this.prisma.practiceExam.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, isPaid: true, instructorId: true },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(MESSAGES.PRACTICE_EXAMS.NOT_FOUND(id));
    }

    if (exam.course && exam.course.isPaid) {
      const hasAccess = await this.checkCourseAccess(exam.course, userId);
      if (!hasAccess) {
        throw new ForbiddenException('نماذج ومراجع هذه الدورة متاحة فقط للمشتركين والمسجلين فيها');
      }
    }

    const { course, ...rest } = exam;
    return rest;
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
    const isOwnerRole = user?.role === Role.OWNER;

    if (!isOwner && !isOwnerRole) {
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
    const isOwnerRole = user?.role === Role.OWNER;

    if (!isOwner && !isOwnerRole) {
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
