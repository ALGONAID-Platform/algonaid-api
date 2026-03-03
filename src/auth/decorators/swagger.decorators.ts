import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';

export function SwaggerRegister() {
  return applyDecorators(
    ApiOperation({
      summary: 'إنشاء حساب مستخدم جديد',
      description: 'يسمح بإنشاء حساب جديد في المنصة سواء كان طالباً أو معلماً بناءً على الدور (Role)'
    }),

    ApiBody({
      description: 'بيانات التسجيل الأساسية: الاسم، البريد الإلكتروني، كلمة المرور، والدور (STUDENT/TEACHER)',
      schema: {
        example: {
          name: 'بشار ',
          email: 'bashar77@gmail.com',
          password: 'Password123!',
          role: 'STUDENT'
        }
      }
    }),

    ApiResponse({
      status: 201,
      description: 'تم إنشاء الحساب بنجاح',
      schema: {
        example: {
          statusCode: 201,
          message: 'تم تسجيل المستخدم بنجاح',
          data: {
            user: {
              id: 1,
              name: ' bashar alhimyari',
              email: 'bashar@example.com',
              role: 'STUDENT'
            },
            accessToken: 'eyJhbGciOiJIUzI1Ni...'
          }
        }
      }
    }),

    // حالات الأخطاء الشائعة
    ApiResponse({ status: 400, description: 'بيانات المدخلات غير صالحة' }),
    ApiResponse({ status: 409, description: 'البريد الإلكتروني مسجل مسبقاً' })
  );
}

export function SwaggerLogin() {
  return applyDecorators(
    HttpCode(200),

    ApiOperation({
      summary: 'تسجيل الدخول',
      description: 'يسمح للمستخدم بالدخول للمنصة باستخدام البريد الإلكتروني وكلمة المرور والحصول على رمز الوصول (JWT)'
    }),

    ApiBody({
      description: 'بيانات تسجيل الدخول الأساسية',
      schema: {
        example: {
          email: 'bashar@example.com',
          password: 'Password123!'
        }
      }
    }),

    ApiResponse({
      status: 200,
      description: 'تم تسجيل الدخول بنجاح',
      schema: {
        example: {
          statusCode: 200,
          message: 'تم تسجيل الدخول بنجاح',
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
              id: 1,
              name: 'بشار محمد',
              email: 'bashar@example.com',
              role: 'STUDENT'
            }
          }
        }
      }
    }),

    ApiResponse({
      status: 401,
      description: 'بيانات الاعتماد غير صحيحة (الإيميل أو كلمة المرور خطأ)'
    }),

    ApiResponse({
      status: 404,
      description: 'المستخدم غير موجود'
    })
  );
}