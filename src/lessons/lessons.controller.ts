import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { LessonsService } from './lessons.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateLiveStatusDto } from './dto/update-live-status.dto';
import { CreateLessonPdfDto } from './dto/create-lesson-pdf.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { pdfFileSizeLimit } from 'src/utils/conistants';
import { SwaggerCreateLesson, SwaggerGetAllLessonsByModule, SwaggerGetLesson, SwaggerUpdateLesson, SwaggerDeleteLesson } from './decorators/swagger.decorator';
import * as types from 'src/utils/types';
import { UploadcareStorageService } from 'src/utils/uploadcare-storage.service';
 
// فلتر مخصص للـ PDF فقط
const pdfFileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new BadRequestException('مسموح برفع ملفات PDF فقط'), false);
  }
};
@ApiTags('lessons')
@ApiBearerAuth('JWT-auth')
@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly uploadcareStorageService: UploadcareStorageService,
  ) { }

  @Post()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('pdf', { fileFilter: pdfFileFilter }))
  @SwaggerCreateLesson()
  async create(
    @Body() createLessonDto: CreateLessonDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: pdfFileSizeLimit }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
        fileIsRequired: false,
      }),
    ) file?: Express.Multer.File
  ) {
    if (file) {
      createLessonDto.pdfUrl = await this.uploadcareStorageService.upload(file);
    }
    return this.lessonsService.create(createLessonDto, user.id);
  }

  @Get('course/:courseId')
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all lessons for a specific course' })
  findAllByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.lessonsService.findAllByCourse(courseId, user.id);
  }

  @Get('course/:courseId/guest')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get all lessons for a specific course for guest' })
  findAllByCourseGuest(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.lessonsService.findAllByCourse(courseId);
  }

  @Get('module/:moduleId')
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @SwaggerGetAllLessonsByModule()
  findAllByModule(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '8',
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.lessonsService.findAllByModule(moduleId, +page, +limit, user.id);
  }

  @Get('module/:moduleId/guest')
  @SkipThrottle()
  @SwaggerGetAllLessonsByModule()
  findAllByModuleGuest(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '8'
  ) {
    return this.lessonsService.findAllByModule(moduleId, +page, +limit);
  }

  @Get('latest-enrolled')
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  findLatestEnrolledLessons(@CurrentUser() user: types.JwtPayloadType) {
    return this.lessonsService.findLatestEnrolledLessons(user.id);
  }

  @Get(':id')
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @SwaggerGetLesson()
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.lessonsService.findOne(id, user.id);
  }

  @Get(':id/guest')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get lesson details for guest (masked if paid/locked)' })
  findOneGuest(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.findOne(id);
  }

  @Patch(':id/live-status')
  @ApiOperation({ summary: 'Update live status and recording URL of a lesson' })
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  updateLiveStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLiveStatusDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.lessonsService.updateLiveStatus(id, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('pdf', { fileFilter: pdfFileFilter }))
  @SwaggerUpdateLesson()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLessonDto: UpdateLessonDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: pdfFileSizeLimit }),
          new FileTypeValidator({ fileType: 'application/pdf' }), 
        ],
        fileIsRequired: false,
      }),
    ) file?: Express.Multer.File
  ) {
    if (file) {
      updateLessonDto.pdfUrl = await this.uploadcareStorageService.upload(file);
    }
    return this.lessonsService.update(id, updateLessonDto, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @SwaggerDeleteLesson()
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.lessonsService.remove(id, user.id);
  }

  @Get(':id/pdfs')
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all PDF files for a lesson' })
  getPdfs(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.lessonsService.getPdfs(id, user.id);
  }

  @Post(':id/pdfs')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('file', { fileFilter: pdfFileFilter }))
  @ApiOperation({ summary: 'Add a PDF file to a lesson' })
  async addPdf(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLessonPdfDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: pdfFileSizeLimit }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    if (file) {
      dto.url = await this.uploadcareStorageService.upload(file);
      if (!dto.title && file.originalname) {
        dto.title = file.originalname.replace(/\.pdf$/i, '');
      }
    }
    if (!dto.url) {
      throw new BadRequestException('يجب توفير ملف PDF أو رابط للملف');
    }
    return this.lessonsService.addPdf(id, dto, user.id);
  }

  @Delete(':id/pdfs/:pdfId')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Delete a PDF file from a lesson' })
  removePdf(
    @Param('id', ParseIntPipe) id: number,
    @Param('pdfId', ParseIntPipe) pdfId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.lessonsService.removePdf(id, pdfId, user.id);
  }
}
