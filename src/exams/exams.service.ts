import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, ExamType, LessonStatus, Role, AssignmentType, SubmissionStatus } from '@prisma/client';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { CreateExamDto, CreateQuestionDto, CreateOptionDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { sortByRankingCriteria } from './helpers/ranking.helper';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private formatLatestComment(comments?: Array<{
    id: number;
    text: string;
    imageUrl: string | null;
    createdAt: Date;
    user: { id: number; name: string; avatar: string | null };
  }>) {
    if (!comments || comments.length === 0) return null;
    const c = comments[0];
    return {
      id: c.id,
      text: c.text,
      imageUrl: c.imageUrl,
      createdAt: c.createdAt,
      userName: c.user.name,
      userAvatar: c.user.avatar,
      user: {
        id: c.user.id,
        name: c.user.name,
        avatar: c.user.avatar,
      },
      student: {
        id: c.user.id,
        name: c.user.name,
        avatar: c.user.avatar,
      },
    };
  }

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

    const now = new Date();
    const challengeEnded =
      exam.examType === ExamType.CHALLENGE && exam.endTime && exam.endTime < now;

    if (!challengeEnded && completedAttempts.length >= exam.maxAttempts) {
      throw new ForbiddenException('لقد استنفدت جميع محاولاتك المسموح بها');
    }

    const hasRankedAttempt = allAttempts.some((a) => a.isRanked);
    const shouldBeRanked = !hasRankedAttempt && !challengeEnded;

    return { student, shouldBeRanked };
  }

  private async checkExamPrerequisites(
    studentId: number,
    exam: any,
  ): Promise<{ isUnlocked: boolean; lockedReason: string | null }> {
    // 1. اختبار مرحلي لدرس محدد (Interim Lesson Quiz)
    if (exam.lessonId) {
      const currentLesson = await this.prisma.lesson.findUnique({
        where: { id: exam.lessonId },
        include: {
          module: {
            include: {
              course: {
                include: {
                  modules: {
                    include: {
                      lessons: {
                        where: { status: LessonStatus.PUBLISHED },
                        orderBy: { order: 'asc' },
                      },
                    },
                    orderBy: { id: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (currentLesson) {
        // شرط المتطلبات السابقة ينطبق فقط على الكورسات المدفوعة؛ الكورسات المجانية مفتوحة بالكامل
        if (!currentLesson.module.course.isPaid) {
          return { isUnlocked: true, lockedReason: null };
        }

        const allCourseModules = currentLesson.module.course.modules;
        const precedingLessonIds: number[] = [];

        for (const mod of allCourseModules) {
          for (const l of mod.lessons) {
            if (l.isMandatory !== false) {
              if (mod.id < currentLesson.moduleId) {
                precedingLessonIds.push(l.id);
              } else if (mod.id === currentLesson.moduleId) {
                if (l.order <= currentLesson.order) {
                  precedingLessonIds.push(l.id);
                }
              }
            }
          }
        }

        if (precedingLessonIds.length > 0) {
          const completedCount = await this.prisma.lessonProgress.count({
            where: {
              studentId,
              lessonId: { in: precedingLessonIds },
              isCompleted: true,
            },
          });

          if (completedCount < precedingLessonIds.length) {
            return {
              isUnlocked: false,
              lockedReason: `الاختبار مغلق: يجب إكمال جميع الدروس الإلزامية السابقة أولاً (${completedCount}/${precedingLessonIds.length} مكتمل).`,
            };
          }
        }
      }
    } else if (
      exam.examType === ExamType.FINAL_EXAM ||
      exam.examType === ExamType.COURSE_QUIZ ||
      (exam.courseId && !exam.lessonId)
    ) {
      // 2. اختبار نهائي للدورة (Course Final Exam)
      const courseId = exam.courseId;
      if (courseId) {
        const course = await this.prisma.course.findUnique({
          where: { id: courseId },
          include: {
            modules: {
              include: {
                lessons: {
                  where: { status: LessonStatus.PUBLISHED },
                  include: { exam: true },
                },
              },
            },
            exams: true,
          },
        });

        if (course) {
          // شرط المتطلبات السابقة ينطبق فقط على الكورسات المدفوعة؛ الكورسات المجانية مفتوحة بالكامل
          if (!course.isPaid) {
            return { isUnlocked: true, lockedReason: null };
          }
          const allPublishedLessons = course.modules.flatMap((m) => m.lessons);
          const mandatoryLessons = allPublishedLessons.filter((l) => l.isMandatory !== false);
          const lessonIds = mandatoryLessons.map((l) => l.id);

          if (lessonIds.length > 0) {
            const completedLessonsCount = await this.prisma.lessonProgress.count({
              where: {
                studentId,
                lessonId: { in: lessonIds },
                isCompleted: true,
              },
            });

            if (completedLessonsCount < lessonIds.length) {
              return {
                isUnlocked: false,
                lockedReason: `الاختبار النهائي مغلق: يجب إكمال جميع دروس الدورة الإلزامية أولاً (${completedLessonsCount}/${lessonIds.length} مكتمل).`,
              };
            }
          }

          // التحقق من اجتياز جميع الاختبارات المرحلية السابقة
          const otherExamIds = [
            ...allPublishedLessons.filter((l) => l.exam && l.exam.id !== exam.id).map((l) => l.exam!.id),
            ...course.exams
              .filter(
                (e) =>
                  e.id !== exam.id &&
                  e.examType !== ExamType.COURSE_QUIZ &&
                  e.examType !== ExamType.FINAL_EXAM,
              )
              .map((e) => e.id),
          ];

          if (otherExamIds.length > 0) {
            const passedAttempts = await this.prisma.examAttempt.findMany({
              where: {
                studentId,
                examId: { in: otherExamIds },
                status: ExamStatus.PASSED,
              },
              select: { examId: true },
              distinct: ['examId'],
            });

            if (passedAttempts.length < otherExamIds.length) {
              return {
                isUnlocked: false,
                lockedReason: `الاختبار النهائي مغلق: يجب اجتياز جميع الاختبارات السابقة للدورة أولاً (${passedAttempts.length}/${otherExamIds.length} مجتاز).`,
              };
            }
          }
        }
      }
    }

    return { isUnlocked: true, lockedReason: null };
  }

  async findAll(userId: number, role: Role) {
    const commentsInclude = {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      select: {
        id: true,
        text: true,
        imageUrl: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    };

    const commonInclude = {
      lesson: { include: { module: { include: { course: true } } } },
      course: true,
      questions: { select: { id: true, points: true } },
      _count: { select: { attempts: true, comments: true } },
      comments: commentsInclude,
    };

    const exams = await this.prisma.exam.findMany({
      where:
        role === Role.ADMIN || role === Role.OWNER
          ? undefined
          : {
              OR: [
                { lesson: { status: LessonStatus.PUBLISHED } },
                { courseId: { not: null } },
              ],
            },
      include: commonInclude,
    });

    return exams.map((exam) => {
      const totalPoints = exam.questions.reduce(
        (sum: number, q: { points: number }) => sum + q.points,
        0,
      );
      const totalQuestions = exam.questions.length;
      const passingPoints =
        totalPoints > 0
          ? Math.ceil((exam.passingScore / 100) * totalPoints)
          : 0;

      const { comments, questions, ...examData } = exam;
      return {
        ...examData,
        totalQuestions,
        totalPoints,
        passingPoints,
        minPassingScore: passingPoints,
        commentsCount: exam._count.comments,
        totalComments: exam._count.comments,
        latestComment: this.formatLatestComment(comments),
      };
    });
  }

  async createExam(userId: number, role: Role, dto: CreateExamDto) {
    const { lessonId, courseId, questions, startTime, endTime, asAssignment, ...examData } = dto;

    if (!lessonId && !courseId) {
      throw new BadRequestException('يجب تحديد lessonId أو courseId');
    }
    if (lessonId && courseId) {
      throw new BadRequestException('لا يمكن ربط الاختبار بدرس وكورس في نفس الوقت');
    }
    if (dto.examType === ExamType.FINAL_EXAM && !courseId) {
      throw new BadRequestException('الاختبار النهائي يجب أن يرتبط بكورس ولا يمكن ربطه بدرس');
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

    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          module: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  instructorId: true,
                  teacher: {
                    select: {
                      userId: true,
                      user: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');

      const isInstructor =
        user?.teacherProfile &&
        lesson.module.course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner)
        throw new ForbiddenException('لا تملك صلاحية إضافة اختبار لهذا الدرس');

      const existing = await this.prisma.exam.findUnique({ where: { lessonId } });
      if (existing) throw new BadRequestException('يوجد اختبار لهذا الدرس بالفعل');

      const createdExam = await this.prisma.exam.create({
        data: { ...extraData, lessonId, questions: { create: questionData } },
        include: { questions: { include: { options: true } } },
      });

      if (asAssignment) {
        await this.prisma.assignment.upsert({
          where: { lessonId },
          update: {
            title: dto.title,
            description: dto.description,
            type: AssignmentType.QUIZ,
            examId: createdExam.id,
          },
          create: {
            lessonId,
            title: dto.title,
            description: dto.description,
            type: AssignmentType.QUIZ,
            examId: createdExam.id,
            maxScore: 100,
          },
        });
      }

      // إرسال إشعار رسمي لجميع الطلاب المسجلين في هذا الكورس بإضافة كويز/اختبار للدرس
      try {
        const targetCourseId = lesson.module?.course?.id;
        const targetCourseTitle = lesson.module?.course?.title || 'الكورس';
        const teacherUserId = lesson.module?.course?.teacher?.userId || userId;
        const teacherName = lesson.module?.course?.teacher?.user?.name || user?.name || 'المعلم';

        // إرسال إشعار رسمي للطلاب المسجلين في هذا الكورس (يُستثنى كويز الدرس LESSON_QUIZ بناءً على رغبة الإدارة)
        if (targetCourseId && createdExam.examType !== ExamType.LESSON_QUIZ) {
          await this.notificationsService.notifyNewExamToEnrolledStudents(
            teacherUserId,
            teacherName,
            targetCourseId,
            targetCourseTitle,
            createdExam.title,
            createdExam.id,
            createdExam.examType,
          );
        }
      } catch (err) {
        // عدم تعطيل إنشاء الاختبار في حال حدوث خطأ أثناء إرسال الإشعار
      }

      return createdExam;
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: {
          select: {
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const isInstructor =
      user?.teacherProfile && course.instructorId === user.teacherProfile.id;
    if (!isInstructor && !isOwner)
      throw new ForbiddenException('لا تملك صلاحية إضافة اختبار لهذا الكورس');

    if (dto.examType === ExamType.FINAL_EXAM) {
      if (!course.isPaid) {
        throw new BadRequestException('الاختبار النهائي مخصص للكورسات والمسارات المدفوعة فقط');
      }
      const existingFinalExam = await this.prisma.exam.findFirst({
        where: {
          courseId,
          examType: ExamType.FINAL_EXAM,
        },
      });
      if (existingFinalExam) {
        throw new BadRequestException('يوجد اختبار نهائي بالفعل لهذا الكورس، لا يُسمح بإضافة أكثر من اختبار نهائي واحد لكل كورس');
      }
    }

    const createdExam = await this.prisma.exam.create({
      data: { ...extraData, courseId, questions: { create: questionData } },
      include: { course: true, questions: { include: { options: true } } },
    });

    // إرسال إشعار رسمي لجميع الطلاب المسجلين في هذا الكورس بإضافة الاختبار
    try {
      const teacherUserId = course.teacher?.userId || userId;
      const teacherName = course.teacher?.user?.name || user?.name || 'المعلم';

      await this.notificationsService.notifyNewExamToEnrolledStudents(
        teacherUserId,
        teacherName,
        course.id,
        course.title,
        createdExam.title,
        createdExam.id,
        createdExam.examType,
      );
    } catch (err) {
      // عدم تعطيل إنشاء الاختبار في حال حدوث خطأ أثناء إرسال الإشعار
    }

    return createdExam;
  }

  async updateExam(userId: number, role: Role, examId: number, dto: UpdateExamDto) {
    const existingExam = await this.checkExamPermission(userId, role, examId);
    const { questions, asAssignment, ...metadata } = dto;

    if (dto.examType === ExamType.FINAL_EXAM) {
      const courseId = existingExam.courseId;
      if (!courseId) {
        throw new BadRequestException('الاختبار النهائي يجب أن يرتبط بكورس ولا يمكن ربطه بدرس');
      }
      const course = existingExam.course || (await this.prisma.course.findUnique({ where: { id: courseId } }));
      if (!course?.isPaid) {
        throw new BadRequestException('الاختبار النهائي مخصص للكورسات والمسارات المدفوعة فقط');
      }
      const existingFinalExam = await this.prisma.exam.findFirst({
        where: {
          courseId,
          examType: ExamType.FINAL_EXAM,
          id: { not: examId },
        },
      });
      if (existingFinalExam) {
        throw new BadRequestException('يوجد اختبار نهائي آخر بالفعل لهذا الكورس، لا يُسمح بوجود أكثر من اختبار نهائي واحد');
      }
    }

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

      const lessonId = existingExam.lessonId;
      if (lessonId && asAssignment !== undefined) {
        if (asAssignment) {
          await tx.assignment.upsert({
            where: { lessonId },
            update: {
              title: dto.title ?? existingExam.title,
              description: dto.description ?? existingExam.description,
              type: AssignmentType.QUIZ,
              examId: examId,
            },
            create: {
              lessonId,
              title: dto.title ?? existingExam.title,
              description: dto.description ?? existingExam.description,
              type: AssignmentType.QUIZ,
              examId: examId,
              maxScore: 100,
            },
          });
        } else {
          await tx.assignment.deleteMany({
            where: {
              lessonId,
              examId,
            },
          });
        }
      }

      return tx.exam.findUnique({
        where: { id: examId },
        include: { questions: { include: { options: true } }, course: true, assignment: true },
      });
    });
  }

  async deleteExam(userId: number, role: Role, examId: number) {
    await this.checkExamPermission(userId, role, examId);
    await this.prisma.exam.delete({ where: { id: examId } });
    return { message: 'Exam deleted successfully' };
  }

  async getExam(examId: number, userId?: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        lesson: { include: { module: { include: { course: true } } } },
        course: true,
        questions: {
          select: {
            points: true,
          },
        },
        _count: { select: { attempts: true, comments: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            text: true,
            imageUrl: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.lesson?.status === LessonStatus.DRAFT) {
      if (!userId) throw new NotFoundException('Exam not found');
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.OWNER && user?.role !== Role.ADMIN)
        throw new NotFoundException('Exam not found');
    }

    let isUnlocked = true;
    let lockReason: string | null = null;
    let remainingAttempts = exam.maxAttempts;

    if (userId) {
      let student = await this.prisma.student.findUnique({ where: { userId } });
      if (!student) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { studentProfile: true },
        });
        student = user?.studentProfile ?? null;
      }

      if (student) {
        const completedAttemptsCount = await this.prisma.examAttempt.count({
          where: {
            examId,
            studentId: student.id,
            status: { not: ExamStatus.IN_PROGRESS },
          },
        });
        remainingAttempts = Math.max(0, exam.maxAttempts - completedAttemptsCount);

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        const isStaff = user?.role === Role.OWNER || user?.role === Role.ADMIN;
        if (!isStaff) {
          const check = await this.checkExamPrerequisites(student.id, exam);
          isUnlocked = check.isUnlocked;
          lockReason = check.lockedReason;
        }
      }
    }

    const totalPoints = exam.questions.reduce(
      (sum: number, q: { points: number }) => sum + q.points,
      0,
    );
    const passingPoints = totalPoints > 0 ? Math.ceil((exam.passingScore / 100) * totalPoints) : 0;
    const totalQuestions = exam.questions.length;

    const { comments, questions, ...examData } = exam;
    const now = new Date();
    const hasEndTime = exam.endTime !== null && exam.endTime !== undefined;
    const isEnded = Boolean(exam.endTime && new Date(exam.endTime) <= now);
    let timeStatus: 'UPCOMING' | 'ONGOING' | 'ENDED' = 'ONGOING';
    if (exam.startTime && new Date(exam.startTime) > now) {
      timeStatus = 'UPCOMING';
    } else if (isEnded) {
      timeStatus = 'ENDED';
    }

    const resolvedCourse = exam.course || exam.lesson?.module?.course || null;
    const isPaidCourse = Boolean(resolvedCourse?.isPaid);

    return {
      ...examData,
      course: resolvedCourse,
      isPaidCourse,
      totalQuestions,
      remainingAttempts,
      isUnlocked,
      lockReason,
      totalPoints,
      passingPoints,
      minPassingScore: passingPoints,
      isEnded,
      timeStatus,
      commentsCount: exam._count.comments,
      totalComments: exam._count.comments,
      latestComment: this.formatLatestComment(comments),
    };
  }

  private formatExamCard(exam: any) {
    const now = new Date();
    const hasEndTime = exam.endTime !== null && exam.endTime !== undefined;
    const isEnded = !hasEndTime || new Date(exam.endTime) <= now;

    let timeStatus: 'UPCOMING' | 'ONGOING' | 'ENDED' = 'ONGOING';
    if (exam.startTime && new Date(exam.startTime) > now) {
      timeStatus = 'UPCOMING';
    } else if (hasEndTime && new Date(exam.endTime) < now) {
      timeStatus = 'ENDED';
    }

    // عدد الطلاب الفريدين المشاركين في الاختبار
    const uniqueStudentIds = new Set<number>();
    for (const attempt of (exam.attempts || [])) {
      const studentId = (attempt as any).student?.id;
      if (studentId) uniqueStudentIds.add(studentId);
    }
    const participantsCount = uniqueStudentIds.size;

    let topParticipants: any[] = [];
    if (!isEnded) {
      // أثناء سير الاختبار: عرض أحدث المشاركين الفريدين بدون درجات وبدون ترتيب
      const uniqueAttempts: any[] = [];
      const seen = new Set<number>();
      for (const attempt of (exam.attempts || [])) {
        const studentId = (attempt as any).student?.id;
        if (studentId && !seen.has(studentId)) {
          seen.add(studentId);
          uniqueAttempts.push(attempt);
        }
      }
      topParticipants = uniqueAttempts
        .slice(0, 3)
        .map((attempt: any) => ({
          studentId: attempt.student.id,
          name: attempt.student.user.name,
          avatar: attempt.student.user.avatar,
          completedAt: attempt.completedAt,
          participatedAt: attempt.completedAt,
        }));
    } else {
      // بعد انتهاء الاختبار: عرض أفضل 3 متصدرين فريدين بالدرجات والمراكز
      const rankedOnly = (exam.attempts || []).filter((a: any) => a.isRanked !== false);
      let sortedAttempts = sortByRankingCriteria(rankedOnly as any, exam.rankingCriteria);
      if (!sortedAttempts.some((a: any) => a.score > 0)) {
        sortedAttempts = [];
      }
      const uniqueSorted: any[] = [];
      const seenSorted = new Set<number>();
      for (const attempt of sortedAttempts) {
        const studentId = attempt.student?.id;
        if (studentId && !seenSorted.has(studentId)) {
          seenSorted.add(studentId);
          uniqueSorted.push(attempt);
        }
      }
      topParticipants = uniqueSorted.slice(0, 3).map((attempt: any, index: number) => ({
        rank: index + 1,
        studentId: attempt.student.id,
        name: attempt.student.user.name,
        avatar: attempt.student.user.avatar,
        score: attempt.score,
        timeTakenMs: attempt.timeTaken ?? 0,
        completedAt: attempt.completedAt,
        participatedAt: attempt.completedAt,
      }));
    }

    const totalPoints = (exam.questions || []).reduce(
      (sum: number, q: { points: number }) => sum + (q.points || 0),
      0,
    );
    const passingPoints = totalPoints > 0 ? Math.ceil((exam.passingScore / 100) * totalPoints) : 0;
    const totalQuestions = (exam.questions || []).length;

    const course = exam.course || exam.lesson?.module?.course || null;
    const isPaidCourse = Boolean(course?.isPaid);

    const { attempts, comments, questions, ...examData } = exam;
    return {
      ...examData,
      totalQuestions,
      course,
      isPaidCourse,
      timeStatus,
      isEnded,
      totalPoints,
      passingPoints,
      minPassingScore: passingPoints,
      participantsCount,
      topParticipants,
      commentsCount: exam._count?.comments ?? 0,
      totalComments: exam._count?.comments ?? 0,
      latestComment: this.formatLatestComment(comments),
    };
  }

  async getExamByCourse(courseId: number, userId?: number) {
    let student: any = null;
    if (userId) {
      student = await this.prisma.student.findUnique({ where: { userId } });
      if (!student) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { studentProfile: true },
        });
        student = user?.studentProfile ?? null;
      }
    }

    const exams = await this.prisma.exam.findMany({
      where: { courseId },
      include: {
        course: true,
        questions: {
          select: {
            points: true,
          },
        },
        _count: { select: { attempts: true, comments: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            text: true,
            imageUrl: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        attempts: {
          where: { status: { not: ExamStatus.IN_PROGRESS } },
          select: {
            id: true,
            score: true,
            isRanked: true,
            timeTaken: true,
            completedAt: true,
            status: true,
            studentId: true,
            student: {
              select: {
                id: true,
                user: { select: { name: true, avatar: true } },
              },
            },
          },
          orderBy: { score: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!exams || exams.length === 0) throw new NotFoundException('No exams found for this course');

    return exams.map((exam) => {
      const formatted = this.formatExamCard(exam);
      let userAttempt: any = null;
      let remainingAttempts = exam.maxAttempts;
      let isCompleted = false;
      let isPassed = false;
      let score: number | null = null;

      if (student) {
        const studentAttempts = (exam.attempts || []).filter(
          (a) => a.studentId === student.id,
        );
        remainingAttempts = Math.max(0, exam.maxAttempts - studentAttempts.length);
        const bestAttempt = studentAttempts[0] || null;
        if (bestAttempt) {
          isCompleted = true;
          isPassed = bestAttempt.status === ExamStatus.PASSED;
          score = bestAttempt.score;
          userAttempt = {
            id: bestAttempt.id,
            score: bestAttempt.score,
            status: bestAttempt.status,
            completedAt: bestAttempt.completedAt,
          };
        }
      }

      return {
        ...formatted,
        remainingAttempts,
        isCompleted,
        isPassed,
        score,
        userAttempt,
      };
    });
  }

  async getHomeExams(userId: number, role: Role) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { courseId: true },
        },
      },
    });

    let enrolledCourseIds: number[] = [];
    if (student && student.enrollments.length > 0) {
      enrolledCourseIds = student.enrollments.map((e) => e.courseId);
    } else if (role === Role.ADMIN || role === Role.OWNER) {
      // For Admin/Owner without enrollments, fetch all courses for testing
      const allCourses = await this.prisma.course.findMany({ select: { id: true } });
      enrolledCourseIds = allCourses.map((c) => c.id);
    } else {
      return [];
    }

    if (enrolledCourseIds.length === 0) {
      return [];
    }

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const exams = await this.prisma.exam.findMany({
      where: {
        OR: [
          {
            courseId: { in: enrolledCourseIds },
            course: { isPaid: false },
          },
          {
            lesson: {
              status: LessonStatus.PUBLISHED,
              module: {
                courseId: { in: enrolledCourseIds },
                course: { isPaid: false },
              },
            },
          },
        ],
        // لا تقم بإظهار الاختبارات التي ليس لها زمن محدد (بداية ونهاية) ضمن الصفحة الرئيسية
        startTime: { not: null },
        endTime: { not: null, gte: twelveHoursAgo },
        examType: { notIn: [ExamType.FINAL_EXAM] },
      },
      include: {
        course: true,
        lesson: { include: { module: { include: { course: true } } } },
        questions: {
          select: {
            points: true,
          },
        },
        _count: { select: { attempts: true, comments: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            text: true,
            imageUrl: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        attempts: {
          where: { status: { not: ExamStatus.IN_PROGRESS } },
          select: {
            id: true,
            score: true,
            isRanked: true,
            timeTaken: true,
            completedAt: true,
            student: {
              select: {
                id: true,
                user: { select: { name: true, avatar: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const nonPaidExams = exams.filter((exam) => {
      const course = exam.course || exam.lesson?.module?.course;
      if (course?.isPaid) return false;
      if (!exam.startTime || !exam.endTime) return false;
      if (exam.examType === ExamType.FINAL_EXAM) return false;
      return true;
    });

    const formatted = nonPaidExams.map((exam) => this.formatExamCard(exam));

    // Sort order: ONGOING (1), UPCOMING (2), ENDED (3)
    const statusPriority: Record<string, number> = {
      ONGOING: 1,
      UPCOMING: 2,
      ENDED: 3,
    };

    const sorted = formatted.sort((a, b) => {
      const priorityDiff = statusPriority[a.timeStatus] - statusPriority[b.timeStatus];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.timeStatus === 'UPCOMING') {
        // الاختبار الأقرب للبدء له الأولوية (الذي يبدأ بعد ساعة يظهر قبل الذي يبدأ بعد ساعتين)
        const startA = a.startTime ? new Date(a.startTime).getTime() : Infinity;
        const startB = b.startTime ? new Date(b.startTime).getTime() : Infinity;
        if (startA !== startB) return startA - startB;
      } else if (a.timeStatus === 'ONGOING') {
        // الاختبار الجاري الذي ينتهي قريباً له أولوية
        const endA = a.endTime ? new Date(a.endTime).getTime() : Infinity;
        const endB = b.endTime ? new Date(b.endTime).getTime() : Infinity;
        if (endA !== endB) return endA - endB;
      } else if (a.timeStatus === 'ENDED') {
        // الاختبار المنتهي حديثاً يظهر أولاً بين المنتهية
        const endA = a.endTime ? new Date(a.endTime).getTime() : 0;
        const endB = b.endTime ? new Date(b.endTime).getTime() : 0;
        if (endA !== endB) return endB - endA;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // إرجاع 7 اختبارات كحد أقصى للصفحة الرئيسية
    return sorted.slice(0, 7);
  }

  async startExam(studentUserId: number, examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        lesson: { include: { module: { include: { course: true } } } },
        course: true,
      },
    });
    if (!exam) throw new NotFoundException('الاختبار غير موجود');

    if (exam.lesson?.status === LessonStatus.DRAFT) {
      throw new NotFoundException('الاختبار غير متاح حالياً');
    }

    const now = new Date();
    const hasEndTime = exam.endTime !== null && exam.endTime !== undefined;
    const isEnded = Boolean(exam.endTime && new Date(exam.endTime) <= now);

    // 1. التحقق من مواعيد بدء الاختبار (Start time check)
    if (exam.startTime && new Date(exam.startTime) > now) {
      const formattedStartTime = new Date(exam.startTime).toLocaleString('ar-SA');
      throw new ForbiddenException(
        `الاختبار لم يبدأ بعد. موعد البدء: ${formattedStartTime}`,
      );
    }

    // 2. التحقق من صلاحيات الطالب / الأدمن
    const user = await this.prisma.user.findUnique({
      where: { id: studentUserId },
      include: { teacherProfile: true },
    });
    const isStaff = user?.role === Role.OWNER || user?.role === Role.ADMIN;

    // 3. جلب ملف الطالب
    let student = await this.prisma.student.findUnique({ where: { userId: studentUserId } });
    if (!student) {
      student = await this.prisma.student
        .create({ data: { userId: studentUserId, academicId: `STU-${Date.now()}-${studentUserId}` } })
        .catch(() => null);
      if (!student) throw new NotFoundException('لم يتم العثور على ملف الطالب');
    }

    // 4. فحص المحاولات السابقة والمدة المحددة (Attempts & Duration check)
    const allAttempts = await this.prisma.examAttempt.findMany({
      where: { examId, studentId: student.id },
      orderBy: { startedAt: 'desc' },
    });

    let activeAttempt: any = null;
    const completedAttempts: any[] = [];

    for (const att of allAttempts) {
      if (att.status === ExamStatus.IN_PROGRESS) {
        // التحقق مما إذا كانت المحاولة الجارية قد انتهت مدتها
        if (exam.timeLimit && exam.timeLimit > 0) {
          const elapsedMs = now.getTime() - att.startedAt.getTime();
          const limitMs = exam.timeLimit * 60 * 1000;
          if (elapsedMs > limitMs) {
            const updated = await this.prisma.examAttempt.update({
              where: { id: att.id },
              data: {
                status: ExamStatus.FAILED,
                completedAt: new Date(att.startedAt.getTime() + limitMs),
                timeTaken: limitMs,
              },
            });
            completedAttempts.push(updated);
            continue;
          }
        }
        if (!activeAttempt) {
          activeAttempt = att;
        } else {
          // أي محاولة جارية قديمة إضافية تغلق كراسبة
          await this.prisma.examAttempt.update({
            where: { id: att.id },
            data: { status: ExamStatus.FAILED, completedAt: now },
          });
        }
      } else {
        completedAttempts.push(att);
      }
    }

    // التحقق من استنفاد عدد المحاولات المسموح بها أثناء فترة الاختبار (Max attempts check)
    if (!activeAttempt && !isEnded && completedAttempts.length >= exam.maxAttempts) {
      if (hasEndTime) {
        throw new ForbiddenException(
          `لقد استنفدت جميع المحاولات المسموح بها لهذا الاختبار (${completedAttempts.length}/${exam.maxAttempts}) خلال الفترة الحالية. يمكنك إعادة خوض الاختبار بعد انتهاء المدة المحددة للاختبار.`,
        );
      } else {
        throw new ForbiddenException(
          `لقد استنفدت جميع المحاولات المسموح بها لهذا الاختبار (${completedAttempts.length}/${exam.maxAttempts}).`,
        );
      }
    }

    // 5. التحقق من المتطلبات السابقة للاختبار (Prerequisites check)
    if (!isStaff) {
      const prerequisiteCheck = await this.checkExamPrerequisites(student.id, exam);
      if (!prerequisiteCheck.isUnlocked) {
        throw new ForbiddenException(prerequisiteCheck.lockedReason);
      }
    }

    // 6. التحقق من وجود أسئلة للاختبار
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

    if (!questions || questions.length === 0) {
      throw new BadRequestException('لا توجد أسئلة مضافة لهذا الاختبار حالياً');
    }

    // 7. تحديد التصنيف في الـ Leaderboard
    const hasRankedAttempt = allAttempts.some((a) => a.isRanked);
    const shouldBeRanked = !hasRankedAttempt && !isEnded;

    // 8. استخدام المحاولة الجارية إذا كانت فعالة، أو إنشاء محاولة جديدة
    let attempt = activeAttempt;
    if (!attempt) {
      attempt = await this.prisma.examAttempt.create({
        data: {
          studentId: student.id,
          examId: exam.id,
          status: ExamStatus.IN_PROGRESS,
          isRanked: shouldBeRanked,
        },
      });
    }

    const totalPoints = questions.reduce(
      (sum: number, q: { points: number }) => sum + q.points,
      0,
    );
    const passingPoints = totalPoints > 0 ? Math.ceil((exam.passingScore / 100) * totalPoints) : 0;
    const remainingAttempts = isEnded
      ? 0
      : Math.max(0, exam.maxAttempts - (completedAttempts.length + 1));

    return {
      message: 'Exam started successfully',
      attemptId: attempt.id,
      isRanked: attempt.isRanked,
      isEnded,
      timeLimitMinutes: exam.timeLimit,
      passingScore: exam.passingScore,
      passingPoints,
      minPassingScore: passingPoints,
      totalPoints,
      totalQuestions: questions.length,
      remainingAttempts,
      maxAttempts: exam.maxAttempts,
      startedAt: attempt.startedAt,
      questions,
    };
  }

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

    const now = new Date();
    const timeTakenMs = now.getTime() - attempt.startedAt.getTime();



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

    if (status === ExamStatus.PASSED && attempt.exam.lessonId) {
      await this.prisma.lessonProgress.upsert({
        where: {
          studentId_lessonId: { studentId: student.id, lessonId: attempt.exam.lessonId },
        },
        update: { isCompleted: true, completedAt: now },
        create: { studentId: student.id, lessonId: attempt.exam.lessonId, isCompleted: true, completedAt: now },
      });
    }

    // Auto-grade assignment submission if this exam is linked to an assignment
    if (student) {
      const assignment = await this.prisma.assignment.findFirst({
        where: {
          OR: [
            { examId: attempt.examId },
            ...(attempt.exam.lessonId ? [{ lessonId: attempt.exam.lessonId, type: AssignmentType.QUIZ }] : []),
          ],
        },
      });

      if (assignment) {
        const assignmentScore = Math.round((percentage / 100) * assignment.maxScore);
        await this.prisma.assignmentSubmission.upsert({
          where: {
            assignmentId_studentId: {
              assignmentId: assignment.id,
              studentId: student.id,
            },
          },
          update: {
            score: assignmentScore,
            status: SubmissionStatus.GRADED,
            gradedAt: now,
            content: `تم إتمام الكويز التلقائي بنسبة ${Math.round(percentage)}% (${score}/${totalPoints})`,
          },
          create: {
            assignmentId: assignment.id,
            studentId: student.id,
            score: assignmentScore,
            status: SubmissionStatus.GRADED,
            gradedAt: now,
            content: `تم إتمام الكويز التلقائي بنسبة ${Math.round(percentage)}% (${score}/${totalPoints})`,
          },
        });
      }
    }

    const updatedAttempt = await this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { score, status, completedAt: now, timeTaken: timeTakenMs },
      include: { exam: { select: { title: true, passingScore: true } } },
    });

    const passingPoints = totalPoints > 0 ? Math.ceil((attempt.exam.passingScore / 100) * totalPoints) : 0;

    // إرسال إشعار فوري بالترتيب والدرجة للاختبارات المنتهية (يُستثنى كويز الدرس LESSON_QUIZ بالكامل من الإشعارات)
    const isEnded = Boolean(attempt.exam.endTime && new Date(attempt.exam.endTime) <= now);
    const hasNoFutureEnd = !attempt.exam.endTime || isEnded;

    if (hasNoFutureEnd && student && attempt.exam.examType !== ExamType.LESSON_QUIZ) {
      try {
        const allRanked = await this.prisma.examAttempt.findMany({
          where: {
            examId: attempt.examId,
            isRanked: true,
            status: { not: ExamStatus.IN_PROGRESS },
          },
          select: {
            id: true,
            score: true,
            timeTaken: true,
            completedAt: true,
            startedAt: true,
            student: { select: { id: true, userId: true, user: { select: { name: true, avatar: true } } } },
          },
        });

        const sorted = sortByRankingCriteria(allRanked as any, attempt.exam.rankingCriteria);
        const myRankIndex = sorted.findIndex((a) => a.id === attempt.id || a.student.id === student!.id);
        const rank = myRankIndex >= 0 ? myRankIndex + 1 : 1;

        await this.notificationsService.notifyExamResult(
          studentUserId,
          attempt.examId,
          attempt.exam.title,
          rank,
          score,
          totalPoints,
          Math.round(percentage),
        );
      } catch (err) {
        // عدم تعطيل تسليم الاختبار في حال حدوث خطأ في الإشعار
      }
    }

    return {
      ...updatedAttempt,
      totalPoints,
      percentage: Math.round(percentage),
      passingScore: attempt.exam.passingScore,
      passingPoints,
      minPassingScore: passingPoints,
    };
  }

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
        exam: { include: { questions: { include: { options: true } } } },
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

    const totalPoints = attempt.exam.questions.reduce(
      (sum: number, q: { points: number }) => sum + q.points,
      0,
    );
    const percentage = totalPoints > 0 ? Math.round((attempt.score / totalPoints) * 100) : 0;
    const passingPoints = totalPoints > 0 ? Math.ceil((attempt.exam.passingScore / 100) * totalPoints) : 0;

    return {
      ...attempt,
      totalPoints,
      percentage,
      passingScore: attempt.exam.passingScore,
      passingPoints,
      minPassingScore: passingPoints,
    };
  }
}
