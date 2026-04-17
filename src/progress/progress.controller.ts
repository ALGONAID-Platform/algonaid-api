import { Controller, Post, Param, Get, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as types from 'src/utils/types';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
@UseGuards(AuthRollGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('lesson/:lessonId/complete')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Mark a lesson as completed' })
  completeLesson(@Param('lessonId', ParseIntPipe) lessonId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.completeLesson(user.id, lessonId);
  }

  @Get('course/:courseId')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Get course progress percentage' })
  getCourseProgress(@Param('courseId', ParseIntPipe) courseId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getCourseProgress(user.id, courseId);
  }
}
