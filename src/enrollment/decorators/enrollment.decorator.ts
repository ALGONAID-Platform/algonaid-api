import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { MESSAGES } from 'src/utils/messages';

export function SwaggerEnrollInCourse() {
    return applyDecorators(
        ApiBearerAuth(),
        ApiOperation({
            summary: 'التسجيل في كورس',
            description: 'يسمح للطالب بالاشتراك والتسجيل في كورس موجود بالمنصة للبدء في دراسته'
        }),
        ApiBody({
            description: 'بيانات التسجيل: معرف الكورس المراد الاشتراك به',
            type: CreateEnrollmentDto,
            schema: {
                example: {
                    courseId: 1
                }
            }
        }),
        ApiResponse({
            status: 201,
            description: 'تم التسجيل في الكورس بنجاح',
            schema: {
                example: {
                    statusCode: 201,
                    message: MESSAGES.ENROLLMENT.ENROLLMENT_COMPLETED,
                    data: {
                        id: 1,
                        studentId: 5,
                        courseId: 1,
                        enrollmentDate: '2026-03-08T10:00:00.000Z',
                        status: 'ACTIVE'
                    }
                }
            }
        }),
        ApiResponse({ status: 400, description: 'بيانات المدخلات غير صالحة أو الكورس غير متاح' }),
        ApiResponse({ status: 401, description: 'غير مصرح للوصول (Unauthorized)' }),
        ApiResponse({ status: 403, description: 'ليس لديك الصلاحية للقيام بهذا الإجراء (الطلاب فقط)' }),
        ApiResponse({ status: 404, description: 'الكورس غير موجود' }),
        ApiResponse({ status: 409, description: 'الطالب مسجل بالفعل في هذا الكورس' }),
    );
}
