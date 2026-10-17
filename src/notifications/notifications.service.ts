import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';

export type NotificationType =
  | 'COURSE_ENROLLMENT'
  | 'EXAM_RESULT'
  | 'ASSIGNMENT_FEEDBACK'
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
   * دالة عامة لإرسال إشعار إلى أي مستخدم ليظهر في قسم الإشارات والردود
   */
  async sendNotification(dto: SendNotificationDto) {
    try {
      let senderId = dto.senderUserId;

      // إذا لم يُحدد مرسل، يتم استخدام حساب الأدمن أو المالك
      if (!senderId) {
        const admin = await this.prisma.user.findFirst({
          where: { role: { in: [Role.OWNER, Role.ADMIN] } },
          select: { id: true },
        });
        senderId = admin?.id || dto.recipientUserId;
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
    const message = `🎉 تهانينا! تمت الموافقة على اشتراكك وتفعيل دورتك بنجاح في كورس: **${courseTitle}**. يمكنك الآن البدء في متابعة الدروس والوصول إلى كافة الملحقات.`;
    return this.sendNotification({
      recipientUserId,
      senderUserId: reviewerUserId,
      message,
      type: 'COURSE_ENROLLMENT',
      lessonId,
    });
  }

  /**
   * إشعار نتيجة وترتيب اختبار بعد انتهائه
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
    const message = `🏆 نتيجة الاختبار: لقد انتهى وقت اختبار **${examTitle}**، وحصلت على **المركز ${rank}** بنسبة **${percentage}%** (الدرجة: ${score}/${totalPoints}).`;
    return this.sendNotification({
      recipientUserId,
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
   * إشعار إضافة درس جديد للطلاب المسجلين في الكورس
   */
  async notifyNewLesson(
    recipientUserId: number,
    teacherUserId: number,
    teacherName: string,
    courseTitle: string,
    lessonTitle: string,
    lessonId: number,
  ) {
    const message = `📚 قام المعلم (${teacherName}) بإضافة درس جديد بعنوان **${lessonTitle}** في كورس **${courseTitle}**. اضغط هنا للانتقال إلى الدرس مباشرة وبدء المشاهدة!`;

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

