import { Controller, Post, Body, Param, Get, Patch, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import * as types from 'src/utils/types';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
@UseGuards(AuthRollGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Create a new exam (Admin/Owner only)' })
  @ApiBody({ type: CreateExamDto })
  @ApiResponse({ status: 201, description: 'Exam created successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Only the course instructor or owner can create exams.' })
  createExam(@Body() createExamDto: CreateExamDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.createExam(user.id, user.role, createExamDto);
  }

  @Patch(':id')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Update an exam (Admin/Owner only)' })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiBody({ type: UpdateExamDto })
  @ApiResponse({ status: 200, description: 'Exam updated successfully.' })
  updateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateExamDto: UpdateExamDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.updateExam(user.id, user.role, id, updateExamDto);
  }

  @Delete(':id')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Delete an exam (Admin/Owner only)' })
  @ApiParam({ name: 'id', description: 'Exam ID' })
  @ApiResponse({ status: 200, description: 'Exam deleted successfully.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.deleteExam(user.id, user.role, id);
  }

  @Post(':examId/start')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Start a new exam attempt' })
  @ApiParam({ name: 'examId', description: 'ID of the exam to start' })
  @ApiResponse({ status: 201, description: 'Attempt started. Returns questions (without correct answers).' })
  startExam(@Param('examId', ParseIntPipe) examId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.startExam(user.id, examId);
  }

  @Post('attempts/:attemptId/submit')
  @userRoles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit answers for an exam attempt' })
  @ApiParam({ name: 'attemptId', description: 'ID of the active attempt' })
  @ApiBody({ type: SubmitExamDto })
  @ApiResponse({ status: 201, description: 'Exam submitted and graded.' })
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
  @ApiParam({ name: 'attemptId', description: 'ID of the completed attempt' })
  @ApiResponse({ status: 200, description: 'Detailed results including correct/incorrect indicators.' })
  getResult(@Param('attemptId', ParseIntPipe) attemptId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.getResult(user.id, attemptId);
  }
}
