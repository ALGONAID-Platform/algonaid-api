import { INestApplication } from '@nestjs/common';
import { DocumentBuilder } from '@nestjs/swagger';


export const swaggerConfig = new DocumentBuilder()
  .setTitle('API منصة الجنيد التعليمية') 
  .setDescription(
    'توثيق الواجهة البرمجية لمنصة الجنيد التعليمية. ' +
    'يتيح هذا النظام إدارة المستخدمين (طلاب ومعلمين)، ' +
    'إدارة الدورات التدريبية، الدروس، ونظام التقييم الأكاديمي.',
  )

  .setVersion('1.0')

  // شروط الخدمة (يمكن استبدالها برابط حقيقي لاحقاً)
  .setTermsOfService('https://algonaid.com/terms')


  // إعدادات الحماية باستخدام JWT
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'أدخل رمز الوصول (Token) هنا لتتمكن من الوصول للروابط المحمية',
      in: 'header',
    },
    'JWT-auth', 
  )


  .build();