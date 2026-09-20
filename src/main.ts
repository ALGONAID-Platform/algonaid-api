import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';

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
    exclude: ['modulesList/:courseId', 'lessonDetails/:courseId/:lessonId', 'lessonDetails/:lessonId', '.well-known/assetlinks.json', '.well-known/apple-app-site-association'],
  }); 

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  })); 
 
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
    setHeaders: (res, path, stat) => {
      if (path.endsWith('apple-app-site-association')) {
        res.set('Content-Type', 'application/json');
      }
      res.set('X-Content-Type-Options', 'nosniff');
    }
  });
app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // CORS is restricted to explicitly configured frontends.
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5000').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    credentials: true,
  });

  const documentation = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("swagger", app, documentation);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
