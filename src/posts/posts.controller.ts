import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';
import { VerifiedOnlyGuard } from 'src/auth/guards/verified-only.guard';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('posts')
@SkipThrottle()
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'إنشاء منشور جديد (لأدمن فقط)' })
  create(@Body() createPostDto: CreatePostDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.postsService.create(createPostDto, user.id);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب جميع المنشورات' })
  findAll(
    @CurrentUser() user: types.JwtPayloadType,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.postsService.findAll(user.id, cursor, limit);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'جلب منشور معين بالتفاصيل' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.postsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'تعديل المنشور (لأدمن فقط)' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updatePostDto: UpdatePostDto,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.postsService.update(id, updatePostDto, user.id, user.role);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'حذف المنشور (لأدمن فقط)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.postsService.remove(id, user.id, user.role);
  }

  @Post(':id/like')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'إضافة/إزالة إعجاب بالمنشور (Toggle)' })
  toggleLike(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.postsService.toggleLike(id, user.id);
  }

  @Post(':id/poll/vote')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'التصويت على استطلاع (للطلاب والمؤكدين فقط)' })
  votePoll(
    @Param('id', ParseIntPipe) id: number,
    @Body('optionId', ParseIntPipe) optionId: number,
    @CurrentUser() user: types.JwtPayloadType
  ) {
    return this.postsService.votePoll(id, optionId, user.id);
  }
}
