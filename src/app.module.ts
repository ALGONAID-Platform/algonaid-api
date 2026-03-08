import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { JwtModule } from '@nestjs/jwt';
import { CoursesModule } from './courses/courses.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'defaultSecret',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_SECRET') as any },
      }),
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    EnrollmentModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`
      // envFilePath: `.env.${process.env.NODE_ENV}`

    }),
    CoursesModule,
 
  ],
  controllers: [AppController],
  providers: [AppService],

})
export class AppModule { }
