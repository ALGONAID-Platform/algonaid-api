import { Module } from '@nestjs/common';
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
import { PaymentsModule } from './payments/payments.module';
import { AssignmentsModule } from './assignments/assignments.module';

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
    AssignmentsModule,
    ProgressModule,
    UsersModule,
    CommentsModule,
    PracticeExamsModule,
    PostsModule,
    PostCommentsModule,
    PaymentsModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 1000,
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService, 
    UploadcareStorageService,
  ],
})
export class AppModule { }
