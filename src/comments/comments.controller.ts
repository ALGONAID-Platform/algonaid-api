import { Controller, Post, Get, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Req, Query, UseInterceptors, UploadedFile, BadRequestException, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadcareStorageService } from '../utils/uploadcare-storage.service';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AuthRollGuard } from '../auth/guards/auth-roll.guard';
import { VerifiedOnlyGuard } from '../auth/guards/verified-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { userRoles } from '../auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import * as types from '../utils/types';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('comments')
@ApiBearerAuth('JWT-auth')
@SkipThrottle()
@Controller('comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly uploadcareStorageService: UploadcareStorageService
  ) {}

  @Post('upload-image')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload an image for a comment and get its URL' })
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB limit
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|gif)$/ }), // images only
        ],
        fileIsRequired: true,
      }),
    ) file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    const imageUrl = await this.uploadcareStorageService.upload(file, 'comments');
    return { imageUrl };
  }

  @Post()
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Create a new comment or reply' })
  create(@Body() createCommentDto: CreateCommentDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.commentsService.create(user.id, createCommentDto);
  }

  @Get('lesson/:lessonId')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all comments and replies for a lesson' })
  getByLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.commentsService.getCommentsByLesson(lessonId, user.id);
  }

  @Get('exam/:examId')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all comments and replies for an exam/challenge' })
  getByExam(
    @Param('examId', ParseIntPipe) examId: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.commentsService.getCommentsByExam(examId, user.id);
  }

  @Get('course/:courseId/latest')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get the latest comments across all lessons in a course' })
  getLatestByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Query('limit') limit?: string
  ) {
    const limitNumber = Math.min(limit ? parseInt(limit, 10) : 5, 50); // max 50
    return this.commentsService.getLatestCommentsByCourse(courseId, limitNumber);
  }

  @Patch(':id')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Update a comment' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body('text') text: string,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.commentsService.update(user.id, id, text);
  }

  @Delete(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Delete a comment' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.commentsService.remove(user.id, user.role, id);
  }

  @Get('mentions/my')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all mentions for the current user' })
  getMyMentions(
    @CurrentUser() user: types.JwtPayloadType,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNumber = Math.max(page ? parseInt(page, 10) : 1, 1);
    const limitNumber = Math.min(limit ? parseInt(limit, 10) : 20, 100); // max 100
    return this.commentsService.getMyMentions(user.id, user.role, pageNumber, limitNumber);
  }

  @Get('mentions/unread-count')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get unread mentions count for the current user' })
  getUnreadMentionsCount(@CurrentUser() user: types.JwtPayloadType) {
    return this.commentsService.getUnreadMentionsCount(user.id, user.role);
  }

  @Patch('mentions/:id/read')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Mark a mention as read' })
  markMentionAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.commentsService.markMentionAsRead(user.id, user.role, id);
  }
}
 