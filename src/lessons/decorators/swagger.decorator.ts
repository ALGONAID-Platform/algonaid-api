import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';

export function SwaggerCreateLesson() {
    return applyDecorators(
        ApiOperation({ summary: 'إنشاء درس جديد (مع إمكانية إرفاق ملف PDF)' }),
        ApiConsumes('multipart/form-data'),
        ApiBody({
            schema: {
                type: 'object',
                required: ['title'],
                properties: {
                    title: { type: 'string', description: 'عنوان الدرس' },
                    description: { type: 'string', description: 'وصف الدرس (اختياري)', nullable: true },
                    content: { type: 'string' },
                    videoUrl: { type: 'string' },
                    exam: { type: 'string' },
                    order: { type: 'integer' },
                    moduleId: { type: 'integer' },
                    pdf: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
        }),
        ApiResponse({ status: 201, description: 'تم إنشاء الدرس بنجاح.' })
    );
}

export function SwaggerGetAllLessonsByModule() {
    return applyDecorators(
        ApiOperation({ summary: 'جلب كافة الدروس التابعة لوحدة معينة' })
    );
}

export function SwaggerGetLesson() {
    return applyDecorators(
        ApiOperation({ summary: 'جلب تفاصيل درس معين باستخدام المعرف (ID)' })
    );
}

export function SwaggerUpdateLesson() {
    return applyDecorators(
        ApiOperation({ summary: 'تحديث بيانات درس معين (مع إمكانية تحديث ملف PDF)' }),
        ApiConsumes('multipart/form-data'),
        ApiBody({
            schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    content: { type: 'string' },
                    videoUrl: { type: 'string' },
                    exam: { type: 'string' },
                    order: { type: 'integer' },
                    moduleId: { type: 'integer' },
                    pdf: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
        })
    );
}

export function SwaggerDeleteLesson() {
    return applyDecorators(
        ApiOperation({ summary: 'حذف درس من المنصة' })
    );
}
