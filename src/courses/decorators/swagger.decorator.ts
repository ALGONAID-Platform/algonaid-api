import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { MESSAGES } from 'src/utils/messages';

export function SwaggerCreateCourse() {
    return applyDecorators(
        ApiBearerAuth(),
        ApiOperation({
            summary: 'إنشاء كورس جديد',
            description: 'يسمح للمشرفين والمعلمين بإنشاء كورس جديد في المنصة'
        }),
        ApiBody({
            description: 'بيانات الكورس الأساسية: العنوان، الوصف، وصورة الغلاف',
            schema: {
                example: {
                    title: 'دورة NestJS للمبتدئين',
                    description: 'تعلم كيفية بناء واجهات برمجة تطبيقات قابلة للتوسع باستخدام NestJS',
                    thumbnail: 'https://example.com/thumbnail.jpg'
                }
            }
        }),
        ApiResponse({
            status: 201,
            description: 'تم إنشاء الكورس بنجاح',
            schema: {
                example: {
                    statusCode: 201,
                    message: MESSAGES.COURSES.COURSE_CREATED,
                    data: {
                        id: 1,
                        title: 'دورة NestJS للمبتدئين',
                        description: 'تعلم كيفية بناء واجهات برمجة تطبيقات قابلة للتوسع باستخدام NestJS',
                        thumbnail: 'https://example.com/thumbnail.jpg',
                        authorId: 2,
                        createdAt: '2026-03-08T10:00:00.000Z',
                        updatedAt: '2026-03-08T10:00:00.000Z'
                    }
                }
            }
        }),
        ApiResponse({ status: 400, description: 'بيانات المدخلات غير صالحة' }),
        ApiResponse({ status: 401, description: 'غير مصرح للوصول (Unauthorized)' }),
        ApiResponse({ status: 403, description: 'ليس لديك الصلاحية للقيام بهذا الإجراء (Forbidden)' }),
    );
}

export function SwaggerGetAllCourses() {
    return applyDecorators(
        ApiOperation({
            summary: 'عرض جميع الكورسات',
            description: 'يجلب قائمة بجميع الكورسات المتاحة في المنصة'
        }),
        ApiResponse({
            status: 200,
            description: 'تم جلب قائمة الكورسات بنجاح',
            schema: {
                example: {
                    statusCode: 200,
                    data: [
                        {
                            id: 1,
                            title: 'دورة NestJS للمبتدئين',
                            description: 'تعلم كيفية بناء واجهات برمجة تطبيقات قابلة للتوسع باستخدام NestJS',
                            thumbnail: 'https://example.com/thumbnail.jpg',
                            authorId: 2,
                            createdAt: '2026-03-08T10:00:00.000Z',
                            updatedAt: '2026-03-08T10:00:00.000Z'
                        },
                        {
                            id: 2,
                            title: 'دورة ReactJS الشاملة',
                            description: 'تعلم بناء واجهات المستخدم باستخدام React',
                            thumbnail: 'https://example.com/react-thumbnail.jpg',
                            authorId: 3,
                            createdAt: '2026-03-09T10:00:00.000Z',
                            updatedAt: '2026-03-09T10:00:00.000Z'
                        }
                    ]
                }
            }
        })
    );
}

export function SwaggerGetCourse() {
    return applyDecorators(
        ApiOperation({
            summary: 'عرض تفاصيل الكورس',
            description: 'يجلب تفاصيل كورس معين بواسطة المعرف (ID)'
        }),
        ApiParam({
            name: 'id',
            description: 'المعرف الفريد للكورس',
            type: 'string',
            example: '1'
        }),
        ApiResponse({
            status: 200,
            description: 'تم جلب بيانات الكورس بنجاح',
            schema: {
                example: {
                    statusCode: 200,
                    data: {
                        id: 1,
                        title: 'دورة NestJS للمبتدئين',
                        description: 'تعلم كيفية بناء واجهات برمجة تطبيقات قابلة للتوسع باستخدام NestJS',
                        thumbnail: 'https://example.com/thumbnail.jpg',
                        authorId: 2,
                        createdAt: '2026-03-08T10:00:00.000Z',
                        updatedAt: '2026-03-08T10:00:00.000Z'
                    }
                }
            }
        }),
        ApiResponse({ status: 404, description: 'الكورس غير موجود' }),
    );
}

export function SwaggerUpdateCourse() {
    return applyDecorators(
        ApiBearerAuth(),
        ApiOperation({
            summary: 'تحديث بيانات الكورس',
            description: 'يسمح للمشرفين والمعلمين بتحديث بعض أو كل بيانات كورس موجود مسبقاً'
        }),
        ApiParam({
            name: 'id',
            description: 'المعرف الفريد للكورس المراد تحديثه',
            type: 'string',
            example: '1'
        }),
        ApiBody({
            description: 'البيانات المراد تحديثها (يمكن إرسال جزء من البيانات فقط)',
            schema: {
                example: {
                    title: 'دورة NestJS المتقدمة',
                    description: 'تعلم كيفية بناء واجهات برمجة تطبيقات متقدمة'
                }
            }
        }),
        ApiResponse({
            status: 200,
            description: 'تم تحديث الكورس بنجاح',
            schema: {
                example: {
                    statusCode: 200,
                    message: MESSAGES.COURSES.COURSE_UPDATED,
                    data: {
                        id: 1,
                        title: 'دورة NestJS المتقدمة',
                        description: 'تعلم كيفية بناء واجهات برمجة تطبيقات متقدمة',
                        thumbnail: 'https://example.com/thumbnail.jpg',
                        authorId: 2,
                        createdAt: '2026-03-08T10:00:00.000Z',
                        updatedAt: '2026-03-08T10:05:00.000Z'
                    }
                }
            }
        }),
        ApiResponse({ status: 400, description: 'بيانات المدخلات غير صالحة' }),
        ApiResponse({ status: 401, description: 'غير مصرح للوصول (Unauthorized)' }),
        ApiResponse({ status: 403, description: 'ليس لديك الصلاحية للقيام بهذا الإجراء (Forbidden)' }),
        ApiResponse({ status: 404, description: 'الكورس غير موجود' }),
    );
}

export function SwaggerDeleteCourse() {
    return applyDecorators(
        ApiBearerAuth(),
        ApiOperation({
            summary: 'حذف كورس',
            description: 'يسمح للمشرفين بحذف كورس من المنصة بشكل نهائي عن طريق المعرف (ID)'
        }),
        ApiParam({
            name: 'id',
            description: 'المعرف الفريد للكورس المراد حذفه',
            type: 'string',
            example: '1'
        }),
        ApiResponse({
            status: 200,
            description: 'تم حذف الكورس بنجاح',
            schema: {
                example: {
                    statusCode: 200,
                    message: MESSAGES.COURSES.COURSE_DELETED
                }
            }
        }),
        ApiResponse({ status: 401, description: 'غير مصرح للوصول (Unauthorized)' }),
        ApiResponse({ status: 403, description: 'ليس لديك الصلاحية للقيام بهذا الإجراء (Forbidden)' }),
        ApiResponse({ status: 404, description: 'الكورس غير موجود' }),
    );
}
