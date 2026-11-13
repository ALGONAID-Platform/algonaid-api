import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role, SubmissionStatus } from '@prisma/client';
import { BulkSaveGradesDto, UpdateSingleGradeDto } from './dto/bulk-save-grades.dto';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * التحقق من صلاحية المعلم / الأدمن على الدورة
   */
  private async checkTeacherOrAdminPermission(
    courseId: number,
    userId: number,
    role: Role,
  ) {
    if (role === Role.ADMIN || role === Role.OWNER) {
      return;
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true,
      },
    });

    if (!course) {
      throw new NotFoundException(`الدورة برقم ${courseId} غير موجودة`);
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    const isTeacherOfCourse =
      (teacher && course.instructorId === teacher.id) ||
      course.instructorId === userId;

    if (!isTeacherOfCourse) {
      throw new ForbiddenException('ليس لديك صلاحية الوصول لدرجات هذه الدورة');
    }
  }

  /**
   * حساب التقدير بالحرف
   */
  private calculateGradeLetter(percentage: number): string {
    if (percentage >= 95) return 'A+';
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'B+';
    if (percentage >= 80) return 'B';
    if (percentage >= 75) return 'C+';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * جلب سجل درجات وحضور طالب معين في دورة معينة
   * (يعرض جدول مفصل لكل درس: درجات التكاليف، الاختبارات، الحضور، مع المجموع)
   */
  async getStudentCourseGrades(
    courseId: number,
    studentIdOrUserId: number,
    requestingUserId: number,
    requestingRole: Role,
  ) {
    // 1. التحقق من وجود الطالب
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [{ id: studentIdOrUserId }, { userId: studentIdOrUserId }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`الطالب غير موجود`);
    }

    // 2. التحقق من الصلاحيات
    if (requestingRole === Role.STUDENT) {
      if (student.userId !== requestingUserId) {
        throw new ForbiddenException('لا يمكنك الاطلاع على درجات طالب آخر');
      }
    } else {
      await this.checkTeacherOrAdminPermission(
        courseId,
        requestingUserId,
        requestingRole,
      );
    }

    // 3. التحقق من وجود الدورة والتسجيل
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: {
          include: {
            user: { select: { name: true, avatar: true } },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`الدورة برقم ${courseId} غير موجودة`);
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: student.id,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('الطالب غير مسجل في هذه الدورة');
    }

    // 4. جلب جميع موديولات ودروس الدورة مع التكاليف والاختبارات والحضور لهذا الطالب
    const modules = await this.prisma.module.findMany({
      where: { courseId },
      orderBy: { id: 'asc' },
      include: {
        lessons: {
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          include: {
            lessonProgress: {
              where: { studentId: student.id },
            },
            assignment: {
              include: {
                submissions: {
                  where: { studentId: student.id },
                  orderBy: { submittedAt: 'desc' },
                  take: 1,
                },
              },
            },
            exam: {
              include: {
                questions: {
                  select: { points: true },
                },
                attempts: {
                  where: { studentId: student.id },
                  orderBy: { score: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    // جلب الاختبارات العامة على مستوى الكورس (مثل الاختبار النهائي)
    const courseLevelExams = await this.prisma.exam.findMany({
      where: {
        courseId,
        lessonId: null,
      },
      include: {
        questions: { select: { points: true } },
        attempts: {
          where: { studentId: student.id },
          orderBy: { score: 'desc' },
        },
      },
    });

    // 5. بناء أسطر الجدول لكل درس
    let totalLessonsCount = 0;
    let attendedLessonsCount = 0;

    let totalAssignmentsCount = 0;
    let submittedAssignmentsCount = 0;
    let gradedAssignmentsCount = 0;
    let totalAssignmentEarnedScore = 0;
    let totalAssignmentMaxScore = 0;

    let totalExamsCount = 0;
    let attemptedExamsCount = 0;
    let passedExamsCount = 0;
    let totalExamEarnedScore = 0;
    let totalExamMaxPoints = 0;

    const lessonsTable: any[] = [];

    modules.forEach((module) => {
      module.lessons.forEach((lesson) => {
        totalLessonsCount++;

        // بيانات الحضور
        const progress = lesson.lessonProgress[0];
        const isAttended = Boolean(progress?.isCompleted);
        if (isAttended) {
          attendedLessonsCount++;
        }

        // بيانات التكليف
        let assignmentData: any = null;
        let lessonAssignmentScore = 0;
        let lessonAssignmentMax = 0;

        if (lesson.assignment) {
          totalAssignmentsCount++;
          const assignment = lesson.assignment;
          lessonAssignmentMax = assignment.maxScore;
          totalAssignmentMaxScore += lessonAssignmentMax;

          const submission = assignment.submissions[0];
          if (submission) {
            submittedAssignmentsCount++;
            if (submission.status === SubmissionStatus.GRADED && submission.score !== null) {
              gradedAssignmentsCount++;
              lessonAssignmentScore = submission.score;
              totalAssignmentEarnedScore += lessonAssignmentScore;
            }
          }

          assignmentData = {
            id: assignment.id,
            title: assignment.title,
            type: assignment.type,
            maxScore: assignment.maxScore,
            dueDate: assignment.dueDate,
            submissionId: submission?.id ?? null,
            status: submission ? submission.status : 'NOT_SUBMITTED',
            score: submission?.score ?? null,
            submittedAt: submission?.submittedAt ?? null,
            feedback: submission?.feedback ?? null,
            fileUrl: submission?.fileUrl ?? null,
            content: submission?.content ?? null,
            gradedAt: submission?.gradedAt ?? null,
          };
        }

        // بيانات الاختبار
        let examData: any = null;
        let lessonExamScore = 0;
        let lessonExamMax = 0;

        if (lesson.exam) {
          totalExamsCount++;
          const exam = lesson.exam;
          lessonExamMax = (exam.questions || []).reduce(
            (sum, q) => sum + (q.points || 0),
            0,
          );
          totalExamMaxPoints += lessonExamMax;

          const allAttempts = exam.attempts || [];
          const completedAttempts = allAttempts.filter(
            (a) => a.status !== 'IN_PROGRESS',
          );
          const bestAttempt = completedAttempts[0] || allAttempts[0] || null;

          if (bestAttempt) {
            attemptedExamsCount++;
            if (bestAttempt.status === 'PASSED') {
              passedExamsCount++;
            }
            if (bestAttempt.score !== null && bestAttempt.score !== undefined) {
              lessonExamScore = bestAttempt.score;
              totalExamEarnedScore += lessonExamScore;
            }
          }

          examData = {
            id: exam.id,
            title: exam.title,
            maxPoints: lessonExamMax,
            passingScore: exam.passingScore,
            score: bestAttempt?.score ?? null,
            percentage:
              lessonExamMax > 0 && bestAttempt?.score !== null && bestAttempt?.score !== undefined
                ? Math.round((bestAttempt.score / lessonExamMax) * 100)
                : bestAttempt?.score ?? null,
            status: bestAttempt ? bestAttempt.status : 'NOT_ATTEMPTED',
            isPassed: bestAttempt ? bestAttempt.status === 'PASSED' : false,
            attemptsCount: allAttempts.length,
            completedAt: bestAttempt?.completedAt ?? null,
          };
        }

        lessonsTable.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleId: module.id,
          moduleTitle: module.title,
          order: lesson.order,
          dayNumber: lesson.dayNumber,
          isMandatory: lesson.isMandatory,
          scheduledAt: lesson.scheduledAt,
          attendance: {
            isAttended,
            isCompleted: isAttended,
            completedAt: progress?.completedAt ?? null,
            watchCount: progress?.watchCount ?? 0,
            status: isAttended ? 'PRESENT' : 'ABSENT',
          },
          assignment: assignmentData,
          exam: examData,
          lessonTotalEarned: lessonAssignmentScore + lessonExamScore,
          lessonTotalMax: lessonAssignmentMax + lessonExamMax,
        });
      });
    });

    // معالجة الاختبارات على مستوى الكورس (إن وجدت)
    const formattedCourseExams = courseLevelExams.map((exam) => {
      const examMax = (exam.questions || []).reduce(
        (sum, q) => sum + (q.points || 0),
        0,
      );
      const allAttempts = exam.attempts || [];
      const completedAttempts = allAttempts.filter(
        (a) => a.status !== 'IN_PROGRESS',
      );
      const bestAttempt = completedAttempts[0] || allAttempts[0] || null;

      if (bestAttempt) {
        attemptedExamsCount++;
        if (bestAttempt.status === 'PASSED') {
          passedExamsCount++;
        }
        if (bestAttempt.score !== null && bestAttempt.score !== undefined) {
          totalExamEarnedScore += bestAttempt.score;
        }
      }
      totalExamsCount++;
      totalExamMaxPoints += examMax;

      return {
        id: exam.id,
        title: exam.title,
        maxPoints: examMax,
        passingScore: exam.passingScore,
        score: bestAttempt?.score ?? null,
        percentage:
          examMax > 0 && bestAttempt?.score !== null && bestAttempt?.score !== undefined
            ? Math.round((bestAttempt.score / examMax) * 100)
            : bestAttempt?.score ?? null,
        status: bestAttempt ? bestAttempt.status : 'NOT_ATTEMPTED',
        isPassed: bestAttempt ? bestAttempt.status === 'PASSED' : false,
        attemptsCount: allAttempts.length,
        completedAt: bestAttempt?.completedAt ?? null,
      };
    });

    // 6. احتساب المجاميع والنسب
    const attendancePercentage =
      totalLessonsCount > 0
        ? Math.round((attendedLessonsCount / totalLessonsCount) * 100)
        : 100;

    const assignmentPercentage =
      totalAssignmentMaxScore > 0
        ? Math.round((totalAssignmentEarnedScore / totalAssignmentMaxScore) * 100)
        : 0;

    const assignmentAverageScore =
      gradedAssignmentsCount > 0
        ? Math.round(totalAssignmentEarnedScore / gradedAssignmentsCount)
        : 0;

    const examPercentage =
      totalExamMaxPoints > 0
        ? Math.round((totalExamEarnedScore / totalExamMaxPoints) * 100)
        : 0;

    const examAverageScore =
      attemptedExamsCount > 0
        ? Math.round(totalExamEarnedScore / attemptedExamsCount)
        : 0;

    // المجموع الكلي (درجات التكاليف + درجات الاختبارات)
    const grandTotalEarned = totalAssignmentEarnedScore + totalExamEarnedScore;
    const grandTotalMax = totalAssignmentMaxScore + totalExamMaxPoints;
    const overallPercentage =
      grandTotalMax > 0
        ? Math.round((grandTotalEarned / grandTotalMax) * 100)
        : attendancePercentage;

    // المعدل التراكمي الموزون (GPA)
    let cumulativeGpa = 0;
    if (totalAssignmentsCount > 0 && totalExamsCount > 0) {
      cumulativeGpa = Math.round(
        attendancePercentage * 0.2 +
          assignmentPercentage * 0.45 +
          examPercentage * 0.35,
      );
    } else if (totalAssignmentsCount > 0) {
      cumulativeGpa = Math.round(
        attendancePercentage * 0.3 + assignmentPercentage * 0.7,
      );
    } else if (totalExamsCount > 0) {
      cumulativeGpa = Math.round(
        attendancePercentage * 0.3 + examPercentage * 0.7,
      );
    } else {
      cumulativeGpa = attendancePercentage;
    }

    const gradeLetter = this.calculateGradeLetter(cumulativeGpa);

    return {
      course: {
        id: course.id,
        title: course.title,
        instructorId: course.instructorId,
        teacherName: course.teacher?.user?.name,
      },
      student: {
        id: student.id,
        userId: student.userId,
        academicId: student.academicId,
        name: student.user.name,
        email: student.user.email,
        avatar: student.user.avatar,
        grade: student.grade,
      },
      enrollment: {
        status: enrollment.status,
        enrolledAt: enrollment.createdAt,
      },
      summary: {
        attendance: {
          totalLessons: totalLessonsCount,
          attendedLessons: attendedLessonsCount,
          attendancePercentage,
        },
        assignments: {
          totalCount: totalAssignmentsCount,
          submittedCount: submittedAssignmentsCount,
          gradedCount: gradedAssignmentsCount,
          totalEarnedScore: totalAssignmentEarnedScore,
          totalMaxScore: totalAssignmentMaxScore,
          percentage: assignmentPercentage,
          averageScore: assignmentAverageScore,
        },
        exams: {
          totalCount: totalExamsCount,
          attemptedCount: attemptedExamsCount,
          passedCount: passedExamsCount,
          totalEarnedPoints: totalExamEarnedScore,
          totalMaxPoints: totalExamMaxPoints,
          percentage: examPercentage,
          averageScore: examAverageScore,
        },
        overall: {
          totalEarnedPoints: grandTotalEarned,
          totalPossiblePoints: grandTotalMax,
          totalPercentage: overallPercentage,
          cumulativeGpa,
          gradeLetter,
          progressPercentage: attendancePercentage,
        },
      },
      lessons: lessonsTable,
      dailyTimeline: lessonsTable, // اسم بديل متوافق تماماً مع واجهات المخطط اليومي
      courseExams: formattedCourseExams,
    };
  }

  /**
   * جلب ملخص الدرجات لكامل طلاب الدورة (لدعم تبويب Grades في لوحة التحكم)
   */
  async getCourseGradesOverview(
    courseId: number,
    requestingUserId: number,
    requestingRole: Role,
  ) {
    await this.checkTeacherOrAdminPermission(
      courseId,
      requestingUserId,
      requestingRole,
    );

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
        modules: {
          orderBy: { id: 'asc' },
          include: {
            lessons: {
              orderBy: [{ order: 'asc' }, { id: 'asc' }],
              include: {
                assignment: true,
                exam: {
                  include: {
                    questions: { select: { points: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`الدورة برقم ${courseId} غير موجودة`);
    }

    const allLessons = course.modules.flatMap((m) => m.lessons);
    const assessments: any[] = [];

    allLessons.forEach((lesson) => {
      if (lesson.assignment) {
        assessments.push({
          id: lesson.assignment.id,
          assessmentId: lesson.assignment.id,
          type: 'ASSIGNMENT',
          title: lesson.assignment.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          maxScore: lesson.assignment.maxScore,
        });
      }
      if (lesson.exam) {
        const maxPoints = (lesson.exam.questions || []).reduce(
          (sum, q) => sum + (q.points || 0),
          0,
        );
        assessments.push({
          id: lesson.exam.id,
          assessmentId: lesson.exam.id,
          type: 'EXAM',
          title: lesson.exam.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          maxScore: maxPoints,
        });
      }
    });

    // جلب درجات كل طالب
    const studentsSummary: any[] = [];
    const gradeRecords: any[] = [];

    for (const enrollment of course.enrollments) {
      const student = enrollment.student;
      const studentGrades = await this.getStudentCourseGrades(
        courseId,
        student.id,
        requestingUserId,
        requestingRole,
      );

      studentsSummary.push({
        student: {
          id: student.id,
          userId: student.userId,
          academicId: student.academicId,
          name: student.user.name,
          email: student.user.email,
          avatar: student.user.avatar,
        },
        summary: studentGrades.summary,
      });

      // بناء gradeRecords لكل تقييم تم إنجازه
      studentGrades.lessons.forEach((lesson) => {
        if (lesson.assignment) {
          gradeRecords.push({
            studentId: student.id,
            studentName: student.user.name,
            assessmentId: lesson.assignment.id,
            assessmentType: 'ASSIGNMENT',
            assessmentTitle: lesson.assignment.title,
            lessonId: lesson.lessonId,
            lessonTitle: lesson.lessonTitle,
            maxScore: lesson.assignment.maxScore,
            score: lesson.assignment.score,
            status: lesson.assignment.status,
            note: lesson.assignment.feedback,
            gradedAt: lesson.assignment.gradedAt,
          });
        }
        if (lesson.exam) {
          gradeRecords.push({
            studentId: student.id,
            studentName: student.user.name,
            assessmentId: lesson.exam.id,
            assessmentType: 'EXAM',
            assessmentTitle: lesson.exam.title,
            lessonId: lesson.lessonId,
            lessonTitle: lesson.lessonTitle,
            maxScore: lesson.exam.maxPoints,
            score: lesson.exam.score,
            status: lesson.exam.status,
            note: null,
            gradedAt: lesson.exam.completedAt,
          });
        }
      });
    }

    return {
      course: {
        id: course.id,
        title: course.title,
      },
      enrolledStudentsCount: course.enrollments.length,
      assessmentsCount: assessments.length,
      assessments,
      students: studentsSummary,
      gradeRecords,
    };
  }

  /**
   * حفظ أو تحديث مجموعة درجات للتكاليف (Bulk Grade Saving)
   * يتم ذلك ضمن Transaction على جدول AssignmentSubmission الحالي دون أي جداول جديدة
   */
  async saveBulkGrades(
    courseId: number,
    requestingUserId: number,
    requestingRole: Role,
    dto: BulkSaveGradesDto,
  ) {
    await this.checkTeacherOrAdminPermission(
      courseId,
      requestingUserId,
      requestingRole,
    );

    if (!dto.grades || dto.grades.length === 0) {
      throw new BadRequestException('مصفوفة الدرجات فارغة');
    }

    const savedRecords: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.grades) {
        const assignmentId = entry.assessmentId || entry.assignmentId;
        if (!assignmentId) {
          throw new BadRequestException(
            `يجب تحديد assessmentId أو assignmentId لكل سجل`,
          );
        }

        // التحقق من وجود الطالب وتسجيله
        const student = await tx.student.findFirst({
          where: {
            OR: [{ id: entry.studentId }, { userId: entry.studentId }],
          },
        });

        if (!student) {
          throw new NotFoundException(`الطالب برقم ${entry.studentId} غير موجود`);
        }

        const enrollment = await tx.enrollment.findUnique({
          where: {
            studentId_courseId: {
              studentId: student.id,
              courseId,
            },
          },
        });

        if (!enrollment || enrollment.status !== 'ACTIVE') {
          throw new BadRequestException(
            `الطالب برقم ${entry.studentId} غير مسجل في هذه الدورة`,
          );
        }

        // التحقق من أن التكليف يتبع للدورة المحددة
        const assignment = await tx.assignment.findUnique({
          where: { id: assignmentId },
          include: {
            lesson: {
              include: {
                module: true,
              },
            },
          },
        });

        if (!assignment || assignment.lesson.module.courseId !== courseId) {
          throw new BadRequestException(
            `التكليف برقم ${assignmentId} غير موجود في هذه الدورة`,
          );
        }

        // التحقق من الدرجة
        if (entry.score < 0 || entry.score > assignment.maxScore) {
          throw new BadRequestException(
            `الدرجة (${entry.score}) غير صحيحة، يجب أن تكون بين 0 و ${assignment.maxScore}`,
          );
        }

        // البحث عما إذا كان هناك تسليم مسبق للطالب
        const existingSubmission = await tx.assignmentSubmission.findFirst({
          where: {
            assignmentId,
            studentId: student.id,
          },
        });

        let savedSubmission;
        if (existingSubmission) {
          savedSubmission = await tx.assignmentSubmission.update({
            where: { id: existingSubmission.id },
            data: {
              score: Math.round(entry.score),
              status: SubmissionStatus.GRADED,
              feedback: entry.note !== undefined ? entry.note : existingSubmission.feedback,
              gradedById: requestingUserId,
              gradedAt: new Date(),
            },
          });
        } else {
          savedSubmission = await tx.assignmentSubmission.create({
            data: {
              assignmentId,
              studentId: student.id,
              score: Math.round(entry.score),
              status: SubmissionStatus.GRADED,
              feedback: entry.note || null,
              gradedById: requestingUserId,
              gradedAt: new Date(),
              submittedAt: new Date(),
            },
          });
        }

        savedRecords.push({
          submissionId: savedSubmission.id,
          studentId: student.id,
          assignmentId,
          score: savedSubmission.score,
          status: savedSubmission.status,
          feedback: savedSubmission.feedback,
          gradedAt: savedSubmission.gradedAt,
        });
      }
    });

    return {
      message: 'تم حفظ الدرجات بنجاح',
      savedCount: savedRecords.length,
      records: savedRecords,
    };
  }

  /**
   * تحديث درجة تكليف فردي لطالب معين
   */
  async updateSingleGrade(
    courseId: number,
    studentIdOrUserId: number,
    assignmentId: number,
    requestingUserId: number,
    requestingRole: Role,
    dto: UpdateSingleGradeDto,
  ) {
    await this.checkTeacherOrAdminPermission(
      courseId,
      requestingUserId,
      requestingRole,
    );

    const student = await this.prisma.student.findFirst({
      where: {
        OR: [{ id: studentIdOrUserId }, { userId: studentIdOrUserId }],
      },
    });

    if (!student) {
      throw new NotFoundException(`الطالب غير موجود`);
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        lesson: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!assignment || assignment.lesson.module.courseId !== courseId) {
      throw new BadRequestException(
        `التكليف برقم ${assignmentId} لا يتبع لهذه الدورة`,
      );
    }

    if (dto.score < 0 || dto.score > assignment.maxScore) {
      throw new BadRequestException(
        `الدرجة يجب أن تكون بين 0 و ${assignment.maxScore}`,
      );
    }

    const feedback = dto.feedback || dto.note;

    const existingSubmission = await this.prisma.assignmentSubmission.findFirst({
      where: {
        assignmentId,
        studentId: student.id,
      },
    });

    let savedSubmission;
    if (existingSubmission) {
      savedSubmission = await this.prisma.assignmentSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          score: Math.round(dto.score),
          status: SubmissionStatus.GRADED,
          feedback: feedback !== undefined ? feedback : existingSubmission.feedback,
          gradedById: requestingUserId,
          gradedAt: new Date(),
        },
      });
    } else {
      savedSubmission = await this.prisma.assignmentSubmission.create({
        data: {
          assignmentId,
          studentId: student.id,
          score: Math.round(dto.score),
          status: SubmissionStatus.GRADED,
          feedback: feedback || null,
          gradedById: requestingUserId,
          gradedAt: new Date(),
          submittedAt: new Date(),
        },
      });
    }

    return {
      message: 'تم حفظ الدرجة بنجاح',
      submission: savedSubmission,
    };
  }
}
