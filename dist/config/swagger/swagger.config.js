"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerConfig = void 0;
const swagger_1 = require("@nestjs/swagger");
exports.swaggerConfig = new swagger_1.DocumentBuilder()
    .setTitle('API منصة الجنيد التعليمية')
    .setDescription('توثيق الواجهة البرمجية لمنصة الجنيد التعليمية. ' +
    'يتيح هذا النظام إدارة المستخدمين (طلاب ومعلمين)، ' +
    'إدارة الدورات التدريبية، الدروس، ونظام التقييم الأكاديمي.')
    .setVersion('1.0')
    .setTermsOfService('https://algonaid.com/terms')
    .addBearerAuth({
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    name: 'JWT',
    description: 'أدخل رمز الوصول (Token) هنا لتتمكن من الوصول للروابط المحمية',
    in: 'header',
}, 'JWT-auth')
    .build();
//# sourceMappingURL=swagger.config.js.map