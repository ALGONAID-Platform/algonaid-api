import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { allowedFileTypes, pdfFileSizeLimit, uploadsFolder } from 'src/utils/conistants';
import { SwaggerCreateLesson, SwaggerGetAllLessonsByModule, SwaggerGetLesson, SwaggerUpdateLesson, SwaggerDeleteLesson } from './decorators/swagger.decorator';
import * as types from 'src/utils/types';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) { }

  @Post()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('pdf'))
  @SwaggerCreateLesson()
  create(
    @Body() createLessonDto: CreateLessonDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: pdfFileSizeLimit }), // الحد الأقصى 10 ميجابايت
          new FileTypeValidator({ fileType: allowedFileTypes[0] }), // يقبل PDF فقط
        ],
        fileIsRequired: false,
      }),

    ) file?: Express.Multer.File
  ) {

    return this.lessonsService.create(createLessonDto, user.id, file);
  }

  @Get('module/:moduleId')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @SwaggerGetAllLessonsByModule()
  findAllByModule(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.lessonsService.findAllByModule(moduleId, user.id);
  }

  @Get(':id')
  @SwaggerGetLesson()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('pdf'))
  @SwaggerUpdateLesson()
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLessonDto: UpdateLessonDto,
    @CurrentUser() user: types.JwtPayloadType,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (file) {
      updateLessonDto.pdfUrl = `uploads/${file.filename}`;
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
}
