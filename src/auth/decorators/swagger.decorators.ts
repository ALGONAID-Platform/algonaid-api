import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { MESSAGES } from 'src/utils/messages';

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
          message: MESSAGES.AUTH.USER_REGISTERED,
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
          message: MESSAGES.AUTH.LOGGED_IN,
          data: {
            user: {
              id: 1,
              name: 'بشار محمد',
              email: 'bashar@example.com',
              role: 'STUDENT'
            },
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
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

export function SwaggerGoogleAuth() {
  return applyDecorators(
    ApiOperation({
      summary: 'تسجيل الدخول عبر جوجل',
      description: 'يتم توجيه المستخدم إلى صفحة تسجيل الدخول الخاصة بجوجل'
    }),
    ApiResponse({
      status: 302,
      description: 'إعادة توجيه إلى صفحة جوجل'
    })
  );
}

export function SwaggerGoogleCallback() {
  return applyDecorators(
    ApiOperation({
      summary: 'رابط العودة من جوجل (Callback)',
      description: 'يتم استدعاء هذا الرابط تلقائياً بعد نجاح تسجيل الدخول في جوجل'
    }),
    ApiResponse({
      status: 200,
      description: 'تم تسجيل الدخول بنجاح عبر جوجل',
      schema: {
        example: {
          message: 'Google login successful',
          user: {
            id: 5,
            email: 'user@gmail.com',
            name: 'User Name',
            role: 'STUDENT'
          },
          access_token: 'eyJhbGciOiJIUzI1...'
        }
      }
    })
  );
}

export function SwaggerGoogleMobileAuth() {
  return applyDecorators(
    HttpCode(200),

    ApiOperation({
      summary: 'تسجيل الدخول عبر جوجل للهواتف (أندرويد/iOS)',
      description: 'يسمح بتسجيل الدخول أو إنشاء حساب باستخدام الـ ID Token المستلم من جوجل على الموبايل'
    }),

    ApiBody({
      description: 'رمز التعريف (ID Token) المستلم من تطبيق الموبايل',
      schema: {
        example: {
          idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFl...'
        }
      }
    }),

    ApiResponse({
      status: 200,
      description: 'تم تسجيل الدخول بنجاح عبر جوجل',
      schema: {
        example: {
          message: 'Google login successful',
          user: {
            id: 5,
            email: 'user@gmail.com',
            name: 'User Name',
            role: 'STUDENT'
          },
          access_token: 'eyJhbGciOiJIUzI1...'
        }
      }
    }),

    ApiResponse({
      status: 401,
      description: 'رمز التعريف (ID Token) غير صالح أو منتهي الصلاحية'
    })
  );
}