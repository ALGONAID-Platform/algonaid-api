import { Controller, Post, Body, Param, Get, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as types from 'src/utils/types';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
@UseGuards(AuthRollGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post(':examId/start')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Start a new exam attempt' })
  startExam(@Param('examId', ParseIntPipe) examId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.startExam(user.id, examId);
  }

  @Post('attempts/:attemptId/submit')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit answers for an exam attempt' })
  submitExam(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Body() submission: SubmitExamDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.submitExam(user.id, attemptId, submission);
  }

  @Get('attempts/:attemptId/result')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Fetch result of an exam attempt' })
  getResult(@Param('attemptId', ParseIntPipe) attemptId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.getResult(user.id, attemptId);
  }
}
