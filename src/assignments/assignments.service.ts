import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadcareStorageService } from 'src/utils/uploadcare-storage.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { Role, SubmissionStatus, AssignmentType } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: UploadcareStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * التحقق من صلاحية المعلم/الأدمن على الدورة
   */
  private async checkTeacherPermission(
    courseId: number,
    instructorId: number,
    userId: number,
    role: Role,
  ) {
    if (role === Role.OWNER || role === Role.ADMIN) return true;

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher || teacher.id !== instructorId) {
      throw new ForbiddenException('غير مصرح لك بإدارة تكليفات هذا الكورس');
    }
    return true;
  }

  /**
   * معالجة وتدقيق تاريخ التسليم (dueDate) مع دعم التصحيح التلقائي للأيام/الأشهر ذات الخانة الواحدة
   */
  private parseDueDate(rawDate?: string | Date | null): Date | null {
    if (!rawDate) return null;
    if (typeof rawDate === 'string') {
      const trimmed = rawDate.trim();
      if (!trimmed) return null;

      // تصحيح تلقائي لصيغة التاريخ في حال كُتب اليوم أو الشهر بخانة واحدة (مثل 2026-11-8 أو 2026-5-9)
      const normalized = trimmed.replace(
        /^(\d{4})-(\d{1,2})-(\d{1,2})/,
        (_, y, m, d) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      );

      const parsed = new Date(normalized);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } else if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return rawDate;
    }

    throw new BadRequestException(
      'تاريخ التسليم (dueDate) غير صالح. يرجى إدخال تاريخ صالح بصيغة ISO مثل: 2026-11-08T23:59:59.000Z',
    );
  }

  /**
   * إنشاء تكليف جديد لدرس معين
   */
  async create(userId: number, role: Role, dto: CreateAssignmentDto, attachmentFile?: Express.Multer.File) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      include: {
        module: {
          include: { course: true },
        },
        assignment: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException(`الدرس برقم ${dto.lessonId} غير موجود`);
    }

    if (lesson.assignment) {
      throw new BadRequestException('يوجد تكليف مضاف بالفعل لهذا الدرس، يمكنك تعديله بدلاً من إنشاء جديد');
    }

    await this.checkTeacherPermission(
      lesson.module.course.id,
      lesson.module.course.instructorId,
      userId,
      role,
    );

    let attachmentUrl = dto.attachmentUrl;
    if (attachmentFile) {
      attachmentUrl = await this.storageService.upload(attachmentFile, 'assignments');
    }

    if (dto.examId) {
      const exam = await this.prisma.exam.findUnique({ where: { id: dto.examId } });
      if (!exam) {
        throw new NotFoundException(`الاختبار برقم ${dto.examId} غير موجود`);
      }
    }

    const dueDate = this.parseDueDate(dto.dueDate);

    return this.prisma.assignment.create({
      data: {
        lessonId: dto.lessonId,
        title: dto.title,
        description: dto.description,
        type: dto.type || AssignmentType.TASK,
        maxScore: dto.maxScore ?? 100,
        dueDate,
        attachmentUrl,
        examId: dto.examId || null,
      },
      include: {
        exam: {
          select: { id: true, title: true, passingScore: true, timeLimit: true },
        },
      },
    });
  }

  /**
   * تعديل تكليف
   */
  async update(
    userId: number,
    role: Role,
    id: number,
    dto: UpdateAssignmentDto,
    attachmentFile?: Express.Multer.File,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        lesson: {
          include: {
            module: { include: { course: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`التكليف برقم ${id} غير موجود`);
    }

    await this.checkTeacherPermission(
      assignment.lesson.module.course.id,
      assignment.lesson.module.course.instructorId,
      userId,
      role,
    );

    let attachmentUrl = dto.attachmentUrl !== undefined ? dto.attachmentUrl : assignment.attachmentUrl;
    if (attachmentFile) {
      attachmentUrl = await this.storageService.upload(attachmentFile, 'assignments');
    }

    const data: any = { ...dto };
    if (attachmentUrl !== undefined) data.attachmentUrl = attachmentUrl;
    if (dto.dueDate !== undefined) {
      data.dueDate = this.parseDueDate(dto.dueDate);
    }

    return this.prisma.assignment.update({
      where: { id },
      data,
      include: {
        exam: {
          select: { id: true, title: true, passingScore: true, timeLimit: true },
        },
      },
    });
  }

  /**
   * حذف تكليف
   */
  async delete(userId: number, role: Role, id: number) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        lesson: {
          include: {
            module: { include: { course: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`التكليف برقم ${id} غير موجود`);
    }

    await this.checkTeacherPermission(
      assignment.lesson.module.course.id,
      assignment.lesson.module.course.instructorId,
      userId,
      role,
    );

    await this.prisma.assignment.delete({ where: { id } });
    return { message: 'تم حذف التكليف بنجاح' };
  }

  /**
   * جلب تكليف لدرس معين
   */
  async findByLessonId(lessonId: number, userId?: number, role?: Role) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { id: true, isPaid: true, instructorId: true } },
          },
        },
      },
    });

    if (!lesson) {
      return null;
    }

    // إذا كان الكورس مدفوعاً، التحقق من صلاحية الوصول
    if (lesson.module?.course?.isPaid) {
      let isExempt = role === Role.ADMIN || role === Role.OWNER;
      if (!isExempt && userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { studentProfile: true, teacherProfile: true },
        });
        if (user?.role === Role.ADMIN || user?.role === Role.OWNER) {
          isExempt = true;
        } else if (user?.teacherProfile && user.teacherProfile.id === lesson.module.course.instructorId) {
          isExempt = true;
        } else if (user?.studentProfile) {
          const enrollment = await this.prisma.enrollment.findUnique({
            where: {
              studentId_courseId: {
                studentId: user.studentProfile.id,
                courseId: lesson.module.course.id,
              },
            },
          });
          if (enrollment && enrollment.status === 'ACTIVE') {
            isExempt = true;
          }
        }
      }

      if (!isExempt) {
        // حجب التكليف لغير المشتركين في الدورة المدفوعة
        return null;
      }
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { lessonId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            timeLimit: true,
            examType: true,
          },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!assignment) {
      return null;
    }

    let mySubmission = null;
    if (userId) {
      const student = await this.prisma.student.findUnique({
        where: { userId },
      });
      if (student) {
        mySubmission = await this.prisma.assignmentSubmission.findUnique({
          where: {
            assignmentId_studentId: {
              assignmentId: assignment.id,
              studentId: student.id,
            },
          },
          include: {
            gradedBy: {
              select: { id: true, name: true, avatar: true },
            },
          },
        });
      }
    }

    return {
      ...assignment,
      submissionsCount: assignment._count.submissions,
      mySubmission,
    };
  }

  /**
   * جلب تفاصيل تكليف بواسطة ID
   */
  async findOne(id: number, userId?: number) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            moduleId: true,
            module: {
              select: {
                id: true,
                title: true,
                courseId: true,
                course: { select: { id: true, isPaid: true, instructorId: true } },
              },
            },
          },
        },
        exam: true,
        _count: { select: { submissions: true } },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`التكليف برقم ${id} غير موجود`);
    }

    // التحقق من اشتراك الطالب إذا كان الكورس مدفوعاً
    const course = assignment.lesson?.module?.course;
    if (course?.isPaid) {
      let isExempt = false;
      if (userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { studentProfile: true, teacherProfile: true },
        });
        if (user?.role === Role.ADMIN || user?.role === Role.OWNER) {
          isExempt = true;
        } else if (user?.teacherProfile && user.teacherProfile.id === course.instructorId) {
          isExempt = true;
        } else if (user?.studentProfile) {
          const enrollment = await this.prisma.enrollment.findUnique({
            where: {
              studentId_courseId: {
                studentId: user.studentProfile.id,
                courseId: course.id,
              },
            },
          });
          if (enrollment && enrollment.status === 'ACTIVE') {
            isExempt = true;
          }
        }
      }

      if (!isExempt) {
        throw new ForbiddenException('التكليفات متاحة فقط للمشتركين النشطين في هذه الدورة');
      }
    }

    let mySubmission = null;
    if (userId) {
      const student = await this.prisma.student.findUnique({ where: { userId } });
      if (student) {
        mySubmission = await this.prisma.assignmentSubmission.findUnique({
          where: {
            assignmentId_studentId: { assignmentId: id, studentId: student.id },
          },
          include: {
            gradedBy: { select: { id: true, name: true, avatar: true } },
          },
        });
      }
    }

    return {
      ...assignment,
      submissionsCount: assignment._count.submissions,
      mySubmission,
    };
  }

  /**
   * تسليم الطالب للتكليف (أو تعديل التسليم إذا لم يتم تصحيحه)
   */
  async submitAssignment(
    userId: number,
    assignmentId: number,
    dto: SubmitAssignmentDto,
    file?: Express.Multer.File,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  include: {
                    teacher: { select: { id: true, userId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`التكليف برقم ${assignmentId} غير موجود`);
    }

    // جلب أو إنشاء بروفايل الطالب
    let student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      student = await this.prisma.student.create({
        data: {
          userId,
          academicId: `STU-${Date.now()}-${userId}`,
        },
      });
    }

    // التحقق من اشتراك الطالب في الدورة إذا كانت مدفوعة
    const course = assignment.lesson.module.course;
    if (course.isPaid) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: student.id,
            courseId: course.id,
          },
        },
      });

      if (!enrollment || enrollment.status !== 'ACTIVE') {
        throw new ForbiddenException('يجب أن يكون اشتراكك مفعلاً ونشطاً في الكورس لتتمكن من تسليم التكليف');
      }
    }

    // رفع الملف إن وجد
    let fileUrl = dto.fileUrl;
    if (file) {
      fileUrl = await this.storageService.upload(file, 'assignments');
    }

    if (!dto.content && !fileUrl) {
      throw new BadRequestException('يجب تقديم نص الإجابة أو رفع ملف مرفق لتسليم التكليف');
    }

    // فحص ما إذا كان الطالب سلم مسبقاً
    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: student.id,
        },
      },
    });

    if (existing && existing.status === SubmissionStatus.GRADED) {
      throw new BadRequestException('تم تصحيح هذا التكليف بالفعل، لا يمكن إعادة التسليم إلا إذا طلب المعلم ذلك');
    }

    const submission = existing
      ? await this.prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            content: dto.content !== undefined ? dto.content : existing.content,
            fileUrl: fileUrl !== undefined ? fileUrl : existing.fileUrl,
            submittedAt: new Date(),
            status: SubmissionStatus.SUBMITTED,
          },
        })
      : await this.prisma.assignmentSubmission.create({
          data: {
            assignmentId,
            studentId: student.id,
            content: dto.content,
            fileUrl,
            submittedAt: new Date(),
            status: SubmissionStatus.SUBMITTED,
          },
        });

    // إرسال إشعار مباشر للمعلم بتسليم التكليف (إشعار مباشر لا يظهر كتعليق في الدرس)
    try {
      const teacherUserId = course.teacher?.userId;
      if (teacherUserId && teacherUserId !== userId) {
        const isResubmissionRequested =
          existing && existing.status === SubmissionStatus.RESUBMISSION_REQUESTED;

        // فحص عدم التكرار والإزعاج (15 دقيقة تبريد عند تكرار التعديل السريع)
        const hasRecent = await this.notificationsService.hasRecentAssignmentNotification(
          userId,
          teacherUserId,
          assignment.lessonId,
        );

        if (!hasRecent || isResubmissionRequested) {
          const studentUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          const studentName = studentUser?.name || 'طالب';

          await this.notificationsService.notifyAssignmentSubmission(
            userId,
            teacherUserId,
            studentName,
            assignment.title,
            assignment.lesson.title,
            course.title,
            assignment.lessonId,
          );
        }
      }
    } catch (notifErr) {
      this.logger.error(`Failed to send assignment submission notification: ${notifErr.message}`);
    }

    return submission;
  }

  /**
   * جلب تسليم الطالب الحالي لتكليف معين
   */
  async getMySubmission(userId: number, assignmentId: number) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) {
      return null;
    }

    return this.prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: student.id,
        },
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            dueDate: true,
          },
        },
        gradedBy: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * جلب جميع تسليمات تكليف معين للمعلم/الأدمن
   */
  async findSubmissions(
    userId: number,
    role: Role,
    assignmentId: number,
    page: number = 1,
    limit: number = 20,
    status?: SubmissionStatus,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        lesson: {
          include: {
            module: { include: { course: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`التكليف برقم ${assignmentId} غير موجود`);
    }

    await this.checkTeacherPermission(
      assignment.lesson.module.course.id,
      assignment.lesson.module.course.instructorId,
      userId,
      role,
    );

    const where: any = { assignmentId };
    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      this.prisma.assignmentSubmission.findMany({
        where,
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
          gradedBy: {
            select: { id: true, name: true, avatar: true },
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.assignmentSubmission.count({ where }),
    ]);

    return {
      data: submissions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * جلب تسليم محدد بواسطة ID
   */
  async getSubmissionById(userId: number, role: Role, submissionId: number) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            lesson: {
              include: {
                module: { include: { course: true } },
              },
            },
          },
        },
        student: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        gradedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`التسليم برقم ${submissionId} غير موجود`);
    }

    const course = submission.assignment.lesson.module.course;
    const isOwnerOrAdmin = role === Role.OWNER || role === Role.ADMIN;
    const isStudentOwner = submission.student.userId === userId;

    let isInstructor = false;
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (teacher && teacher.id === course.instructorId) {
      isInstructor = true;
    }

    if (!isOwnerOrAdmin && !isInstructor && !isStudentOwner) {
      throw new ForbiddenException('غير مصرح لك بالاطلاع على هذا التسليم');
    }

    return submission;
  }

  /**
   * تقييم وتصحيح تسليم الطالب من قبل المعلم
   */
  async gradeSubmission(
    userId: number,
    role: Role,
    submissionId: number,
    dto: GradeSubmissionDto,
    feedbackImageFile?: Express.Multer.File,
  ) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            lesson: {
              include: {
                module: { include: { course: true } },
              },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`التسليم برقم ${submissionId} غير موجود`);
    }

    const course = submission.assignment.lesson.module.course;
    await this.checkTeacherPermission(
      course.id,
      course.instructorId,
      userId,
      role,
    );

    if (dto.score > submission.assignment.maxScore) {
      throw new BadRequestException(
        `الدرجة المدخلة (${dto.score}) أكبر من الدرجة الكلية للتكليف (${submission.assignment.maxScore})`,
      );
    }

    let feedbackImageUrl = dto.feedbackImageUrl;
    if (feedbackImageFile) {
      feedbackImageUrl = await this.storageService.upload(feedbackImageFile, 'assignments');
    }

    const gradedSubmission = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback,
        feedbackImageUrl: feedbackImageUrl || submission.feedbackImageUrl,
        status: dto.status || SubmissionStatus.GRADED,
        gradedAt: new Date(),
        gradedById: userId,
      },
      include: {
        assignment: true,
        student: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        gradedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // إرسال إشعار للطالب في قسم الردود برد وتصحيح المعلم
    if (gradedSubmission.student?.user?.id) {
      const teacherName = gradedSubmission.gradedBy?.name || 'المعلم';
      await this.notificationsService.notifyAssignmentFeedback(
        gradedSubmission.student.user.id,
        userId,
        teacherName,
        gradedSubmission.assignment.title,
        dto.score,
        gradedSubmission.assignment.maxScore,
        dto.feedback,
        submission.assignment.lessonId,
      );
    }

    return gradedSubmission;
  }
}

