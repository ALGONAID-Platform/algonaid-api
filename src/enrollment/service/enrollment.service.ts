import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MESSAGES } from 'src/utils/messages';

@Injectable()
export class EnrollmentService {
    constructor(private readonly prisma: PrismaService) { }


async isUserEnrolled(userId: number, courseId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: userId },
    });

    if (!student) return { isEnrolled: false };

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: student.id,
          courseId: courseId,
          
        },
      },
    });

    return { isEnrolled: !!enrollment };
  }
    async craete(userId: number, enrollmentDto: CreateEnrollmentDto) {
        const { courseId } = enrollmentDto;

        // 1. التحقق من وجود المستخدم وتأكيد بريده الإلكتروني
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('المستخدم غير موجود');
        }

        if (!user.emailVerified && user.role === 'STUDENT') {
            throw new ForbiddenException({
                statusCode: 403,
                message: 'يجب تأكيد حسابك عبر البريد الإلكتروني أولاً قبل التسجيل في الكورسات.',
                action: 'EMAIL_VERIFICATION_REQUIRED',
            });
        }

        // 2. جلب بيانات الطالب والكورس
        let student = await this.prisma.student.findUnique({
            where: { userId }
        });

        // 3. التحقق من وجود الكورس
        const course = await this.prisma.course.findUnique({
            where: { id: courseId }
        });

        if (!course) {
            throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND_DEFAULT);
        }

        // الكورسات المدفوعة تتطلب دفع سند ومراجعة
        if (course.isPaid) {
            throw new BadRequestException('هذا الكورس مدفوع، يرجى إرسال سند التحويل عبر قسم المدفوعات لتأكيد وتفعيل اشتراكك');
        }

        // إذا لم يكن لديه ملف طالب (مثل حالة الـ admin أو owner)، نقوم بإنشائه فوراً
        if (!student) {
            student = await this.prisma.student.create({
                data: {
                    userId,
                    academicId: `STU-${Date.now()}-${userId}`,
                }
            });
        }

        // 🌟 3. التحقق من أن الطالب غير مسجل مسبقاً (هذا ما ينقصك)
        const existingEnrollment = await this.prisma.enrollment.findUnique({
            where: {
                studentId_courseId: {
                    studentId: student.id,
                    courseId: courseId,
                },
            },
        });

        if (existingEnrollment) {
            // يمكنك إرجاع رسالة "أنت مسجل بالفعل" بدلاً من إظهار خطأ
            throw new ConflictException("أنت مسجل بالفعل في هذا الكورس");
        }

        // 4. إذا لم يكن مسجلاً، نقوم بإنشاء التسجيل
        await this.prisma.enrollment.create({
            data: {
                courseId,
                studentId: student.id
            }
        });

        return {
            message: MESSAGES.ENROLLMENT.ENROLLED_SUCCESSFULLY
        }
    }
}
