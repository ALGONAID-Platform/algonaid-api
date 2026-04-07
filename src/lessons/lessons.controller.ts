import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayloadType } from 'src/utils/types';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as multer from 'multer';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('pdf', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req: any, file: any, callback: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `lesson-pdf-${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (req: any, file: any, callback: any) => {
      if (!file.originalname.match(/\.(pdf)$/)) {
        return callback(new BadRequestException('Only PDF files are allowed!'), false);
      }
      callback(null, true);
    },
  }))
  @ApiOperation({ summary: 'Create a new lesson with optional PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        videoUrl: { type: 'string' },
        exam: { type: 'string' },
        order: { type: 'integer' },
        moduleId: { type: 'integer' },
        pdf: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'The lesson has been successfully created.' })
  create(
    @Body() createLessonDto: CreateLessonDto, 
    @CurrentUser() user: JwtPayloadType,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (file) {
      createLessonDto.pdfUrl = `uploads/${file.filename}`;
    }
    return this.lessonsService.create(createLessonDto, user.id);
  }

  @Get('module/:moduleId')
  @ApiOperation({ summary: 'Get all lessons for a specific module' })
  findAllByModule(@Param('moduleId', ParseIntPipe) moduleId: number) {
    return this.lessonsService.findAllByModule(moduleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific lesson by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('pdf', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req: any, file: any, callback: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `lesson-pdf-${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (req: any, file: any, callback: any) => {
      if (!file.originalname.match(/\.(pdf)$/)) {
        return callback(new BadRequestException('Only PDF files are allowed!'), false);
      }
      callback(null, true);
    },
  }))
  @ApiOperation({ summary: 'Update a lesson with optional PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        videoUrl: { type: 'string' },
        exam: { type: 'string' },
        order: { type: 'integer' },
        moduleId: { type: 'integer' },
        pdf: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateLessonDto: UpdateLessonDto, 
    @CurrentUser() user: JwtPayloadType,
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
  @ApiOperation({ summary: 'Delete a lesson' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayloadType) {
    return this.lessonsService.remove(id, user.id);
  }
}
