import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, LessonStatus, Role } from '@prisma/client';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { CreateExamDto, CreateQuestionDto, CreateOptionDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // Helper: التحقق من صلاحية إدارة الاختبار
  // =============================================
  private async checkExamPermission(userId: number, role: Role, examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        lesson: { include: { module: { include: { course: true } } } },
        course: true,
      },
    });

    if (!exam) throw new NotFoundException('Exam not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });

    const isOwner = role === Role.OWNER;

    if (exam.lesson) {
      const isInstructor =
        user?.teacherProfile &&
        exam.lesson.module.course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner) {
        throw new ForbiddenException('You are not authorized to manage this exam');
      }
    } else if (exam.course) {
      const isInstructor =
        user?.teacherProfile &&
        exam.course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner) {
        throw new ForbiddenException('You are not authorized to manage this exam');
      }
    }

    return exam;
  }

  // =============================================
  // Helper: بناء بيانات الأسئلة عند الإنشاء
  // =============================================
  private buildQuestionsData(questions: CreateQuestionDto[]) {
    return questions.map((q: CreateQuestionDto) => ({
      text: q.text,
      type: q.type,
      points: q.points,
      imageUrl: q.imageUrl,
      options: {
        create: q.options.map((o: CreateOptionDto) => ({
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      },
    }));
  }

  // =============================================
  // جلب جميع الاختبارات
  // =============================================
  async findAll(userId: number, role: Role) {
    if (role === Role.ADMIN || role === Role.OWNER) {
      return this.prisma.exam.findMany({
        include: {
          lesson: { include: { module: { include: { course: true } } } },
          course: true,
          questions: true,
        },
      });
    } else {
      return this.prisma.exam.findMany({
        where: {
          OR: [
            { lesson: { status: LessonStatus.PUBLISHED } },
            { courseId: { not: null } },
          ],
        },
        include: {
          lesson: { include: { module: { include: { course: true } } } },
          course: true,
          questions: true,
        },
      });
    }
  }

  // =============================================
  // إنشاء اختبار (درس أو كورس)
  // =============================================
  async createExam(userId: number, role: Role, createExamDto: CreateExamDto) {
    const { lessonId, courseId, questions, ...examData } = createExamDto;

    // التحقق من وجود lessonId أو courseId على الأقل
    if (!lessonId && !courseId) {
      throw new BadRequestException('يجب تحديد lessonId أو courseId لإنشاء الاختبار');
    }
    if (lessonId && courseId) {
      throw new BadRequestException('لا يمكن ربط الاختبار بدرس وكورس في نفس الوقت');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });
    const isOwner = role === Role.OWNER;

    // --- اختبار على مستوى درس ---
    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { include: { course: true } } },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');

      const isInstructor =
        user?.teacherProfile &&
        lesson.module.course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner) {
        throw new ForbiddenException('You are not authorized to add an exam to this lesson');
      }

      const existingExam = await this.prisma.exam.findUnique({ where: { lessonId } });
      if (existingExam) throw new BadRequestException('Exam already exists for this lesson');

      return this.prisma.exam.create({
        data: {
          ...examData,
          lessonId,
          questions: { create: this.buildQuestionsData(questions) },
        },
        include: { questions: { include: { options: true } } },
      });
    }

    // --- اختبار على مستوى كورس ---
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const isInstructor =
      user?.teacherProfile && course.instructorId === user.teacherProfile.id;
    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to add an exam to this course');
    }

    const existingExam = await this.prisma.exam.findUnique({ where: { courseId } });
    if (existingExam) throw new BadRequestException('Exam already exists for this course');

    return this.prisma.exam.create({
      data: {
        ...examData,
        courseId,
        questions: { create: this.buildQuestionsData(questions) },
      },
      include: { course: true, questions: { include: { options: true } } },
    });
  }

  // =============================================
  // تحديث اختبار
  // =============================================
  async updateExam(userId: number, role: Role, examId: number, updateExamDto: UpdateExamDto) {
    await this.checkExamPermission(userId, role, examId);

    const { questions, ...metadata } = updateExamDto;

    return this.prisma.$transaction(async (tx) => {
      if (questions) {
        await tx.question.deleteMany({ where: { examId } });
        await tx.exam.update({
          where: { id: examId },
          data: {
            ...metadata,
            questions: { create: this.buildQuestionsData(questions) },
          },
        });
      } else {
        await tx.exam.update({ where: { id: examId }, data: metadata });
      }

      return tx.exam.findUnique({
        where: { id: examId },
        include: { questions: { include: { options: true } }, course: true },
      });
    });
  }

  // =============================================
  // حذف اختبار
  // =============================================
  async deleteExam(userId: number, role: Role, examId: number) {
    await this.checkExamPermission(userId, role, examId);
    await this.prisma.exam.delete({ where: { id: examId } });
    return { message: 'Exam deleted successfully' };
  }

  // =============================================
  // جلب اختبار معين بالـ ID
  // =============================================
  async getExam(examId: number, userId?: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        lesson: true,
        course: true,
        questions: {
          select: {
            id: true,
            text: true,
            type: true,
            points: true,
            imageUrl: true,
            options: { select: { id: true, text: true } },
          },
        },
      },
    });

    if (!exam) throw new NotFoundException('Exam not found');

    // اختبار الدرس: نتحقق من حالة الدرس
    if (exam.lesson && exam.lesson.status === LessonStatus.DRAFT) {
      if (!userId) throw new NotFoundException('Exam not found');
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.OWNER && user?.role !== Role.ADMIN) {
        throw new NotFoundException('Exam not found');
      }
    }

    return exam;
  }

  // =============================================
  // جلب اختبار الكورس بالـ courseId
  // =============================================
  async getExamByCourse(courseId: number, userId?: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { courseId },
      include: {
        course: true,
        questions: {
          select: {
            id: true,
            text: true,
            type: true,
            points: true,
            imageUrl: true,
            options: { select: { id: true, text: true } },
          },
        },
      },
    });

    if (!exam) throw new NotFoundException('No exam found for this course');

    return exam;
  }

  // =============================================
  // بدء محاولة الاختبار
  // =============================================
  async startExam(studentUserId: number, examId: number) {
    let student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });

    if (!student) {
      student = await this.prisma.student
        .create({ data: { userId: studentUserId, academicId: `STU-${Date.now()}-${studentUserId}` } })
        .catch(() => null);
      if (!student) throw new NotFoundException('Student profile not found');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        lesson: true,
        _count: { select: { attempts: { where: { studentId: student.id } } } },
      },
    });

    if (!exam) throw new NotFoundException('Exam not found');

    // إذا كان اختبار درس، نتحقق من حالة الدرس
    if (exam.lesson && exam.lesson.status === LessonStatus.DRAFT) {
      throw new NotFoundException('Exam not found');
    }

    if (exam._count.attempts >= exam.maxAttempts) {
      throw new ForbiddenException('Maximum attempts reached for this exam');
    }

    const attempt = await this.prisma.examAttempt.create({
      data: { studentId: student.id, examId: exam.id, status: ExamStatus.IN_PROGRESS },
    });

    return {
      message: 'Exam started successfully',
      attemptId: attempt.id,
      questions: await this.prisma.question.findMany({
        where: { examId },
        select: {
          id: true,
          text: true,
          type: true,
          imageUrl: true,
          options: { select: { id: true, text: true } },
        },
      }),
    };
  }

  // =============================================
  // تسليم الاختبار
  // =============================================
  async submitExam(studentUserId: number, attemptId: number, submission: SubmitExamDto) {
    let student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      student = await this.prisma.student
        .create({ data: { userId: studentUserId, academicId: `STU-${Date.now()}-${studentUserId}` } })
        .catch(() => null);
    }

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { include: { questions: { include: { options: true } } } } },
    });

    if (!attempt || attempt.studentId !== student?.id) {
      throw new NotFoundException('Exam attempt not found');
    }

    if (attempt.status !== ExamStatus.IN_PROGRESS) {
      throw new BadRequestException('Exam already submitted');
    }

    let score = 0;
    let totalPoints = 0;
    const userAnswersData = [];

    for (const question of attempt.exam.questions) {
      totalPoints += question.points;
      const userAnswer = submission.answers.find((a) => a.questionId === question.id);
      const selectedOption = question.options.find((o) => o.id === userAnswer?.selectedOptionId);

      if (selectedOption?.isCorrect) score += question.points;

      if (userAnswer) {
        userAnswersData.push({
          questionId: question.id,
          selectedOptionId: userAnswer.selectedOptionId,
          attemptId: attempt.id,
        });
      }
    }

    const percentage = (score / totalPoints) * 100;
    let status: ExamStatus = ExamStatus.FAILED;
    if (percentage >= attempt.exam.passingScore) {
      status = ExamStatus.PASSED;
    } else if (percentage >= attempt.exam.passingScore - 10) {
      status = ExamStatus.IMPROVEMENT_NEEDED;
    }

    await this.prisma.userAnswer.createMany({ data: userAnswersData });

    // إذا نجح واختبار كان على مستوى درس، نحدّث تقدم الدرس
    if (status === ExamStatus.PASSED && attempt.exam.lessonId) {
      await this.prisma.lessonProgress.upsert({
        where: {
          studentId_lessonId: { studentId: student.id, lessonId: attempt.exam.lessonId },
        },
        update: { isCompleted: true, completedAt: new Date() },
        create: {
          studentId: student.id,
          lessonId: attempt.exam.lessonId,
          isCompleted: true,
          completedAt: new Date(),
        },
      });
    }

    return await this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { score, status, completedAt: new Date() },
      include: { exam: true },
    });
  }

  // =============================================
  // جلب نتيجة المحاولة
  // =============================================
  async getResult(studentUserId: number, attemptId: number) {
    let student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      student = await this.prisma.student
        .create({ data: { userId: studentUserId, academicId: `STU-${Date.now()}-${studentUserId}` } })
        .catch(() => null);
    }

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        answers: {
          include: {
            question: { include: { options: true } },
            selectedOption: true,
          },
        },
      },
    });

    if (!attempt || attempt.studentId !== student?.id) {
      throw new NotFoundException('Exam result not found');
    }

    return attempt;
  }
}
