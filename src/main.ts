import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {  SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');


  app.enableCors({
    origin: "http://localhost:5000"
  })

  
  const documentaion = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup("swagger", app, documentaion)
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
