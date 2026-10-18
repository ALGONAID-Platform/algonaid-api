import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import { VerifyCheckoutDto } from './dto/verify-checkout.dto';
import { Currency, PaymentStatus } from '@prisma/client';
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

    if (dto.paymentAccountId) {
      const account = await this.prisma.paymentAccount.findUnique({
        where: { id: dto.paymentAccountId },
      });
      if (!account || !account.isActive) {
        throw new BadRequestException('حساب الاستقبال المحدد غير صالح أو معطل حالياً');
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        studentId: student.id,
        courseId: dto.courseId,
        amount: dto.amount,
        currency: dto.currency || Currency.YER_OLD,
        transactionNumber: dto.transactionNumber,
        paymentAccountId: dto.paymentAccountId,
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
            priceYerOld: true,
            discountedPriceYerOld: true,
            priceYerNew: true,
            discountedPriceYerNew: true,
            priceSar: true,
            discountedPriceSar: true,
            courseType: true,
          },
        },
        paymentAccount: {
          select: {
            id: true,
            providerTitle: true,
            accountHolder: true,
            accountNumber: true,
            currency: true,
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

  // ==========================================
  // PAYMENT ACCOUNTS MANAGEMENT (BANK / WALLET)
  // ==========================================

  /**
   * جلب الحسابات البنكية ومحافظ الاستقبال النشطة (للطلاب والتطبيقات الخارجية)
   */
  async getActivePaymentAccounts(currency?: Currency) {
    return this.prisma.paymentAccount.findMany({
      where: {
        isActive: true,
        ...(currency ? { OR: [{ currency }, { currency: null }] } : {}),
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * للأدمن: جلب كافة الحسابات البنكية والمحافظ (بما فيها المعطلة) مع عدد الحوالات
   */
  async getAllPaymentAccounts() {
    return this.prisma.paymentAccount.findMany({
      include: {
        _count: { select: { payments: true } },
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * جلب تفاصيل حساب بنكي محدد
   */
  async getPaymentAccountById(id: number) {
    const account = await this.prisma.paymentAccount.findUnique({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException('حساب الاستقبال المحدد غير موجود');
    }
    return account;
  }

  /**
   * للأدمن: إضافة حساب استقبال بنكي أو محفظة دفع جديدة
   */
  async createPaymentAccount(dto: CreatePaymentAccountDto) {
    return this.prisma.paymentAccount.create({
      data: dto,
    });
  }

  /**
   * للأدمن: تعديل بيانات حساب الاستقبال أو تفعيله/تعطيله
   */
  async updatePaymentAccount(id: number, dto: UpdatePaymentAccountDto) {
    await this.getPaymentAccountById(id);
    return this.prisma.paymentAccount.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * للأدمن: حذف حساب الاستقبال (أو تعطيله تلقائياً إذا كان مرتبطاً بحوالات سابقة)
   */
  async deletePaymentAccount(id: number) {
    const account = await this.prisma.paymentAccount.findUnique({
      where: { id },
      include: { _count: { select: { payments: true } } },
    });

    if (!account) {
      throw new NotFoundException('حساب الاستقبال غير موجود');
    }

    if (account._count.payments > 0) {
      // حماية السجلات المالية السابقة: تعطيل الحساب بدلاً من الحذف الفعلي
      await this.prisma.paymentAccount.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        message: 'تم تعطيل الحساب وإخفاؤه من قائمة الدفع بنجاح (نظراً لارتباطه بحوالات سابقة مسجلة).',
      };
    }

    await this.prisma.paymentAccount.delete({
      where: { id },
    });

    return {
      message: 'تم حذف حساب الاستقبال نهائياً بنجاح.',
    };
  }

  // ==========================================
  // EXTERNAL CHECKOUT VERIFICATION (SECURE S2S)
  // ==========================================

  /**
   * التحقق الشامل والأمني للتطبيقات الخارجية وبوابات الدفع قبل خصم المبلغ
   */
  async verifyCheckout(dto: VerifyCheckoutDto) {
    const identifier = dto.userIdentifier.trim();
    const isNumeric = /^\d+$/.test(identifier);

    // 1. البحث عن المستخدم بالبريد الإلكتروني، أو الرقم الأكاديمي STU-xxx، أو المعرّف الرقمي
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { studentProfile: { academicId: identifier } },
          ...(isNumeric ? [{ id: parseInt(identifier, 10) }] : []),
        ],
      },
      include: {
        studentProfile: {
          select: {
            id: true,
            academicId: true,
          },
        },
      },
    });

    if (!user) {
      return {
        canProceedPayment: false,
        status: 'USER_NOT_FOUND',
        message: 'لم يتم العثور على أي حساب مستخدم مسجل بهذا المعرّف (البريد الإلكتروني أو الرقم الأكاديمي).',
        userIdentifier: identifier,
      };
    }

    // التأكد من وجود ملف طالب ورقم أكاديمي
    let studentId = user.studentProfile?.id;
    let academicId = user.studentProfile?.academicId;
    if (!studentId) {
      const student = await this.getOrCreateStudent(user.id);
      studentId = student.id;
      academicId = student.academicId;
    }

    // 2. التحقق من توثيق وتأكيد الحساب عبر البريد الإلكتروني
    if (!user.emailVerified) {
      return {
        canProceedPayment: false,
        status: 'ACCOUNT_NOT_VERIFIED',
        message: 'حساب المستخدم غير مؤكد عبر البريد الإلكتروني. يجب تأكيد الحساب أولاً قبل سداد رسوم الدورات.',
        user: {
          userId: user.id,
          name: user.name,
          email: user.email,
          academicId,
          uniqueIdentifier: academicId,
          isAccountVerified: false,
        },
      };
    }

    // 3. التحقق من وجود الكورس وصلاحيته
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: {
        id: true,
        title: true,
        isPaid: true,
        courseType: true,
        price: true,
        discountedPrice: true,
        priceYerOld: true,
        discountedPriceYerOld: true,
        priceYerNew: true,
        discountedPriceYerNew: true,
        priceSar: true,
        discountedPriceSar: true,
      },
    });

    if (!course) {
      return {
        canProceedPayment: false,
        status: 'COURSE_NOT_FOUND',
        message: 'الكورس المحدد غير موجود في المنصة.',
        courseId: dto.courseId,
      };
    }

    if (!course.isPaid) {
      return {
        canProceedPayment: false,
        status: 'COURSE_IS_FREE',
        message: 'هذا الكورس مجاني بالكامل ولا يتطلب أي عملية سداد مالي، يمكن للمستخدم التسجيل المباشر فيه.',
        course: {
          id: course.id,
          title: course.title,
          isPaid: false,
        },
      };
    }

    // 4. التحقق من وجود اشتراك نشط مسبقاً في هذا الكورس
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: studentId!,
          courseId: course.id,
        },
      },
    });

    if (enrollment && enrollment.status === 'ACTIVE') {
      return {
        canProceedPayment: false,
        status: 'ALREADY_ENROLLED',
        message: 'المستخدم مسجل ومفعل في هذا الكورس مسبقاً ولا يحتاج للسداد مرة أخرى.',
        user: {
          userId: user.id,
          name: user.name,
          email: user.email,
          academicId,
          uniqueIdentifier: academicId,
          isAccountVerified: true,
        },
        course: {
          id: course.id,
          title: course.title,
        },
      };
    }

    // 5. التحقق من وجود طلب دفع قيد المراجعة لمنع الازدواجية
    const pendingPayment = await this.prisma.payment.findFirst({
      where: {
        studentId: studentId!,
        courseId: course.id,
        status: PaymentStatus.PENDING,
      },
      include: {
        paymentAccount: {
          select: { providerTitle: true, accountNumber: true },
        },
      },
    });

    if (pendingPayment) {
      return {
        canProceedPayment: false,
        status: 'PENDING_PAYMENT_EXISTS',
        message: 'يوجد طلب دفع قيد المراجعة والتدقيق حالياً لهذا الكورس. يرجى انتظار قرار الإدارة لمنع السداد المزدوج.',
        pendingPayment: {
          paymentId: pendingPayment.id,
          amount: Number(pendingPayment.amount),
          currency: pendingPayment.currency,
          createdAt: pendingPayment.createdAt,
          provider: pendingPayment.paymentAccount?.providerTitle || null,
        },
      };
    }

    // 6. تجهيز تفاصيل الأسعار بكافة العملات الثلاث (قديم / جديد / سعودي)
    const pricing = {
      YER_OLD: {
        originalPrice: course.priceYerOld ? Number(course.priceYerOld) : null,
        discountedPrice: course.discountedPriceYerOld ? Number(course.discountedPriceYerOld) : null,
        finalPrice: Number(course.discountedPriceYerOld || course.priceYerOld || 0),
        currencyLabel: 'ريال يمني (عملة قديمة)',
      },
      YER_NEW: {
        originalPrice: course.priceYerNew ? Number(course.priceYerNew) : null,
        discountedPrice: course.discountedPriceYerNew ? Number(course.discountedPriceYerNew) : null,
        finalPrice: Number(course.discountedPriceYerNew || course.priceYerNew || 0),
        currencyLabel: 'ريال يمني (عملة جديدة)',
      },
      SAR: {
        originalPrice: course.priceSar ? Number(course.priceSar) : null,
        discountedPrice: course.discountedPriceSar ? Number(course.discountedPriceSar) : null,
        finalPrice: Number(course.discountedPriceSar || course.priceSar || 0),
        currencyLabel: 'ريال سعودي',
      },
      USD: {
        originalPrice: course.price ? Number(course.price) : null,
        discountedPrice: course.discountedPrice ? Number(course.discountedPrice) : null,
        finalPrice: Number(course.discountedPrice || course.price || 0),
        currencyLabel: 'دولار أمريكي',
      },
      GENERAL: {
        originalPrice: course.price ? Number(course.price) : null,
        discountedPrice: course.discountedPrice ? Number(course.discountedPrice) : null,
        finalPrice: Number(course.discountedPrice || course.price || 0),
        currencyLabel: 'السعر الافتراضي',
      },
    };

    // 7. جلب حسابات ومحافظ الاستقبال النشطة والمعتمدة
    const paymentAccounts = await this.prisma.paymentAccount.findMany({
      where: {
        isActive: true,
        ...(dto.currency ? { OR: [{ currency: dto.currency }, { currency: null }] } : {}),
      },
      select: {
        id: true,
        providerTitle: true,
        accountHolder: true,
        accountNumber: true,
        currency: true,
        instructions: true,
        qrCodeUrl: true,
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    // 8. إنشاء رمز أمان وتوقيع مشفر غير قابل للتلاعب (Cryptographic Reference Token)
    const secret = process.env.JWT_SECRET || 'algonaid_payment_checkout_signature_secret';
    const timestamp = Date.now();
    const tokenPayload = `${user.id}:${studentId}:${academicId}:${course.id}:${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(tokenPayload).digest('hex');
    const paymentReferenceToken = Buffer.from(
      JSON.stringify({
        userId: user.id,
        studentId,
        academicId,
        courseId: course.id,
        timestamp,
        signature,
      }),
    ).toString('base64url');

    const selectedFinalPrice = dto.currency
      ? pricing[dto.currency]?.finalPrice
      : pricing.GENERAL.finalPrice;

    return {
      canProceedPayment: true,
      status: 'ELIGIBLE',
      message: 'المستخدم مؤهل لسداد رسوم هذا الكورس بنجاح.',
      user: {
        userId: user.id,
        studentId,
        uniqueIdentifier: academicId,
        academicId,
        name: user.name,
        email: user.email,
        isAccountVerified: true,
      },
      course: {
        id: course.id,
        title: course.title,
        courseType: course.courseType,
      },
      pricing,
      selectedCurrency: dto.currency || null,
      payableAmount: selectedFinalPrice,
      paymentAccounts,
      paymentReferenceToken,
    };
  }
}
