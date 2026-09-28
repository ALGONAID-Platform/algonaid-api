import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
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
import { Role } from '@prisma/client';

import { ExamsService } from './exams.service';
import { LeaderboardService } from './leaderboard.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UploadcareStorageService } from 'src/utils/uploadcare-storage.service';
import * as types from 'src/utils/types';

@ApiTags('exams')
@ApiBearerAuth('JWT-auth')
@Controller('exams')
@UseGuards(AuthRollGuard)
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly leaderboardService: LeaderboardService,
    private readonly uploadcareStorageService: UploadcareStorageService,
  ) {}

  // =============================================
  // جلب جميع الاختبارات
  // =============================================
  @Get()
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب جميع الاختبارات' })
  findAll(@CurrentUser() user: types.JwtPayloadType) {
    return this.examsService.findAll(user.id, user.role);
  }

  // =============================================
  // جلب اختبار كورس معين
  // =============================================
  @Get('course/:courseId')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب اختبار كورس معين' })
  @ApiParam({ name: 'courseId', description: 'معرّف الكورس' })
  getExamByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.examsService.getExamByCourse(courseId);
  }

  // =============================================
  // رفع صورة للاختبار
  // =============================================
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

  // =============================================
  // إنشاء اختبار
  // =============================================
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

  // =============================================
  // جلب اختبار بالـ ID
  // =============================================
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

  // =============================================
  // تحديث اختبار
  // =============================================
  @Patch(':id')
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

  // =============================================
  // حذف اختبار
  // =============================================
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

  // =============================================
  // قائمة الشرف (Leaderboard)
  // =============================================
  @Get(':id/leaderboard')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'قائمة الشرف للاختبار' })
  @ApiParam({ name: 'id', description: 'معرّف الاختبار' })
  getLeaderboard(@Param('id', ParseIntPipe) id: number) {
    return this.leaderboardService.getLeaderboard(id);
  }

  // =============================================
  // نتيجتي التفصيلية
  // =============================================
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

  // =============================================
  // إحصائيات الاختبار
  // =============================================
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

  // =============================================
  // بدء محاولة الاختبار
  // =============================================
  @Post(':examId/start')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'بدء محاولة جديدة للاختبار' })
  @ApiParam({ name: 'examId', description: 'معرّف الاختبار' })
  startExam(
    @Param('examId', ParseIntPipe) examId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.examsService.startExam(user.id, examId);
  }

  // =============================================
  // تسليم الاختبار
  // =============================================
  @Post('attempts/:attemptId/submit')
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

  // =============================================
  // جلب نتيجة محاولة معينة
  // =============================================
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
