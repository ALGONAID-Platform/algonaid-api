import { Body, Controller, Get, Post, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { EnrollmentService } from '../service/enrollment.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { VerifiedOnlyGuard } from 'src/auth/guards/verified-only.guard';
import { UserRole } from 'src/auth/enums/userRole';
import { Role } from '@prisma/client';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { SwaggerEnrollInCourse } from '../decorators/enrollment.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('enrollment')
@ApiBearerAuth('JWT-auth')
@Controller('enrollment')
export class EnrollmentController {

  constructor(
    private readonly enrollmentSevice: EnrollmentService
  ) {
  }

  @Post()
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @SwaggerEnrollInCourse()
  enroll(@Body() createDto: CreateEnrollmentDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.enrollmentSevice.craete(user.id, createDto);
  }

  @ApiOperation({ summary: 'Check if current user is enrolled in a course' })
  @ApiResponse({ status: 200, description: 'Return true if enrolled, false otherwise.' })
  @Get('check-enrollment')
  @UseGuards(AuthRollGuard)
  async checkStatus(
    @Query('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return await this.enrollmentSevice.isUserEnrolled(user.id, courseId);
  }

}
