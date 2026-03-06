import { Module } from '@nestjs/common';
import { EnrollmentController } from './controller/enrollment.controller';
import { EnrollmentService } from './service/enrollment.service';
import { AuthService } from 'src/auth/services/auth.services';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [EnrollmentService],
  controllers: [EnrollmentController],
  exports: [EnrollmentService],
  imports :[AuthModule]
})
export class EnrollmentModule { }
