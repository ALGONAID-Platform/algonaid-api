import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { EnrollmentService } from '../service/enrollment.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { UserRole } from 'src/auth/enums/userRole';
import { Role } from 'src/prisma/client/enums';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { SwaggerEnrollInCourse } from '../decorators/enrollment.decorator';

@Controller('enrollment')
export class EnrollmentController {

  constructor(
    private readonly enrollmentSevice: EnrollmentService
  ) {
  }

  @Post()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT)
  @SwaggerEnrollInCourse()
  enroll(@Body() createDto: CreateEnrollmentDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.enrollmentSevice.craete(user.id, createDto);
  }

  @Get('check-enrollment')
  @UseGuards(AuthRollGuard)
  async checkStatus(
    @Query('courseId') courseId: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return await this.enrollmentSevice.isUserEnrolled(user.id, courseId);
  }

}
