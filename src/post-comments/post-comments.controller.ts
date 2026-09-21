import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PostCommentsService } from './post-comments.service';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { UpdatePostCommentDto } from './dto/update-post-comment.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';
import { VerifiedOnlyGuard } from 'src/auth/guards/verified-only.guard';

@ApiTags('post-comments')
@Controller('posts/:postId/comments')
export class PostCommentsController {
  constructor(private readonly postCommentsService: PostCommentsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'إضافة تعليق أو رد على منشور (متاح للمؤكدين فقط)' })
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreatePostCommentDto,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.postCommentsService.create(postId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'جلب تعليقات المنشور مع الردود' })
  findAll(@Param('postId', ParseIntPipe) postId: number) {
    return this.postCommentsService.findAllByPost(postId);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تعديل تعليق (لصاحب التعليق أو الأدمن)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostCommentDto,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.postCommentsService.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'حذف تعليق (لصاحب التعليق أو الأدمن)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.postCommentsService.remove(id, user.id, user.role);
  }
}
