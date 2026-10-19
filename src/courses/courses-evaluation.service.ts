import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';

export interface CreateReviewDto {
  rating: number;
  comment?: string;
}

@Injectable()
export class CoursesEvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * جلب بطاقة أداء وتقييم الطالب في الدورة ومساره اليومي
   */
  async getMyEvaluation(courseId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user?.studentProfile) {
      throw new ForbiddenException('حساب الطالب غير موجود');
    }

    const studentId = user.studentProfile.id;

    // التحقق من اشتراك الطالب في الدورة
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenException('أنت غير مسجل في هذه الدورة');
    }

    // جلب الدورة مع الموديولات والدروس والتكاليف والاختبارات
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: {
          include: {
            user: {
              select: { name: true, avatar: true },
            },
          },
        },
        modules: {
          orderBy: { id: 'asc' },
          include: {
            lessons: {
              where: { status: 'PUBLISHED' },
              orderBy: [
                { dayNumber: 'asc' },
                { order: 'asc' },
                { id: 'asc' },
              ],
              include: {
                lessonProgress: {
                  where: { studentId },
                },
                assignment: {
                  include: {
                    submissions: {
                      where: { studentId },
                    },
                  },
                },
                exam: {
                  include: {
                    questions: {
                      select: { points: true },
                    },
                    attempts: {
                      where: { studentId },
                      orderBy: { score: 'desc' },
                    },
                  },
                },
              },
            },
          },
        },
        certificates: {
          where: { studentId },
        },
        exams: {
          include: {
            questions: {
              select: { points: true },
            },
            attempts: {
              where: { studentId },
              orderBy: { score: 'desc' },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('الدورة غير موجودة');
    }

    // تجميع كافة الدروس في قائمة مسطحة
    const allLessons = course.modules.flatMap((m) => m.lessons);

    // الدروس الإلزامية فقط هي التي تحتسب في الحضور والتقييم والشهادة
    const mandatoryLessons = allLessons.filter((l) => l.isMandatory !== false);
    const hasOnlyOptionalLessons = allLessons.length > 0 && mandatoryLessons.length === 0;

    const totalLessons = mandatoryLessons.length;
    const completedLessons = mandatoryLessons.filter((l) =>
      l.lessonProgress.some((p) => p.isCompleted),
    ).length;

    // نسبة الحضور ومشاهدة الدروس (محسوبة على الدروس الإلزامية فقط)
    const attendancePercentage =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : (hasOnlyOptionalLessons ? 100 : 0);

    // إحصائيات التكاليف والواجبات
    const assignments = allLessons
      .map((l) => l.assignment)
      .filter((a): a is NonNullable<typeof a> => !!a);
    const totalAssignments = assignments.length;
    const submittedAssignments = assignments.filter(
      (a) => a.submissions && a.submissions.length > 0,
    ).length;
    const assignmentsSubmissionPercentage =
      totalAssignments > 0
        ? Math.round((submittedAssignments / totalAssignments) * 100)
        : 0;

    const gradedSubmissions = assignments
      .map((a) => a.submissions?.[0])
      .filter(
        (s): s is NonNullable<typeof s> =>
          !!s && s.status === 'GRADED' && s.score !== null,
      );

    const assignmentsAverageScore =
      gradedSubmissions.length > 0
        ? Math.round(
            gradedSubmissions.reduce(
              (acc, curr) => acc + (curr.score || 0),
              0,
            ) / gradedSubmissions.length,
          )
        : 0;

    // إحصائيات الاختبارات
    const exams = allLessons
      .map((l) => l.exam)
      .filter((e): e is NonNullable<typeof e> => !!e);
    const totalExams = exams.length;
    const passedExams = exams.filter((e) =>
      e.attempts.some((att) => att.status === 'PASSED'),
    ).length;

    const examAttempts = exams
      .map((e) => e.attempts?.[0])
      .filter((att): att is NonNullable<typeof att> => !!att);

    const quizzesAverageScore =
      examAttempts.length > 0
        ? Math.round(
            examAttempts.reduce((acc, curr) => acc + curr.score, 0) /
              examAttempts.length,
          )
        : 0;

    // البحث عن الاختبار النهائي الخاص بالدورة
    const courseLevelExams = course.exams || [];
    const finalExam =
      courseLevelExams.find(
        (e) =>
          e.examType === 'FINAL_EXAM' ||
          (e.lessonId === null &&
            (e.examType === 'COURSE_QUIZ' ||
              e.title.toLowerCase().includes('نهائي') ||
              e.title.toLowerCase().includes('final'))),
      ) || null;

    let finalExamData: any = null;
    let finalExamScore: number | null = null;
    let totalExamPoints = 0;

    if (finalExam) {
      totalExamPoints = (finalExam.questions || []).reduce(
        (sum, q) => sum + (q.points || 0),
        0,
      );
      const allFinalAttempts = finalExam.attempts || [];
      const completedFinalAttempts = allFinalAttempts.filter(
        (a) => a.status !== 'IN_PROGRESS',
      );
      const bestFinalAttempt =
        completedFinalAttempts[0] || allFinalAttempts[0] || null;
      const finalMaxAttempts = finalExam.maxAttempts ?? 1;
      const finalAttemptsCount = completedFinalAttempts.length;
      const finalRemainingAttempts = Math.max(
        0,
        finalMaxAttempts - finalAttemptsCount,
      );
      const isFinalExamPassed = bestFinalAttempt
        ? bestFinalAttempt.status === 'PASSED'
        : false;
      const isFinalAttemptsExhausted = finalAttemptsCount >= finalMaxAttempts;
      finalExamScore = bestFinalAttempt ? bestFinalAttempt.score : null;

      const percentage =
        totalExamPoints > 0 && finalExamScore !== null
          ? Math.round((finalExamScore / totalExamPoints) * 100)
          : finalExamScore;

      const passingPoints =
        totalExamPoints > 0
          ? Math.ceil((finalExam.passingScore / 100) * totalExamPoints)
          : finalExam.passingScore;

      finalExamData = {
        id: finalExam.id,
        title: finalExam.title,
        description: finalExam.description,
        score: finalExamScore,
        totalPoints: totalExamPoints,
        percentage,
        passingScore: finalExam.passingScore,
        passingPoints,
        maxAttempts: finalMaxAttempts,
        attemptsCount: finalAttemptsCount,
        remainingAttempts: finalRemainingAttempts,
        isPassed: isFinalExamPassed,
        isCompleted: completedFinalAttempts.length > 0,
        canAttempt: !isFinalExamPassed && !isFinalAttemptsExhausted,
        isAttemptsExhausted: isFinalAttemptsExhausted,
      };
    }

    // محرك احتساب الدرجة التراكمية (Cumulative GPA) بمعادلة وزنية دقيقة
    let cumulativeGpa = 0;
    if (totalAssignments > 0 && totalExams > 0) {
      cumulativeGpa = Math.round(
        attendancePercentage * 0.2 +
          assignmentsAverageScore * 0.45 +
          quizzesAverageScore * 0.35,
      );
    } else if (totalAssignments > 0) {
      cumulativeGpa = Math.round(
        attendancePercentage * 0.3 + assignmentsAverageScore * 0.7,
      );
    } else if (totalExams > 0) {
      cumulativeGpa = Math.round(
        attendancePercentage * 0.3 + quizzesAverageScore * 0.7,
      );
    } else {
      cumulativeGpa = attendancePercentage;
    }

    // إذا تم حل الاختبار النهائي، يتم احتساب وزنه ونسبته من ضمن المعدل التراكمي النهائي
    if (finalExamScore !== null) {
      const finalPercentage =
        totalExamPoints > 0
          ? (finalExamScore / totalExamPoints) * 100
          : finalExamScore;
      cumulativeGpa = Math.round(cumulativeGpa * 0.6 + finalPercentage * 0.4);
    }

    // تقدير الحرف (Grade Letter)
    const gradeLetter = this.calculateGradeLetter(cumulativeGpa);

    // نسبة التقدم الكلية (مبنية على الدروس الإلزامية)
    const overallProgressPercentage =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : (hasOnlyOptionalLessons ? 100 : 0);

    // شروط استحقاق الشهادة
    const minAttendance = course.certificateMinAttendance ?? 80;
    const minScore = course.certificateMinScore ?? 70;
    const isCertificateEligible =
      attendancePercentage >= minAttendance &&
      cumulativeGpa >= minScore &&
      (totalAssignments === 0 || submittedAssignments === totalAssignments) &&
      (!finalExam || (finalExamData && finalExamData.isPassed));

    const existingCertificate = course.certificates[0] || null;

    // بناء المخطط الزمني اليومي (Daily Timeline)
    const dailyTimeline = allLessons.map((lesson, index) => {
      const dayNumber = lesson.dayNumber || index + 1;
      const progress = lesson.lessonProgress[0];
      const submission = lesson.assignment?.submissions[0];
      const allExamAttempts = lesson.exam?.attempts || [];
      const completedExamAttempts = allExamAttempts.filter(
        (a) => a.status !== 'IN_PROGRESS',
      );
      const bestAttempt = completedExamAttempts[0] || allExamAttempts[0] || null;
      const examMaxAttempts = lesson.exam?.maxAttempts ?? 1;
      const examAttemptsCount = completedExamAttempts.length;
      const examRemainingAttempts = Math.max(0, examMaxAttempts - examAttemptsCount);
      const isExamPassed = bestAttempt ? bestAttempt.status === 'PASSED' : false;
      const isExamAttemptsExhausted = examAttemptsCount >= examMaxAttempts;
      const canAttemptExam = !isExamPassed && !isExamAttemptsExhausted;

      const lessonExamPoints = (lesson.exam?.questions || []).reduce(
        (sum, q) => sum + (q.points || 0),
        0,
      );
      const lessonPassingPoints =
        lessonExamPoints > 0
          ? Math.ceil(((lesson.exam?.passingScore ?? 50) / 100) * lessonExamPoints)
          : (lesson.exam?.passingScore ?? 50);

      return {
        dayNumber,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        scheduledAt: lesson.scheduledAt || null,
        liveStatus: lesson.liveStatus || null,
        isAttended: !!progress?.isCompleted,
        isWatched: !!progress?.isCompleted,
        objectives: lesson.objectives || [],
        isMandatory: lesson.isMandatory,
        isCompleted: !!progress?.isCompleted,
        completedAt: progress?.completedAt || null,
        assignment: lesson.assignment
          ? {
              id: lesson.assignment.id,
              title: lesson.assignment.title,
              type: lesson.assignment.type,
              maxScore: lesson.assignment.maxScore,
              dueDate: lesson.assignment.dueDate,
              status: submission ? submission.status : 'NOT_SUBMITTED',
              submittedAt: submission?.submittedAt || null,
              score: submission?.score ?? null,
              feedback: submission?.feedback ?? null,
              feedbackImageUrl: submission?.feedbackImageUrl ?? null,
            }
          : null,
        exam: lesson.exam
          ? {
              id: lesson.exam.id,
              title: lesson.exam.title,
              passed: isExamPassed,
              score: bestAttempt?.score ?? null,
              totalPoints: lessonExamPoints,
              percentage:
                lessonExamPoints > 0 && bestAttempt?.score != null
                  ? Math.round((bestAttempt.score / lessonExamPoints) * 100)
                  : bestAttempt?.score ?? null,
              passingScore: lesson.exam.passingScore,
              passingPoints: lessonPassingPoints,
              maxAttempts: examMaxAttempts,
              attemptsCount: examAttemptsCount,
              remainingAttempts: examRemainingAttempts,
              canAttempt: canAttemptExam,
              isAttemptsExhausted: isExamAttemptsExhausted,
            }
          : null,
      };
    });

    return {
      course: {
        id: course.id,
        title: course.title,
        startDate: course.startDate,
        endDate: course.endDate,
        durationWeeks: course.durationWeeks,
        scheduleDays: course.scheduleDays,
        objectives: course.objectives,
        teacher: {
          name: course.teacher.user.name,
          avatar: course.teacher.user.avatar,
        },
      },
      student: {
        id: studentId,
        academicId: user.studentProfile.academicId,
        name: user.name,
        avatar: user.avatar,
      },
      summary: {
        overallProgressPercentage,
        cumulativeGpa,
        gradeLetter,
        attendancePercentage,
        completedLessonsCount: completedLessons,
        totalLessonsCount: totalLessons,
        totalAssignmentsCount: totalAssignments,
        submittedAssignmentsCount: submittedAssignments,
        assignmentsSubmissionPercentage,
        assignmentsAverageScore,
        totalExamsCount: totalExams,
        passedExamsCount: passedExams,
        quizzesAverageScore,
        certificateRequirements: {
          minScore,
          minAttendance,
          isEligible: isCertificateEligible,
          isIssued: !!existingCertificate,
        },
        certificate: existingCertificate
          ? {
              id: existingCertificate.id,
              serialNumber: existingCertificate.serialNumber,
              finalGrade: existingCertificate.finalGrade,
              issueDate: existingCertificate.issueDate,
              pdfUrl: existingCertificate.pdfUrl,
              qrCodeUrl: existingCertificate.qrCodeUrl,
            }
          : null,
        finalExam: finalExamData,
      },
      dailyTimeline,
    };
  }

  /**
   * إصدار والمطالبة بالشهادة المعتمدة للدورة
   */
  async claimCertificate(courseId: number, userId: number) {
    const evaluation = await this.getMyEvaluation(courseId, userId);

    if (evaluation.summary.certificate) {
      return evaluation.summary.certificate;
    }

    if (!evaluation.summary.certificateRequirements.isEligible) {
      throw new BadRequestException(
        'لم تستوفِ شروط استحقاق الشهادة بعد. تأكد من إكمال نسبة الحضور المطلوبة والدرجة الدنيا لتسليم الأنشطة.',
      );
    }

    const currentYear = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const serialNumber = `ALG-${currentYear}-C${courseId}-S${evaluation.student.id}-${randomCode}`;
    const qrCodeUrl = `https://algonaid.com/certificates/verify/${serialNumber}`;

    const certificate = await this.prisma.certificate.create({
      data: {
        serialNumber,
        studentId: evaluation.student.id,
        courseId,
        finalGrade: evaluation.summary.cumulativeGpa,
        qrCodeUrl,
      },
    });

    return certificate;
  }

  /**
   * تقييم الدورة وكتابة رأي من قبل الطالب المشترك
   */
  async submitReview(courseId: number, userId: number, dto: CreateReviewDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user?.studentProfile) {
      throw new ForbiddenException('حساب الطالب غير موجود');
    }

    const studentId = user.studentProfile.id;

    // التحقق من اشتراك الطالب في الدورة
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenException('يجب أن تكون مسجلاً بالدورة لتتمكن من تقييمها');
    }

    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('التقييم يجب أن يكون بين 1 و 5 نجوم');
    }

    return this.prisma.courseReview.upsert({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
      update: {
        rating: dto.rating,
        comment: dto.comment,
      },
      create: {
        courseId,
        studentId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  /**
   * جلب تقييمات الدورة
   */
  async getCourseReviews(courseId: number) {
    return this.prisma.courseReview.findMany({
      where: { courseId },
      include: {
        student: {
          include: {
            user: {
              select: { name: true, avatar: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * تحويل النسبة المئوية إلى تقدير حرفي
   */
  private calculateGradeLetter(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

