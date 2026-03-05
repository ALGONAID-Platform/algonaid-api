import { Body, Controller, Post, Req } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';

@Controller('enrollment')
export class EnrollmentController {

    @Post() // التسجيل
  enroll(@Body() createDto: CreateEnrollmentDto, @Req() req : number) {
    // req.user.studentId يأتي من الـ Token
    // return this.enrollmentService.create(req.user.studentId, createDto.courseId);
  }

}
