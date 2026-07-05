import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'defaultSecret',
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_SECRET') || '30d') as any },
      }),
    }),
    AuthModule,
    PrismaModule,
    EnrollmentModule,
    CoursesModule,
    LessonsModule,
    ModulesModule,
    ExamsModule,
    ProgressModule,
    UsersModule,
    PracticeExamsModule,
  ],
  controllers: [AppController],
  providers: [AppService, UploadcareStorageService],
})
export class AppModule { }
