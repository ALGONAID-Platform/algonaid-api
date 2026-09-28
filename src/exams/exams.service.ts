import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, ExamType, LessonStatus, Role } from '@prisma/client';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { CreateExamDto, CreateQuestionDto, CreateOptionDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // Helper: بناء بيانات الأسئلة
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
      if (!isInstructor && !isOwner)
        throw new ForbiddenException('You are not authorized to manage this exam');
    } else if (exam.course) {
      const isInstructor =
        user?.teacherProfile &&
        exam.course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner)
        throw new ForbiddenException('You are not authorized to manage this exam');
    }

    return exam;
  }

  // =============================================
  // Helper: التحقق من أن الطالب يمكنه بدء الاختبار
  // =============================================
  private async resolveStudentAndCheckAttempts(
    studentUserId: number,
    examId: number,
  ): Promise<{ student: any; shouldBeRanked: boolean }> {
    let student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      student = await this.prisma.student
        .create({ data: { userId: studentUserId, academicId: `STU-${Date.now()}-${studentUserId}` } })
        .catch(() => null);
      if (!student) throw new NotFoundException('Student profile not found');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { maxAttempts: true, examType: true, endTime: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const allAttempts = await this.prisma.examAttempt.findMany({
      where: { examId, studentId: student.id },
      orderBy: { startedAt: 'desc' },
    });

    const completedAttempts = allAttempts.filter(
      (a) => a.status !== ExamStatus.IN_PROGRESS,
    );

    // التحقق من عدد المحاولات المسموح بها (إلا بعد انتهاء التحدي)
    const now = new Date();
    const challengeEnded =
      exam.examType === ExamType.CHALLENGE && exam.endTime && exam.endTime < now;

    if (!challengeEnded && completedAttempts.length >= exam.maxAttempts) {
      throw new ForbiddenException('لقد استنفدت جميع محاولاتك المسموح بها');
    }

    // هل هذه المحاولة ستكون مُصنَّفة؟
    const hasRankedAttempt = allAttempts.some((a) => a.isRanked);
    const shouldBeRanked =
      !hasRankedAttempt &&
      (!challengeEnded); // إذا انتهى التحدي → لا تصنيف

    return { student, shouldBeRanked };
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
          questions: { select: { id: true } },
          _count: { select: { attempts: true } },
        },
      });
    }
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
        questions: { select: { id: true } },
        _count: { select: { attempts: true } },
      },
    });
  }

  // =============================================
  // إنشاء اختبار (درس أو كورس أو تحدي)
  // =============================================
  async createExam(userId: number, role: Role, dto: CreateExamDto) {
    const { lessonId, courseId, questions, startTime, endTime, ...examData } = dto;

    if (!lessonId && !courseId) {
      throw new BadRequestException('يجب تحديد lessonId أو courseId');
    }
    if (lessonId && courseId) {
      throw new BadRequestException('لا يمكن ربط الاختبار بدرس وكورس في نفس الوقت');
    }
    if (dto.examType === ExamType.CHALLENGE && (!startTime || !endTime)) {
      throw new BadRequestException('التحدي يتطلب تحديد startTime و endTime');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });
    const isOwner = role === Role.OWNER;

    const questionData = this.buildQuestionsData(questions);
    const extraData = {
      ...examData,
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime && { endTime: new Date(endTime) }),
    };

    // --- اختبار درس ---
    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { include: { course: true } } },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');

      const isInstructor =
        user?.teacherProfile &&
        lesson.module.course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner)
        throw new ForbiddenException('لا تملك صلاحية إضافة اختبار لهذا الدرس');

      const existing = await this.prisma.exam.findUnique({ where: { lessonId } });
      if (existing) throw new BadRequestException('يوجد اختبار لهذا الدرس بالفعل');

      return this.prisma.exam.create({
        data: { ...extraData, lessonId, questions: { create: questionData } },
        include: { questions: { include: { options: true } } },
      });
    }

    // --- اختبار كورس ---
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const isInstructor =
      user?.teacherProfile && course.instructorId === user.teacherProfile.id;
    if (!isInstructor && !isOwner)
      throw new ForbiddenException('لا تملك صلاحية إضافة اختبار لهذا الكورس');

    const existing = await this.prisma.exam.findUnique({ where: { courseId } });
    if (existing) throw new BadRequestException('يوجد اختبار لهذا الكورس بالفعل');

    return this.prisma.exam.create({
      data: { ...extraData, courseId, questions: { create: questionData } },
      include: { course: true, questions: { include: { options: true } } },
    });
  }

  // =============================================
  // تحديث اختبار
  // =============================================
  async updateExam(userId: number, role: Role, examId: number, dto: UpdateExamDto) {
    await this.checkExamPermission(userId, role, examId);
    const { questions, ...metadata } = dto;

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
  // جلب اختبار بالـ ID
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
        _count: { select: { attempts: true } },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.lesson?.status === LessonStatus.DRAFT) {
      if (!userId) throw new NotFoundException('Exam not found');
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.OWNER && user?.role !== Role.ADMIN)
        throw new NotFoundException('Exam not found');
    }

    return exam;
  }

  // =============================================
  // جلب اختبار الكورس بالـ courseId
  // =============================================
  async getExamByCourse(courseId: number) {
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
        _count: { select: { attempts: true } },
      },
    });
    if (!exam) throw new NotFoundException('No exam found for this course');
    return exam;
  }

  // =============================================
  // بدء محاولة الاختبار
  // =============================================
  async startExam(studentUserId: number, examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { lesson: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // التحقق من حالة الدرس إذا كان اختبار درس
    if (exam.lesson?.status === LessonStatus.DRAFT) {
      throw new NotFoundException('Exam not found');
    }

    // التحقق من نافذة وقت التحدي
    const now = new Date();
    if (exam.examType === ExamType.CHALLENGE && exam.startTime && exam.startTime > now) {
      throw new ForbiddenException(
        `التحدي لم يبدأ بعد. يبدأ في: ${exam.startTime.toISOString()}`,
      );
    }

    const { student, shouldBeRanked } =
      await this.resolveStudentAndCheckAttempts(studentUserId, examId);

    const attempt = await this.prisma.examAttempt.create({
      data: {
        studentId: student.id,
        examId: exam.id,
        status: ExamStatus.IN_PROGRESS,
        isRanked: shouldBeRanked,
      },
    });

    const questions = await this.prisma.question.findMany({
      where: { examId },
      select: {
        id: true,
        text: true,
        type: true,
        imageUrl: true,
        points: true,
        options: { select: { id: true, text: true } },
      },
    });

    return {
      message: 'Exam started successfully',
      attemptId: attempt.id,
      isRanked: shouldBeRanked,
      timeLimitMinutes: exam.timeLimit,
      startedAt: attempt.startedAt,
      questions,
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
      include: {
        exam: { include: { questions: { include: { options: true } } } },
      },
    });

    if (!attempt || attempt.studentId !== student?.id) {
      throw new NotFoundException('Exam attempt not found');
    }
    if (attempt.status !== ExamStatus.IN_PROGRESS) {
      throw new BadRequestException('Exam already submitted');
    }

    // حساب الوقت المستغرق بالميلي ثانية
    const now = new Date();
    const timeTakenMs = now.getTime() - attempt.startedAt.getTime();

    // التحقق من تجاوز الوقت المحدد
    if (attempt.exam.timeLimit) {
      const limitMs = attempt.exam.timeLimit * 60 * 1000;
      if (timeTakenMs > limitMs + 30000) { // هامش 30 ثانية
        // تسليم تلقائي بدرجة صفر
        return this.prisma.examAttempt.update({
          where: { id: attempt.id },
          data: { score: 0, status: ExamStatus.FAILED, completedAt: now, timeTaken: timeTakenMs },
          include: { exam: true },
        });
      }
    }

    // حساب الدرجة
    let score = 0;
    let totalPoints = 0;
    const userAnswersData: Array<{ questionId: number; selectedOptionId: number; attemptId: number }> = [];

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

    const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    let status: ExamStatus = ExamStatus.FAILED;
    if (percentage >= attempt.exam.passingScore) {
      status = ExamStatus.PASSED;
    } else if (percentage >= attempt.exam.passingScore - 10) {
      status = ExamStatus.IMPROVEMENT_NEEDED;
    }

    await this.prisma.userAnswer.createMany({ data: userAnswersData });

    // تحديث تقدم الدرس إذا نجح في اختبار درس
    if (status === ExamStatus.PASSED && attempt.exam.lessonId) {
      await this.prisma.lessonProgress.upsert({
        where: {
          studentId_lessonId: { studentId: student.id, lessonId: attempt.exam.lessonId },
        },
        update: { isCompleted: true, completedAt: now },
        create: { studentId: student.id, lessonId: attempt.exam.lessonId, isCompleted: true, completedAt: now },
      });
    }

    return this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { score, status, completedAt: now, timeTaken: timeTakenMs },
      include: { exam: { select: { title: true, passingScore: true } } },
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
