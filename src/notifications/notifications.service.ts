import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';

export type NotificationType =
  | 'COURSE_ENROLLMENT'
  | 'EXAM_RESULT'
  | 'ASSIGNMENT_FEEDBACK'
  | 'ASSIGNMENT_SUBMISSION'
  | 'NEW_LESSON'
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
}

