import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { Role, SubmissionStatus } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';

@ApiTags('assignments')
@ApiBearerAuth('JWT-auth')
@Controller('assignments')
@UseGuards(AuthRollGuard)
@SkipThrottle()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'إنشاء تكليف جديد لدرس معين (مع إمكانية رفع ملف مرفق)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('attachment'))
  create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.assignmentsService.create(user.id, user.role, dto, file);
  }

  @Patch(':id')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تحديث بيانات التكليف' })
  @ApiParam({ name: 'id', description: 'معرّف التكليف' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('attachment'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.assignmentsService.update(user.id, user.role, id, dto, file);
  }

  @Delete(':id')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'حذف التكليف' })
  @ApiParam({ name: 'id', description: 'معرّف التكليف' })
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.assignmentsService.delete(user.id, user.role, id);
  }

  @Get('lesson/:lessonId')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب التكليف المرتبط بدرس معين مع حالة تسليم الطالب إن وجدت' })
  @ApiParam({ name: 'lessonId', description: 'معرّف الدرس' })
  findByLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.assignmentsService.findByLessonId(lessonId, user.id, user.role);
  }

  @Get(':id')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب تفاصيل التكليف' })
  @ApiParam({ name: 'id', description: 'معرّف التكليف' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.assignmentsService.findOne(id, user.id);
  }

  @Post(':id/submit')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تسليم التكليف من قبل الطالب (يدعم رفع ملف ونص الإجابة/الرابط)' })
  @ApiParam({ name: 'id', description: 'معرّف التكليف' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file'))
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitAssignmentDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.assignmentsService.submitAssignment(user.id, id, dto, file);
  }

  @Get(':id/my-submission')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب تسليم الطالب الحالي للتكليف ودرجته وملاحظات المعلم' })
  @ApiParam({ name: 'id', description: 'معرّف التكليف' })
  getMySubmission(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.assignmentsService.getMySubmission(user.id, id);
  }

  @Get(':id/submissions')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب كافة تسليمات الطلاب للتكليف للمراجعة والتصحيح' })
  @ApiParam({ name: 'id', description: 'معرّف التكليف' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', enum: SubmissionStatus, required: false })
  getSubmissions(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: SubmissionStatus,
  ) {
    return this.assignmentsService.findSubmissions(
      user.id,
      user.role,
      id,
      +page,
      +limit,
      status,
    );
  }

  @Get('submissions/:submissionId')
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب تفاصيل تسليم محدد' })
  @ApiParam({ name: 'submissionId', description: 'معرّف التسليم' })
  getSubmission(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.assignmentsService.getSubmissionById(user.id, user.role, submissionId);
  }

  @Post('submissions/:submissionId/grade')
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تقييم وتصحيح تسليم الطالب، وضع الدرجة، التعليق، وصورة التوضيح' })
  @ApiParam({ name: 'submissionId', description: 'معرّف التسليم' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('feedbackImage'))
  gradeSubmission(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Body() dto: GradeSubmissionDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile() feedbackImage?: Express.Multer.File,
  ) {
    return this.assignmentsService.gradeSubmission(
      user.id,
      user.role,
      submissionId,
      dto,
      feedbackImage,
    );
  }
}
