import { Controller, Post, Get, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Req, Query } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AuthRollGuard } from '../auth/guards/auth-roll.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { userRoles } from '../auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import * as types from '../utils/types';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('comments')
@ApiBearerAuth('JWT-auth')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Create a new comment or reply' })
  create(@Body() createCommentDto: CreateCommentDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.commentsService.create(user.id, createCommentDto);
  }

  @Get('lesson/:lessonId')
  @ApiOperation({ summary: 'Get all comments and replies for a lesson' })
  getByLesson(@Param('lessonId', ParseIntPipe) lessonId: number) {
    return this.commentsService.getCommentsByLesson(lessonId);
  }

  @Get('course/:courseId/latest')
  @ApiOperation({ summary: 'Get the latest comments across all lessons in a course' })
  getLatestByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Query('limit') limit?: string
  ) {
    const limitNumber = limit ? parseInt(limit, 20) : 5;
    return this.commentsService.getLatestCommentsByCourse(courseId, limitNumber);
  }

  @Patch(':id')
  @UseGuards(AuthRollGuard)
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
}
