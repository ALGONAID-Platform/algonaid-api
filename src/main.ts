import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger/swagger.config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Initialize Firebase Admin
  try {
    initializeApp({
      credential: applicationDefault(),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin', error);
  }

  app.setGlobalPrefix('api/v1', {
    exclude: ['modulesList/:courseId', 'lessonDetails/:lessonId'],
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
    setHeaders: (res, path, stat) => {
      // Ensure correct content-type for apple-app-site-association (iOS requires application/json)
      if (path.endsWith('apple-app-site-association')) {
        res.set('Content-Type', 'application/json');
      }
    }
  });

  app.enableCors({
    // origin: "http://localhost:5000"
    origin: true,
    credentials: true,
  });

  const documentation = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("swagger", app, documentation);
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
 