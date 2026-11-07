import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';
import { json, urlencoded } from 'express';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './utils/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Initialize Firebase Admin
  try {
    if (!getApps().length) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        initializeApp({ credential: cert(serviceAccount) });
      } else {
        initializeApp({ credential: applicationDefault() });
      }
      console.log('✅ Firebase Admin initialized successfully');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin', error);
  }

  // مسارات تطبيق الفلاتر محفوظة تماماً بدون أي تعديل
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'modulesList/:courseId',
      'lessonDetails/:courseId/:lessonId',
      'lessonDetails/:lessonId',
      'examPage/:id',
      '.well-known/assetlinks.json',
      '.well-known/apple-app-site-association',
    ],
  }); 

  // تفعيل حماية Helmet مع Content Security Policy مُشدَّد
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // unsafe-inline مطلوب للصفحات الـ HTML الداخلية
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // مطلوب لتشغيل الـ uploads بشكل صحيح
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // السماح بتحميل الصور من نطاقات أخرى
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,         // سنة كاملة
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS — دعم كامل للوحة التحكم (بما فيها Vite localhost:5173) والتطبيق والنطاقات المصرح بها
  const rawOrigins = process.env.CORS_ORIGINS;
  const configuredOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // 1. السماح للطلبات بدون Origin (مثل تطبيقات Flutter على الموبايل، cURL، Postman)
      if (!origin) {
        return callback(null, true);
      }

      // 2. السماح لأي منفذ localhost أو 127.0.0.1 (مثل 5173 لـ Vite، 3000، 5000، إلخ)
      if (
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      // 3. السماح بالنطاقات المحددة في متغيرات البيئة CORS_ORIGINS
      if (configuredOrigins.length > 0) {
        if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
          return callback(null, true);
        }
      }

      // 4. السماح بنطاقات المنصة الرسمية ولوحة التحكم السحابية
      if (
        origin.endsWith('.exchangesmangement.online') ||
        origin.endsWith('.algonaid.com') ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.netlify.app')
      ) {
        return callback(null, true);
      }

      // السماح بالافتراضي لتفادي أي حظر غير مقصود للوحة التحكم
      return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, X-Mx-ReqToken',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Add raw Express routes for deep link redirect HTML pages
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/posts/:id', async (req: any, res: any, next: any) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    const appService = app.get(AppService);
    res.send(await appService.getRedirectPage('post', req.params.id));
  });
  expressApp.get('/examPage/:id', async (req: any, res: any, next: any) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    const appService = app.get(AppService);
    res.send(await appService.getExamRedirectPage(req.params.id));
  });
  expressApp.get('/modulesList/:courseId', async (req: any, res: any, next: any) => {
    if (!/^\d+$/.test(req.params.courseId)) return next();
    const appService = app.get(AppService);
    res.send(await appService.getRedirectPage('course', req.params.courseId));
  });
  expressApp.get('/courses/:courseId', async (req: any, res: any, next: any) => {
    if (!/^\d+$/.test(req.params.courseId)) return next();
    const appService = app.get(AppService);
    res.send(await appService.getRedirectPage('course', req.params.courseId));
  });
  expressApp.get('/lessonDetails/:courseId/:lessonId', async (req: any, res: any, next: any) => {
    if (!/^\d+$/.test(req.params.lessonId)) return next();
    const appService = app.get(AppService);
    res.send(await appService.getRedirectPage('lesson', req.params.lessonId));
  });
  expressApp.get('/lessonDetails/:lessonId', async (req: any, res: any, next: any) => {
    if (!/^\d+$/.test(req.params.lessonId)) return next();
    const appService = app.get(AppService);
    res.send(await appService.getRedirectPage('lesson', req.params.lessonId));
  });

  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
    setHeaders: (res: any, path: string) => {
      if (path.endsWith('apple-app-site-association')) {
        res.set('Content-Type', 'application/json');
      }
      res.set('X-Content-Type-Options', 'nosniff');
    }
  });
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));

  // Only expose Swagger documentation in non-production environments.
  if (process.env.NODE_ENV !== 'production') {
    const documentation = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("swagger", app, documentation);
  }

  // Catch all unhandled exceptions to prevent stack trace leakage.
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  const server = await app.listen(port, '0.0.0.0');
  // رفع مهلة اتصال السيرفر لـ 10 دقائق لضمان اكتمال رفع الفيديوهات الكبيرة
  server.setTimeout(600000);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}
bootstrap();
