import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { GradesService } from './grades.service';
import { BulkSaveGradesDto, UpdateSingleGradeDto } from './dto/bulk-save-grades.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';

@ApiTags('grades')
@ApiBearerAuth('JWT-auth')
@Controller('grades')
@UseGuards(AuthRollGuard)
@SkipThrottle()
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get('courses/:courseId')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب ملخص وسجلات درجات طلاب الدورة كاملة' })
  @ApiParam({ name: 'courseId', type: Number })
  getCourseGradesOverview(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.gradesService.getCourseGradesOverview(courseId, user.id, user.role);
  }

  @Get('courses/:courseId/students/:studentId')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({
    summary:
      'جلب جدول درجات وحضور طالب معين في الدورة (درجات التكاليف لكل درس، درجات الاختبارات، الحضور، مع المجموع)',
  })
  @ApiParam({ name: 'courseId', type: Number })
  @ApiParam({ name: 'studentId', type: Number })
  getStudentCourseGrades(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.gradesService.getStudentCourseGrades(
      courseId,
      studentId,
      user.id,
      user.role,
    );
  }

  @Get('courses/:courseId/student/:studentId')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'مسار بديل لجلب جدول درجات طالب معين في الدورة' })
  getStudentCourseGradesAlias(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.gradesService.getStudentCourseGrades(
      courseId,
      studentId,
      user.id,
      user.role,
    );
  }

  @Post('courses/:courseId/bulk')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'حفظ وتحديث درجات التكاليف دفعة واحدة من لوحة التحكم' })
  @ApiParam({ name: 'courseId', type: Number })
  saveBulkGrades(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() dto: BulkSaveGradesDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.gradesService.saveBulkGrades(courseId, user.id, user.role, dto);
  }

  @Patch('courses/:courseId/students/:studentId/assignments/:assignmentId')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تحديث درجة تكليف لطالب معين' })
  updateSingleGrade(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: UpdateSingleGradeDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.gradesService.updateSingleGrade(
      courseId,
      studentId,
      assignmentId,
      user.id,
      user.role,
      dto,
    );
  }

  @Put('courses/:courseId/students/:studentId/assignments/:assignmentId')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'مسار بديل PUT لتحديث درجة تكليف لطالب معين' })
  updateSingleGradePut(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: UpdateSingleGradeDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.gradesService.updateSingleGrade(
      courseId,
      studentId,
      assignmentId,
      user.id,
      user.role,
      dto,
    );
  }
}
