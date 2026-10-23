import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role, ExamType } from '@prisma/client';

export type NotificationType =
  | 'COURSE_ENROLLMENT'
  | 'EXAM_RESULT'
  | 'NEW_EXAM'
  | 'ASSIGNMENT_FEEDBACK'
  | 'ASSIGNMENT_SUBMISSION'
  | 'NEW_LESSON'
  | 'LIVE_LESSON'
  | 'SYSTEM'
  | 'REPLY'
  | 'MENTION';

export interface SendNotificationDto {
  recipientUserId: number;
  senderUserId?: number;
  message: string;
  type?: NotificationType;
  lessonId?: number;
  examId?: number;
  postId?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * دالة مساعدة لجلب معرف المسؤول أو المالك لضمان عدم ظهور الطالب كمرسل لإشعارات النظام
   */
  async getAdminUserId(): Promise<number> {
    const admin = await this.prisma.user.findFirst({
      where: { role: { in: [Role.OWNER, Role.ADMIN] } },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    return admin?.id || 1;
  }

  /**
   * دالة عامة لإرسال إشعار إلى أي مستخدم ليظهر في قسم الإشارات والردود
   */
  async sendNotification(dto: SendNotificationDto) {
    try {
      let senderId = dto.senderUserId;

      // إذا لم يُحدد مرسل، أو كان المرسل هو نفس المستلم بالخطأ، يتم استخدام حساب الأدمن أو المالك
      if (!senderId || senderId === dto.recipientUserId) {
        senderId = await this.getAdminUserId();
      }

      // إنشاء التعليق وربطه بإشارة للمستخدم المستهدف
      const comment = await this.prisma.comment.create({
        data: {
          userId: senderId,
          text: dto.message,
          lessonId: dto.lessonId || null,
          examId: dto.examId || null,
          mentions: {
            create: {
              mentionedUserId: dto.recipientUserId,
              isRead: false,
            },
          },
        },
        include: {
          mentions: true,
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      this.logger.log(
        `Notification [${dto.type || 'SYSTEM'}] sent to user ${dto.recipientUserId} by user ${senderId}`,
      );

      return comment;
    } catch (error) {
      this.logger.error(
        `Failed to send notification to user ${dto.recipientUserId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * إشعار تفعيل وقبول اشتراك كورس
   */
  async notifyCourseEnrollmentApproved(
    recipientUserId: number,
    courseTitle: string,
    reviewerUserId?: number,
    lessonId?: number,
  ) {
    let senderId = reviewerUserId;
    if (!senderId || senderId === recipientUserId) {
      senderId = await this.getAdminUserId();
    }

    const message = `🎉 تهانينا! تمت الموافقة على اشتراكك وتفعيل دورتك بنجاح في كورس: **${courseTitle}**. يمكنك الآن البدء في متابعة الدروس والوصول إلى كافة الملحقات.`;
    return this.sendNotification({
      recipientUserId,
      senderUserId: senderId,
      message,
      type: 'COURSE_ENROLLMENT',
      lessonId,
    });
  }

  /**
   * إشعار نتيجة وترتيب اختبار بعد انتهائه (فردي احتياطي)
   */
  async notifyExamResult(
    recipientUserId: number,
    examId: number,
    examTitle: string,
    rank: number,
    score: number,
    totalPoints: number,
    percentage: number,
  ) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        course: { include: { teacher: { select: { userId: true } } } },
        lesson: { include: { module: { include: { course: { include: { teacher: { select: { userId: true } } } } } } } },
      },
    });

    // استثناء كويز الدرس LESSON_QUIZ من إشعارات النتائج بالكامل
    if (exam?.examType === ExamType.LESSON_QUIZ) {
      return null;
    }

    const teacherUserId =
      exam?.course?.teacher?.userId ||
      exam?.lesson?.module?.course?.teacher?.userId;

    const message = `🏆 نتيجة الاختبار: لقد انتهى وقت اختبار **${examTitle}**، وحصلت على **المركز ${rank}** بنسبة **${percentage}%** (الدرجة: ${score}/${totalPoints}).`;
    return this.sendNotification({
      recipientUserId,
      senderUserId: teacherUserId,
      examId,
      message,
      type: 'EXAM_RESULT',
    });
  }

  /**
   * إشعار تصحيح المعلم لتكليف
   */
  async notifyAssignmentFeedback(
    recipientUserId: number,
    teacherUserId: number,
    teacherName: string,
    assignmentTitle: string,
    score: number,
    maxScore: number,
    feedback?: string,
    lessonId?: number,
  ) {
    const feedbackText = feedback && feedback.trim().length > 0
      ? `\n> 💬 ملاحظة المعلم: "${feedback.trim()}"`
      : '';
    const message = `📝 قام المعلم (${teacherName}) بالرد على تكليفك في **${assignmentTitle}** بالدرجة (**${score}/${maxScore}**).${feedbackText}`;

    return this.sendNotification({
      recipientUserId,
      senderUserId: teacherUserId,
      lessonId,
      message,
      type: 'ASSIGNMENT_FEEDBACK',
    });
  }

  /**
   * إشعار إضافة درس جديد للطلاب المسجلين في الكورس:
   * تعليق واحد رسمي فقط في قسم تعليقات الدرس مع إشارة جماعية (All-mention) للطلاب المسجلين فقط عدا الأدمن والمالك.
   * خالي تماماً من تكرار التعليقات وعالي الأداء عبر batch mention insert.
   */
  async notifyNewLessonToEnrolledStudents(
    teacherUserId: number,
    teacherName: string,
    courseId: number,
    courseTitle: string,
    lessonTitle: string,
    lessonId: number,
  ) {
    try {
      // 1. التحقق من عدم التكرار (منع تكرار التعليق إذا تم إرساله مسبقاً لهذا الدرس)
      const existingComment = await this.prisma.comment.findFirst({
        where: {
          lessonId,
          text: { contains: 'بإضافة درس جديد بعنوان' },
        },
        select: { id: true },
      });

      if (existingComment) {
        this.logger.log(`New lesson notification already exists for lesson ${lessonId}. Skipping.`);
        return existingComment;
      }

      // 2. جلب جميع الطلاب النشطين المسجلين في هذا الكورس فقط
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          courseId,
          status: 'ACTIVE',
        },
        select: {
          student: {
            select: { userId: true },
          },
        },
      });

      // استبعاد الأدمن والمالك والمعلم نفسه من قائمة المنشن ("يشير للكل عدا الأدمن")
      const adminUsers = await this.prisma.user.findMany({
        where: { role: { in: [Role.OWNER, Role.ADMIN] } },
        select: { id: true },
      });
      const excludedIds = new Set([teacherUserId, ...adminUsers.map((a) => a.id)]);

      // استخراج معرفات الطلاب المستهدفين فقط (استبعاد المعلم والأدمن والمالك)
      const recipientUserIds = enrollments
        .map((e) => e.student?.userId)
        .filter((uid): uid is number => !!uid && !excludedIds.has(uid));

      // 3. إنشاء تعليق رسمي واحد فقط في قسم التعليقات الخاص بالدرس
      // استخدام صيغة المنشن الجماعي @[الكل](all) ليظهر في التطبيق كمنشن للكل
      const message = `@[الكل](all) 📚 قام المعلم (${teacherName}) بإضافة درس جديد بعنوان **${lessonTitle}** في كورس **${courseTitle}**. تفضلوا بمشاهدة الدرس ومتابعة المحتوى!`;

      const comment = await this.prisma.comment.create({
        data: {
          userId: teacherUserId,
          text: message,
          lessonId,
          parentId: null,
        },
      });

      // 4. إنشاء إشارات (Mentions) للطلاب دفعة واحدة (Bulk insert) لضمان أعلى أداء
      if (recipientUserIds.length > 0) {
        const uniqueRecipientUserIds = Array.from(new Set(recipientUserIds));

        await this.prisma.mention.createMany({
          data: uniqueRecipientUserIds.map((userId) => ({
            commentId: comment.id,
            mentionedUserId: userId,
            isRead: false,
          })),
        });

        this.logger.log(
          `Posted 1 announcement comment and created ${uniqueRecipientUserIds.length} mentions for lesson ${lessonId}`,
        );
      }

      return comment;
    } catch (error) {
      this.logger.error(
        `Failed to broadcast new lesson notification for lesson ${lessonId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * إشعار بدء البث المباشر للطلاب المشتركين في الكورس المدفوع فقط:
   * تعليق واحد رسمي فقط في قسم تعليقات الدرس مع إشارة جماعية @[الكل](all) للطلاب المشتركين فقط.
   * استبعاد المعلم والأدمن والمالك، وخالي تماماً من التكرار.
   */
  async notifyLiveLessonStartedToEnrolledStudents(
    teacherUserId: number,
    teacherName: string,
    courseId: number,
    courseTitle: string,
    lessonTitle: string,
    lessonId: number,
  ) {
    try {
      // 1. التحقق من أن الكورس مدفوع (خاص بالمشتركين في الكورس المدفوع فقط)
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, isPaid: true, title: true },
      });

      if (!course || !course.isPaid) {
        this.logger.log(
          `Skipping live notification for course ${courseId} because it is not a paid course.`,
        );
        return null;
      }

      // 2. التحقق من عدم تكرار الإشعار لنفس الدرس
      const existingComment = await this.prisma.comment.findFirst({
        where: {
          lessonId,
          text: { contains: 'بدأ البث المباشر لدرس' },
        },
        select: { id: true },
      });

      if (existingComment) {
        this.logger.log(
          `Live lesson notification already exists for lesson ${lessonId}. Skipping.`,
        );
        return existingComment;
      }

      // 3. جلب جميع الطلاب النشطين المشتركين في هذا الكورس المدفوع
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          courseId,
          status: 'ACTIVE',
        },
        select: {
          student: {
            select: { userId: true },
          },
        },
      });

      // استبعاد الأدمن والمالك والمعلم نفسه من قائمة المنشن
      const adminUsers = await this.prisma.user.findMany({
        where: { role: { in: [Role.OWNER, Role.ADMIN] } },
        select: { id: true },
      });
      const excludedIds = new Set([teacherUserId, ...adminUsers.map((a) => a.id)]);

      // استخراج معرفات الطلاب المستهدفين فقط
      const recipientUserIds = enrollments
        .map((e) => e.student?.userId)
        .filter((uid): uid is number => !!uid && !excludedIds.has(uid));

      // 4. إنشاء تعليق رسمي واحد فقط في قسم التعليقات الخاص بالدرس مع إشارة للكل
      const finalCourseTitle = course.title || courseTitle || 'الكورس';
      const message = `@[الكل](all) 🔴 بدأ البث المباشر لدرس **${lessonTitle}** في كورس **${finalCourseTitle}** الآن! تفضلوا بالانضمام إلى المحاضرة التفاعلية المباشرة.`;

      const comment = await this.prisma.comment.create({
        data: {
          userId: teacherUserId,
          text: message,
          lessonId,
          parentId: null,
        },
      });

      // 5. إنشاء إشارات (Mentions) للطلاب المشتركين دفعة واحدة (Bulk insert)
      if (recipientUserIds.length > 0) {
        const uniqueRecipientUserIds = Array.from(new Set(recipientUserIds));

        await this.prisma.mention.createMany({
          data: uniqueRecipientUserIds.map((userId) => ({
            commentId: comment.id,
            mentionedUserId: userId,
            isRead: false,
          })),
        });

        this.logger.log(
          `Posted 1 live broadcast comment and created ${uniqueRecipientUserIds.length} mentions for lesson ${lessonId} (Course ${courseId})`,
        );
      }

      return comment;
    } catch (error) {
      this.logger.error(
        `Failed to broadcast live lesson notification for lesson ${lessonId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * إشعار إضافة اختبار جديد للطلاب المسجلين في الكورس (سواء كورس مجاني أو مدفوع):
   * تعليق واحد رسمي فقط في قسم تعليقات الاختبار مع إشارة جماعية @[الكل](all) لجميع الطلاب المسجلين عدا الأدمن والمالك والمعلم.
   * خالي تماماً من تكرار التعليقات وعالي الأداء عبر bulk mention insert.
   */
  async notifyNewExamToEnrolledStudents(
    teacherUserId: number,
    teacherName: string,
    courseId: number,
    courseTitle: string,
    examTitle: string,
    examId: number,
    examType?: ExamType,
  ) {
    try {
      // استثناء كويز الدرس LESSON_QUIZ بالكامل من إرسال الإشعارات
      if (examType === ExamType.LESSON_QUIZ) {
        this.logger.log(`Skipping notification broadcast for LESSON_QUIZ: ${examTitle} (ID: ${examId})`);
        return null;
      }

      // 1. التحقق من عدم التكرار (منع تكرار التعليق إذا تم إرساله مسبقاً لهذا الاختبار)
      const existingComment = await this.prisma.comment.findFirst({
        where: {
          examId,
          text: { contains: 'بإضافة اختبار جديد' },
        },
        select: { id: true },
      });

      if (existingComment) {
        this.logger.log(`New exam notification already exists for exam ${examId}. Skipping.`);
        return existingComment;
      }

      // 2. جلب جميع الطلاب النشطين المسجلين في هذا الكورس (سواء كورس مجاني أو مدفوع)
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          courseId,
          status: 'ACTIVE',
        },
        select: {
          student: {
            select: { userId: true },
          },
        },
      });

      // استبعاد الأدمن والمالك والمعلم نفسه من قائمة المنشن ("يشير للكل عدا الأدمن")
      const adminUsers = await this.prisma.user.findMany({
        where: { role: { in: [Role.OWNER, Role.ADMIN] } },
        select: { id: true },
      });
      const excludedIds = new Set([teacherUserId, ...adminUsers.map((a) => a.id)]);

      // استخراج معرفات الطلاب المستهدفين فقط (استبعاد المعلم والأدمن والمالك)
      const recipientUserIds = enrollments
        .map((e) => e.student?.userId)
        .filter((uid): uid is number => !!uid && !excludedIds.has(uid));

      // 3. تحديد نوع الاختبار ومسماه
      let examTypeName = 'اختبار جديد';
      if (examType === ExamType.FINAL_EXAM) {
        examTypeName = 'الاختبار النهائي';
      } else if (examType === ExamType.CHALLENGE) {
        examTypeName = 'تحدي جديد';
      } else if (examType === ExamType.COURSE_QUIZ) {
        examTypeName = 'كويز شامل للكورس';
      } else if (examType === ExamType.LESSON_QUIZ) {
        examTypeName = 'كويز درس';
      }

      // 4. إنشاء تعليق رسمي واحد فقط في قسم التعليقات الخاص بالاختبار
      // يتضمن المنشن الجماعي @[الكل](all) ليظهر في التطبيق كمنشن للكل
      const message = `@[الكل](all) 📝 قام المعلم (${teacherName}) بإضافة ${examTypeName} بعنوان **${examTitle}** في كورس **${courseTitle}**. تفضلوا ببدء الاختبار وحل الأسئلة! 🚀`;

      const comment = await this.prisma.comment.create({
        data: {
          userId: teacherUserId,
          text: message,
          examId,
          parentId: null,
        },
      });

      // 5. إنشاء إشارات (Mentions) للطلاب دفعة واحدة (Bulk insert) لضمان أعلى أداء
      if (recipientUserIds.length > 0) {
        const uniqueRecipientUserIds = Array.from(new Set(recipientUserIds));

        await this.prisma.mention.createMany({
          data: uniqueRecipientUserIds.map((userId) => ({
            commentId: comment.id,
            mentionedUserId: userId,
            isRead: false,
          })),
        });

        this.logger.log(
          `Posted 1 announcement comment and created ${uniqueRecipientUserIds.length} mentions for exam ${examId}`,
        );
      }

      return comment;
    } catch (error) {
      this.logger.error(
        `Failed to broadcast new exam notification for exam ${examId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * إشعار المعلم بتسليم الطالب لتكليف معين:
   * إشعار مباشر يصل إلى حساب المعلم ليظهر في قسم الإشارات والردود
   * مستبعد برمجياً من قسم التعليقات العامة للدرس لضمان الخصوصية وعدم التشويه.
   */
  async notifyAssignmentSubmission(
    studentUserId: number,
    teacherUserId: number,
    studentName: string,
    assignmentTitle: string,
    lessonTitle: string,
    courseTitle: string,
    lessonId: number,
  ) {
    try {
      const message = `📝 قام الطالب (${studentName}) بتسليم تكليف: **${assignmentTitle}** في درس **${lessonTitle}** (${courseTitle}). تفضل بالاطلاع وتصحيح التكليف.`;

      // إنشاء تعليق إشعاري داخلي مرتبط بالدرس لتمكين المعلم من الانتقال إليه عند النقر
      const comment = await this.prisma.comment.create({
        data: {
          userId: studentUserId,
          text: message,
          lessonId,
          examId: null,
          mentions: {
            create: {
              mentionedUserId: teacherUserId,
              isRead: false,
            },
          },
        },
        include: {
          mentions: true,
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      this.logger.log(
        `Assignment submission notification sent to teacher ${teacherUserId} from student ${studentUserId}`,
      );

      return comment;
    } catch (error) {
      this.logger.error(
        `Failed to send assignment submission notification to teacher ${teacherUserId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * فحص ما إذا تم إرسال إشعار تسليم مؤخراً لنفس التكليف من هذا الطالب للمعلم
   * لمنع تكرار الإشعارات والإزعاج إذا عدل الطالب الحل أكثر من مرة في وقت قصير (فترة تبريد 15 دقيقة)
   */
  async hasRecentAssignmentNotification(
    studentUserId: number,
    teacherUserId: number,
    lessonId: number,
  ): Promise<boolean> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existing = await this.prisma.comment.findFirst({
      where: {
        userId: studentUserId,
        lessonId,
        text: { contains: 'بتسليم تكليف' },
        createdAt: { gte: fifteenMinutesAgo },
        mentions: {
          some: {
            mentionedUserId: teacherUserId,
          },
        },
      },
    });
    return !!existing;
  }

  /**
   * إشعار إضافة درس جديد (دعم خلفي)
   */
  async notifyNewLesson(
    recipientUserId: number,
    teacherUserId: number,
    teacherName: string,
    courseTitle: string,
    lessonTitle: string,
    lessonId: number,
  ) {
    const message = `@[الكل](all) 📚 قام المعلم (${teacherName}) بإضافة درس جديد بعنوان **${lessonTitle}** في كورس **${courseTitle}**. اضغط هنا للانتقال إلى الدرس مباشرة وبدء المشاهدة!`;

    return this.sendNotification({
      recipientUserId,
      senderUserId: teacherUserId,
      lessonId,
      message,
      type: 'NEW_LESSON',
    });
  }

  /**
   * التحقق مما إذا كان الطالب قد استلم إشعار نتيجة هذا الاختبار مسبقاً لمنع التكرار
   */
  async hasExamNotification(recipientUserId: number, examId: number): Promise<boolean> {
    const existing = await this.prisma.mention.findFirst({
      where: {
        mentionedUserId: recipientUserId,
        comment: {
          examId,
          text: { contains: 'نتيجة الاختبار' },
        },
      },
    });
    return !!existing;
  }

  /**
   * إرسال إشعار عام لجميع الطلاب المشتركين في كورسات المعلم/الناشر (بدون ربطه بدرس أو اختبار)
   * يظهر في التطبيق كتعليق/إشعار عام وإذا ضغط عليه الطالب لا يحصل شيء
   */
  async notifyEnrolledStudentsOfMyCourses(
    userId: number,
    message: string,
    courseId?: number,
  ) {
    try {
      // 1. جلب بيانات المستخدم لمعرفة ملف المعلم وصلاحياته
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { teacherProfile: true },
      });

      if (!user) {
        throw new NotFoundException('المستخدم غير موجود');
      }

      const teacherId = user.teacherProfile?.id;
      const isOwner = user.role === Role.OWNER;

      // 2. تحديد فلتر الكورسات
      let courseWhere: any = {};
      if (courseId) {
        courseWhere.id = courseId;
        // إذا لم يكن المالك العام، نتحقق أن الكورس يخص هذا المعلم
        if (!isOwner) {
          if (!teacherId) {
            throw new ForbiddenException('ليس لديك ملف معلم لإرسال إشعارات لهذا الكورس');
          }
          courseWhere.instructorId = teacherId;
        }
      } else {
        if (teacherId) {
          courseWhere.instructorId = teacherId;
        } else if (!isOwner) {
          throw new ForbiddenException('ليس لديك كورسات خاصة بك لإرسال إشعار لطلابها');
        }
      }

      // 3. جلب جميع الطلاب النشطين المشتركين في هذه الكورسات
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          course: courseWhere,
          status: 'ACTIVE',
        },
        select: {
          student: {
            select: { userId: true },
          },
        },
      });

      // استخراج معرفات المستخدمين المستهدفين فريدة واستبعاد المعلم نفسه
      const recipientUserIds = Array.from(
        new Set(
          enrollments
            .map((e) => e.student?.userId)
            .filter((uid): uid is number => !!uid && uid !== userId),
        ),
      );

      if (recipientUserIds.length === 0) {
        return {
          success: true,
          message: 'لا يوجد طلاب مسجلين حالياً في هذه الكورسات',
          recipientsCount: 0,
        };
      }

      // 4. إنشاء التعليق العام (بدون lessonId وبدون examId)
      const comment = await this.prisma.comment.create({
        data: {
          userId,
          text: message,
          lessonId: null,
          examId: null,
          parentId: null,
        },
      });

      // 5. إنشاء إشارات (Mentions) لجميع الطلاب دفعة واحدة (Bulk insert) لأقصى كفاءة وأداء
      await this.prisma.mention.createMany({
        data: recipientUserIds.map((targetUserId) => ({
          commentId: comment.id,
          mentionedUserId: targetUserId,
          isRead: false,
        })),
      });

      this.logger.log(
        `Broadcast notification sent by user ${userId} to ${recipientUserIds.length} enrolled students.`,
      );

      return {
        success: true,
        message: `تم إرسال الإشعار بنجاح إلى ${recipientUserIds.length} طالب`,
        recipientsCount: recipientUserIds.length,
        commentId: comment.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to broadcast notification to enrolled students: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

