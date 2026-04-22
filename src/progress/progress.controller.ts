import { Controller, Post, Param, Get, UseGuards, ParseIntPipe, Body } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as types from 'src/utils/types';
import { UpdateProgressDto } from './dto/update-progress.dto';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
@UseGuards(AuthRollGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('update')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Update or create lesson progress' })
  updateLessonProgress(
    @Body() updateProgressDto: UpdateProgressDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.progressService.updateProgress(user.id, updateProgressDto);
  }


  @Get('course/:courseId')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Get course progress percentage' })
  getCourseProgress(@Param('courseId', ParseIntPipe) courseId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getCourseProgress(user.id, courseId);
  }

  @Get('last-watched')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Get the last watched lesson progress' })
  getLastWatched(@CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getLastWatched(user.id);
  }

  @Get('last-accessed-module')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Get progress data for the last accessed module' })
  getLastAccessedModule(@CurrentUser() user: types.JwtPayloadType) {
    return this.progressService.getLastAccessedModuleProgress(user.id);
  }
}
