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
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,         // سنة كاملة
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS — مع تحذير إذا لم يُحدَّد CORS_ORIGINS في الإنتاج
  const rawOrigins = process.env.CORS_ORIGINS;
  if (!rawOrigins && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  [SECURITY] CORS_ORIGINS is not set in production! Defaulting to localhost only.');
  }
  const allowedOrigins = (rawOrigins || 'http://localhost:3000,http://localhost:5000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
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
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Only expose Swagger documentation in non-production environments.
  if (process.env.NODE_ENV !== 'production') {
    const documentation = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("swagger", app, documentation);
  }

  // Catch all unhandled exceptions to prevent stack trace leakage.
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
