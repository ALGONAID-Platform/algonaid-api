import { Controller, Post, Param, Get, UseGuards, ParseIntPipe, Body } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as types from 'src/utils/types';
import { UpdateProgressDto } from './dto/update-progress.dto';

@ApiTags('progress')
@ApiBearerAuth('JWT-auth')
@Controller('progress')
@UseGuards(AuthRollGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('update')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Update or create lesson progress' })
  updateLessonProgress(
    @Body() updateProgressDto: UpdateProgressDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.progressService.updateProgress(user.id, updateProgressDto);
  }


  @Get('course/:courseId')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get course progress percentage' })
  getCourseProgress(@Param('courseId', ParseIntPipe) courseId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getCourseProgress(user.id, courseId);
  }

  @Get('last-watched')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get the last watched lesson progress' })
  getLastWatched(@CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getLastWatched(user.id);
  }

  @Get('last-accessed-module')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get progress data for the last accessed module' })
  getLastAccessedModule(@CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getLastAccessedModuleProgress(user.id);
  }

  @Get('excellence-courses')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get completed courses with an average grade of 90% or higher' })
  getExcellenceCourses(@CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getExcellenceCourses(user.id);
  }

  @Get('course/:courseId/excellence-modules')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get completed modules with an average grade of 90% or higher for a specific course' })
  getExcellenceModules(@Param('courseId', ParseIntPipe) courseId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getExcellenceModules(user.id, courseId);
  }

  @Get('module/:moduleId/grades')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get exam grades and average percentage for a module' })
  getModuleGrades(@Param('moduleId', ParseIntPipe) moduleId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getModuleGrades(user.id, moduleId);
  }

  @Get('course/:courseId/grades')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get exam grades and average percentage for a course' })
  getCourseGrades(@Param('courseId', ParseIntPipe) courseId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getCourseGrades(user.id, courseId);
  }
  @Get('total-points')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get total points earned by the student across all exams' })
  getTotalEarnedPoints(@CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getTotalEarnedPoints(user.id);
  } 
}
