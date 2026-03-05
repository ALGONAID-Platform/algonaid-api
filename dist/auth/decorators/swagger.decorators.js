"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwaggerRegister = SwaggerRegister;
exports.SwaggerLogin = SwaggerLogin;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
function SwaggerRegister() {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiOperation)({
        summary: 'إنشاء حساب مستخدم جديد',
        description: 'يسمح بإنشاء حساب جديد في المنصة سواء كان طالباً أو معلماً بناءً على الدور (Role)'
    }), (0, swagger_1.ApiBody)({
        description: 'بيانات التسجيل الأساسية: الاسم، البريد الإلكتروني، كلمة المرور، والدور (STUDENT/TEACHER)',
        schema: {
            example: {
                name: 'بشار ',
                email: 'bashar77@gmail.com',
                password: 'Password123!',
                role: 'STUDENT'
            }
        }
    }), (0, swagger_1.ApiResponse)({
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
    }), (0, swagger_1.ApiResponse)({ status: 400, description: 'بيانات المدخلات غير صالحة' }), (0, swagger_1.ApiResponse)({ status: 409, description: 'البريد الإلكتروني مسجل مسبقاً' }));
}
function SwaggerLogin() {
    return (0, common_1.applyDecorators)((0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({
        summary: 'تسجيل الدخول',
        description: 'يسمح للمستخدم بالدخول للمنصة باستخدام البريد الإلكتروني وكلمة المرور والحصول على رمز الوصول (JWT)'
    }), (0, swagger_1.ApiBody)({
        description: 'بيانات تسجيل الدخول الأساسية',
        schema: {
            example: {
                email: 'bashar@example.com',
                password: 'Password123!'
            }
        }
    }), (0, swagger_1.ApiResponse)({
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
    }), (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'بيانات الاعتماد غير صحيحة (الإيميل أو كلمة المرور خطأ)'
    }), (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'المستخدم غير موجود'
    }));
}
//# sourceMappingURL=swagger.decorators.js.map