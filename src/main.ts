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
 
  // Add a raw Express route for /posts/:id to return the redirect HTML page.
  // This avoids conflicts with the /api/v1/posts API endpoints.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/posts/:id', (req, res) => {
    const appService = app.get(AppService);
    res.send(appService.getRedirectPage('post', req.params.id));
  });

  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
    setHeaders: (res, path, stat) => {
      if (path.endsWith('apple-app-site-association')) {
        res.set('Content-Type', 'application/json');
      }
    }
  });
app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // إعدادات CORS صريحة لدعم الـ Preflight والـ Localhost
  app.enableCors({
    origin: true,
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
