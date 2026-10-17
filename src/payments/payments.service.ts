import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { PaymentStatus } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Helper to ensure user has a student profile
   */
  private async getOrCreateStudent(userId: number) {
    let student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('المستخدم غير موجود');
      }
      student = await this.prisma.student.create({
        data: {
          userId,
          academicId: `STU-${Date.now()}-${userId}`,
        },
      });
    }

    return student;
  }

  /**
   * Student submits a payment receipt
   */
  async submitPayment(userId: number, dto: SubmitPaymentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    if (!user.emailVerified && user.role === 'STUDENT') {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'يجب تأكيد حسابك عبر البريد الإلكتروني أولاً قبل إرسال سند الدفع أو شراء الكورس.',
        action: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }

    const student = await this.getOrCreateStudent(userId);

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });

    if (!course) {
      throw new NotFoundException('الكورس المحدد غير موجود');
    }

    if (!course.isPaid) {
      throw new BadRequestException('هذا الكورس مجاني ومتاح للتسجيل الفوري المباشر دون الحاجة لرفع سند دفع');
    }

    // Check if already actively enrolled
    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: student.id,
          courseId: dto.courseId,
        },
      },
    });

    if (existingEnrollment && existingEnrollment.status === 'ACTIVE') {
      throw new ConflictException('أنت مسجل ومفعل في هذا الكورس بالفعل');
    }

    // Check if there is already a PENDING payment for this course
    const pendingPayment = await this.prisma.payment.findFirst({
      where: {
        studentId: student.id,
        courseId: dto.courseId,
        status: PaymentStatus.PENDING,
      },
    });

    if (pendingPayment) {
      throw new ConflictException('لديك طلب دفع قيد المراجعة بالفعل لهذا الكورس. يرجى انتظار تدقيق الإدارة.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        studentId: student.id,
        courseId: dto.courseId,
        amount: dto.amount,
        receiptUrl: dto.receiptUrl,
        notes: dto.notes,
        status: PaymentStatus.PENDING,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
            discountedPrice: true,
            courseType: true,
          },
        },
      },
    });

    return {
      message: 'تم إرسال طلب الدفع وسند التحويل بنجاح، سيتم تدقيقه من قبل الإدارة وتفعيل اشتراكك قريباً.',
      payment,
    };
  }

  /**
   * Get payments submitted by the current student
   */
  async getMyPaymentRequests(userId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) return [];

    return this.prisma.payment.findMany({
      where: { studentId: student.id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            price: true,
            discountedPrice: true,
            courseType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get latest payment status for a specific course for the student
   */
  async getCoursePaymentStatus(userId: number, courseId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      return { status: null, payment: null };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        studentId: student.id,
        courseId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: payment ? payment.status : null,
      payment,
    };
  }

  /**
   * Admin: List pending payments for review
   */
  async getPendingPayments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PENDING },
        include: {
          student: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              price: true,
              discountedPrice: true,
              courseType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({
        where: { status: PaymentStatus.PENDING },
      }),
    ]);

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: List all payments with optional status filter
   */
  async getAllPayments(status?: PaymentStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          student: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              price: true,
              discountedPrice: true,
              courseType: true,
            },
          },
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: Approve payment and automatically activate enrollment
   */
  async approvePayment(paymentId: number, reviewerUserId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('طلب الدفع غير موجود');
    }

    if (payment.status === PaymentStatus.APPROVED) {
      throw new ConflictException('تمت الموافقة على هذا الطلب مسبقاً وتفعيل الاشتراك');
    }

    const [updatedPayment, enrollment] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.APPROVED,
          reviewedById: reviewerUserId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
        include: {
          course: {
            select: { id: true, title: true },
          },
          student: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      this.prisma.enrollment.upsert({
        where: {
          studentId_courseId: {
            studentId: payment.studentId,
            courseId: payment.courseId,
          },
        },
        create: {
          studentId: payment.studentId,
          courseId: payment.courseId,
          status: 'ACTIVE',
        },
        update: {
          status: 'ACTIVE',
        },
      }),
    ]);

    // إرسال إشعار للمستخدم في قسم الردود بنجاح قبول الاشتراك
    if (updatedPayment.student?.user?.id) {
      const firstLesson = await this.prisma.lesson.findFirst({
        where: { module: { courseId: updatedPayment.courseId } },
        orderBy: { order: 'asc' },
        select: { id: true },
      });

      await this.notificationsService.notifyCourseEnrollmentApproved(
        updatedPayment.student.user.id,
        updatedPayment.course.title,
        reviewerUserId,
        firstLesson?.id,
      );
    }

    return {
      message: 'تم قبول سند الدفع وتفعيل اشتراك الطالب في الكورس بنجاح.',
      payment: updatedPayment,
      enrollment,
    };
  }

  /**
   * Admin: Reject payment with reason
   */
  async rejectPayment(paymentId: number, reviewerUserId: number, dto: RejectPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('طلب الدفع غير موجود');
    }

    if (payment.status === PaymentStatus.APPROVED) {
      throw new ConflictException('لا يمكن رفض طلب تمت الموافقة عليه وتفعيله مسبقاً');
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REJECTED,
        rejectionReason: dto.reason,
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (updated.student?.user?.id) {
      await this.notificationsService.sendNotification({
        recipientUserId: updated.student.user.id,
        senderUserId: reviewerUserId,
        type: 'COURSE_ENROLLMENT',
        message: `⚠️ تنبيه بخصوص طلب اشتراكك في كورس **${updated.course.title}**: تعذر قبول السند للسبب التالي: "${dto.reason}". يرجى مراجعة وتعديل السند وإعادة إرساله.`,
      });
    }

    return {
      message: 'تم رفض طلب الدفع مع حفظ سبب الرفض.',
      payment: updated,
    };
  }
}
