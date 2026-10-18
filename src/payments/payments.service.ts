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
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import { VerifyCheckoutDto } from './dto/verify-checkout.dto';
import { ConfirmExternalPaymentDto } from './dto/confirm-external-payment.dto';
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
  // EXTERNAL CHECKOUT VERIFICATION
  // ==========================================

  /**
   * فحص بسيط ومباشر للمستخدم وإمكانية الدفع لتطبيق خارجي
   */
  async verifyCheckout(dto: VerifyCheckoutDto) {
    const identifier = dto.userIdentifier.trim();
    const isNumeric = /^\d+$/.test(identifier);

    // 1. البحث عن المستخدم (بالإيميل، أو الرقم الأكاديمي، أو الـ ID)
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
        canPay: false,
        status: 'USER_NOT_FOUND',
        message: 'المستخدم غير مسجل في المنصة',
      };
    }

    // التأكد من وجود رقم أكاديمي للطالب
    let studentId = user.studentProfile?.id;
    let academicId = user.studentProfile?.academicId;
    if (!studentId) {
      const student = await this.getOrCreateStudent(user.id);
      studentId = student.id;
      academicId = student.academicId;
    }

    // 2. التحقق من توثيق الحساب عبر البريد الإلكتروني
    if (!user.emailVerified) {
      return {
        canPay: false,
        status: 'ACCOUNT_NOT_VERIFIED',
        message: 'حساب المستخدم غير مؤكد عبر البريد الإلكتروني. يرجى تأكيد الحساب أولاً قبل سداد الرسوم.',
        user: {
          academicId,
          name: user.name,
          email: user.email,
          isAccountVerified: false,
        },
      };
    }

    // 3. التحقق من وجود الكورس
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: {
        id: true,
        title: true,
        isPaid: true,
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
        canPay: false,
        status: 'COURSE_NOT_FOUND',
        message: 'الكورس غير موجود',
      };
    }

    if (!course.isPaid) {
      return {
        canPay: false,
        status: 'COURSE_IS_FREE',
        message: 'هذا الكورس مجاني ولا يتطلب دفع',
        course: { id: course.id, title: course.title },
      };
    }

    // 4. التحقق هل المستخدم مشترك مسبقاً في هذا الكورس
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: studentId!,
          courseId: course.id,
        },
      },
    });
    const isAlreadyEnrolled = enrollment?.status === 'ACTIVE';

    // 5. التحقق هل توجد عملية دفع معلقة قيد المراجعة
    const pendingPayment = await this.prisma.payment.findFirst({
      where: {
        studentId: studentId!,
        courseId: course.id,
        status: PaymentStatus.PENDING,
      },
    });
    const hasPendingPayment = !!pendingPayment;

    // 6. احتساب الأسعار المباشرة بالعملات (مع الاحتياط للأسعار العامة إن لم تحدد العملات بشكل منفصل)
    const generalPrice = Number(course.discountedPrice || course.price || 0);

    const prices: Record<Currency, number> = {
      YER_OLD: Number(course.discountedPriceYerOld || course.priceYerOld || generalPrice),
      YER_NEW: Number(course.discountedPriceYerNew || course.priceYerNew || generalPrice),
      SAR: Number(course.discountedPriceSar || course.priceSar || 0),
      USD: generalPrice,
    };

    const currency = dto.currency || Currency.YER_OLD;
    const requiredAmount = prices[currency] || prices.YER_OLD;

    // 6. جلب أرقام الحسابات البنكية النشطة
    const accounts = await this.prisma.paymentAccount.findMany({
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
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    // 7. تحديد الحالة ورسالة النتيجة
    const canPay = !isAlreadyEnrolled && !hasPendingPayment;
    let status = 'READY_TO_PAY';
    let message = 'جاهز للدفع';

    if (isAlreadyEnrolled) {
      status = 'ALREADY_ENROLLED';
      message = 'المستخدم مشترك ومفعل في هذا الكورس مسبقاً';
    } else if (hasPendingPayment) {
      status = 'PENDING_PAYMENT';
      message = 'توجد عملية دفع سابقة قيد المراجعة والتدقيق لهذا الكورس';
    }

    return {
      canPay,
      status,
      message,
      user: {
        academicId,
        name: user.name,
        email: user.email,
        isAccountVerified: !!user.emailVerified,
      },
      course: {
        id: course.id,
        title: course.title,
      },
      currency,
      requiredAmount,
      prices,
      paymentAccounts: accounts.map((a) => ({
        id: a.id,
        provider: a.providerTitle,
        accountHolder: a.accountHolder,
        accountNumber: a.accountNumber,
        currency: a.currency,
        instructions: a.instructions,
      })),
    };
  }

  /**
   * تأكيد السداد وتفعيل اشتراك الطالب فورياً من تطبيق خارجي (كرتي / بوابة دفع)
   */
  async confirmExternalPayment(dto: ConfirmExternalPaymentDto) {
    const identifier = dto.userIdentifier.trim();
    const isNumeric = /^\d+$/.test(identifier);

    // 1. البحث عن المستخدم (بالإيميل، أو الرقم الأكاديمي، أو الـ ID)
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
      throw new NotFoundException('المستخدم غير مسجل في المنصة');
    }

    // التحقق من توثيق وتأكيد الحساب عبر البريد الإلكتروني
    if (!user.emailVerified) {
      throw new ForbiddenException('حساب المستخدم غير مؤكد عبر البريد الإلكتروني. يرجى تأكيد الحساب أولاً قبل إتمام عملية السداد.');
    }

    let studentId = user.studentProfile?.id;
    let academicId = user.studentProfile?.academicId;
    if (!studentId) {
      const student = await this.getOrCreateStudent(user.id);
      studentId = student.id;
      academicId = student.academicId;
    }

    // 2. التحقق من وجود الكورس وبيانات تسعيره
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: {
        id: true,
        title: true,
        isPaid: true,
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
      throw new NotFoundException('الكورس المحدد غير موجود في المنصة');
    }

    if (!course.isPaid) {
      throw new BadRequestException('هذا الكورس مجاني ومتاح للتسجيل المباشر ولا يتطلب سداداً مالياً');
    }

    // 3. التحقق الأمني من مطابقة المبلغ المدفوع لسعر الكورس لمنع التلاعب
    const generalPrice = Number(course.discountedPrice || course.price || 0);
    const prices: Record<Currency, number> = {
      YER_OLD: Number(course.discountedPriceYerOld || course.priceYerOld || generalPrice),
      YER_NEW: Number(course.discountedPriceYerNew || course.priceYerNew || generalPrice),
      SAR: Number(course.discountedPriceSar || course.priceSar || 0),
      USD: generalPrice,
    };

    const currency = dto.currency || Currency.YER_OLD;
    const requiredAmount = prices[currency] || prices.YER_OLD;

    if (requiredAmount > 0 && Number(dto.amount) < requiredAmount) {
      throw new BadRequestException(
        `المبلغ المدفوع (${dto.amount} ${currency}) أقل من سعر الكورس المطلوب (${requiredAmount} ${currency})`,
      );
    }

    // 4. التحقق هل المستخدم مشترك ومفعل مسبقاً
    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: studentId!,
          courseId: course.id,
        },
      },
    });

    if (existingEnrollment && existingEnrollment.status === 'ACTIVE') {
      throw new ConflictException('الطالب مشترك ومفعل في هذا الكورس مسبقاً');
    }

    const transactionNumber = dto.transactionNumber?.trim() || `KARTI-${Date.now()}`;

    // 5. التحقق من تكرار نفس رقم العملية (Idempotency Protection لمنع الخصم المزدوج عند إعادة المحاولة)
    if (dto.transactionNumber) {
      const existingPaymentWithTrx = await this.prisma.payment.findFirst({
        where: {
          transactionNumber,
          status: PaymentStatus.APPROVED,
        },
      });

      if (existingPaymentWithTrx) {
        return {
          success: true,
          message: 'تم تسجيل واعتماد هذه العملية مسبقاً بنجاح (عملية مكررة آمنة).',
          data: {
            enrollmentId: existingEnrollment?.id || null,
            paymentId: existingPaymentWithTrx.id,
            status: 'ACTIVE',
            student: {
              academicId,
              name: user.name,
              email: user.email,
            },
            course: {
              id: course.id,
              title: course.title,
            },
            payment: {
              amount: Number(existingPaymentWithTrx.amount),
              currency: existingPaymentWithTrx.currency,
              transactionNumber: existingPaymentWithTrx.transactionNumber,
              paidAt: existingPaymentWithTrx.createdAt,
            },
          },
        };
      }
    }

    // 6. تنفيذ السداد والاشتراك وتنظيف أي طلب معلق سابق في خطوة ذرية موحدة
    const [payment, enrollment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          studentId: studentId!,
          courseId: course.id,
          amount: dto.amount,
          currency,
          transactionNumber,
          receiptUrl: 'EXTERNAL_KARTI_PAYMENT',
          status: PaymentStatus.APPROVED,
          notes: dto.notes || `سداد إلكتروني مباشر عبر تطبيق كرتي (رقم العملية: ${transactionNumber})`,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.enrollment.upsert({
        where: {
          studentId_courseId: {
            studentId: studentId!,
            courseId: course.id,
          },
        },
        create: {
          studentId: studentId!,
          courseId: course.id,
          status: 'ACTIVE',
        },
        update: {
          status: 'ACTIVE',
        },
      }),
    ]);

    // إذا كان هناك طلب معلق سابق لنفس الكورس، نقوم بتحديثه لتفادي بقائه معلقاً في لوحة الأدمن
    await this.prisma.payment.updateMany({
      where: {
        studentId: studentId!,
        courseId: course.id,
        status: PaymentStatus.PENDING,
        id: { not: payment.id },
      },
      data: {
        status: PaymentStatus.APPROVED,
        notes: `تم استبداله بسداد إلكتروني مباشر عبر كرتي رقم ${transactionNumber}`,
        reviewedAt: new Date(),
      },
    });

    // 5. إرسال إشعار فوري للطالب في تطبيق منصة الجنيد
    if (user.id) {
      const firstLesson = await this.prisma.lesson.findFirst({
        where: { module: { courseId: course.id } },
        orderBy: { order: 'asc' },
        select: { id: true },
      });

      await this.notificationsService.notifyCourseEnrollmentApproved(
        user.id,
        course.title,
        undefined,
        firstLesson?.id,
      );
    }

    return {
      success: true,
      message: 'تم سداد الرسوم واعتماد العملية وتفعيل اشتراك الطالب في الكورس بنجاح.',
      data: {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        status: enrollment.status,
        student: {
          academicId,
          name: user.name,
          email: user.email,
        },
        course: {
          id: course.id,
          title: course.title,
        },
        payment: {
          amount: Number(payment.amount),
          currency: payment.currency,
          transactionNumber: payment.transactionNumber,
          paidAt: payment.createdAt,
        },
      },
    };
  }
}
