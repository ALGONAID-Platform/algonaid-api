import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  Put,
  Delete,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';

import { ExamsService } from './exams.service';
import { LeaderboardService } from './leaderboard.service';
import { CreateExamDto, CreateQuestionDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { VerifiedOnlyGuard } from 'src/auth/guards/verified-only.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UploadcareStorageService } from 'src/utils/uploadcare-storage.service';
import * as types from 'src/utils/types';

@ApiTags('exams')
@ApiBearerAuth('JWT-auth')
@Controller('exams')
@UseGuards(AuthRollGuard)
@SkipThrottle()
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly leaderboardService: LeaderboardService,
    private readonly uploadcareStorageService: UploadcareStorageService,
  ) {}

  @Get()
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب جميع الاختبارات' })
  findAll(@CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.findAll(user.id, user.role);
  }

  @Get('course/:courseId')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب اختبار كورس معين' })
  @ApiParam({ name: 'courseId', description: 'معرّف الكورس' })
  getExamByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user?: types.JwtPayloadType,
  ) {
    return this.examsService.getExamByCourse(courseId, user?.id);
  }

  @Get('home')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب أحدث اختبارات الكورسات المسجل فيها الطالب للصفحة الرئيسية (الجارية والقادمة والمنتهية حديثاً)' })
  getHomeExams(@CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.getHomeExams(user.id, user.role);
  }

  @Get('enrolled')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب اختبارات الكورسات المسجل فيها الطالب' })
  getEnrolledExams(@CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.getHomeExams(user.id, user.role);
  }

  @Post('upload-image')
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'رفع صورة للاختبار' })
  @ApiConsumes('multipart/form-data')
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|gif)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    const imageUrl = await this.uploadcareStorageService.upload(file);
    return { imageUrl };
  }

  @Post()
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'إنشاء اختبار جديد (درس أو كورس أو تحدي)' })
  @ApiBody({ type: CreateExamDto })
  @ApiResponse({ status: 201, description: 'تم إنشاء الاختبار بنجاح' })
  createExam(
    @Body() createExamDto: CreateExamDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.createExam(user.id, user.role, createExamDto);
  }

  @Get(':id')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب تفاصيل اختبار معين' })
  @ApiParam({ name: 'id', description: 'معرّف الاختبار' })
  getExam(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.getExam(id, user.id);
  }

  @Post(':examId/questions')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'إضافة سؤال جديد للاختبار (الأدمن/المالك فقط)' })
  @ApiParam({ name: 'examId', description: 'معرّف الاختبار' })
  addQuestion(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.addQuestion(user.id, user.role, examId, dto);
  }

  @Patch('questions/:questionId')
  @Put('questions/:questionId')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تعديل سؤال وخياراته (الأدمن/المالك فقط)' })
  @ApiParam({ name: 'questionId', description: 'معرّف السؤال' })
  updateQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.updateQuestion(user.id, user.role, questionId, dto);
  }

  @Delete('questions/:questionId')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'حذف سؤال من الاختبار (الأدمن/المالك فقط)' })
  @ApiParam({ name: 'questionId', description: 'معرّف السؤال' })
  deleteQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.deleteQuestion(user.id, user.role, questionId);
  }

  @Patch(':id')
  @Put(':id')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تحديث اختبار (الأدمن/المالك فقط)' })
  @ApiParam({ name: 'id', description: 'معرّف الاختبار' })
  updateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateExamDto: UpdateExamDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.updateExam(user.id, user.role, id, updateExamDto);
  }

  @Delete(':id')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'حذف اختبار (الأدمن/المالك فقط)' })
  @ApiParam({ name: 'id', description: 'معرّف الاختبار' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.deleteExam(user.id, user.role, id);
  }

  @Get(':id/leaderboard')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'قائمة الشرف للاختبار' })
  @ApiParam({ name: 'id', description: 'معرّف الاختبار' })
  getLeaderboard(@Param('id', ParseIntPipe) id: number) {
    return this.leaderboardService.getLeaderboard(id);
  }

  @Get(':id/my-result')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب نتيجتي التفصيلية مع الإجابات الصح/الغلط' })
  @ApiParam({ name: 'id', description: 'معرّف الاختبار' })
  getMyResult(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.leaderboardService.getMyResult(id, user.id);
  }

  @Get(':id/stats')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'إحصائيات شاملة للاختبار (متاحة بعد انتهاء التحدي)' })
  @ApiParam({ name: 'id', description: 'معرّف الاختبار' })
  getStats(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.leaderboardService.getStats(id, user.id, user.role);
  }

  @Post(':examId/start')
  @UseGuards(VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'بدء محاولة جديدة للاختبار وجلب الأسئلة' })
  @ApiParam({ name: 'examId', description: 'معرّف الاختبار' })
  startExam(
    @Param('examId', ParseIntPipe) examId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.startExam(user.id, examId);
  }

  @Get(':examId/questions')
  @UseGuards(VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب أسئلة الاختبار وبدء المحاولة مع التحقق الشامل' })
  @ApiParam({ name: 'examId', description: 'معرّف الاختبار' })
  getExamQuestions(
    @Param('examId', ParseIntPipe) examId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.startExam(user.id, examId);
  }

  @Post('attempts/:attemptId/submit')
  @UseGuards(VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تسليم إجابات الاختبار' })
  @ApiParam({ name: 'attemptId', description: 'معرّف المحاولة' })
  @ApiBody({ type: SubmitExamDto })
  submitExam(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Body() submission: SubmitExamDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.submitExam(user.id, attemptId, submission);
  }

  @Get('attempts/:attemptId/result')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب نتيجة محاولة معينة' })
  @ApiParam({ name: 'attemptId', description: 'معرّف المحاولة' })
  getResult(
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.getResult(user.id, attemptId);
  }
}
