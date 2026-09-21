import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { JwtModule } from '@nestjs/jwt';
import { CoursesModule } from './courses/courses.module';
import { LessonsModule } from './lessons/lessons.module';
import { ModulesModule } from './modules/modules.module';
import { ExamsModule } from './exams/exams.module';
import { ProgressModule } from './progress/progress.module';
import { UsersModule } from './users/users.module';
import { UploadcareStorageService } from './utils/uploadcare-storage.service';
import { PracticeExamsModule } from './practice-exams/practice-exams.module';
import { MediaModule } from './media/media.module';
import { CommentsModule } from './comments/comments.module';

import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PostsModule } from './posts/posts.module';
import { PostCommentsModule } from './post-comments/post-comments.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`
    }),
    ServeStaticModule.forRoot({
      rootPath: join('/usr/src/app', 'uploads'),
      serveStaticOptions: { setHeaders: (res: any) => res.setHeader('X-Content-Type-Options', 'nosniff') },
      serveRoot: '/uploads',
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_SECRET') || '30d') as any },
      }),
    }),
    MediaModule,
    AuthModule,
    PrismaModule,
    EnrollmentModule,
    CoursesModule,
    LessonsModule,
    ModulesModule,
    ExamsModule,
    ProgressModule,
    UsersModule,
    CommentsModule,
    PracticeExamsModule,
    PostsModule,
    PostCommentsModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,      // 1 minute window
      limit: 120,      // 120 req/min globally — Auth endpoints override this with @Throttle({limit:5})
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService, 
    UploadcareStorageService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    }
  ],
})
export class AppModule { }
