import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { PracticeExamsService } from './practice-exams.service';
import { CreatePracticeExamDto } from './dto/create-practice-exam.dto';
import { UpdatePracticeExamDto } from './dto/update-practice-exam.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { OptionalAuthGuard } from 'src/auth/guards/optional-auth.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('practice-exams')
@ApiBearerAuth('JWT-auth')
@Controller('practice-exams')
export class PracticeExamsController {
  constructor(private readonly practiceExamsService: PracticeExamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new practice exam' })
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  create(@Body() createPracticeExamDto: CreatePracticeExamDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.practiceExamsService.create(createPracticeExamDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all practice exams (optionally filtered by courseId)' })
  @UseGuards(OptionalAuthGuard)
  findAll(
    @Query('courseId') courseId?: string,
    @CurrentUser() user?: types.JwtPayloadType,
  ) {
    return this.practiceExamsService.findAll(courseId ? +courseId : undefined, user?.id);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Get all practice exams for a specific course' })
  @UseGuards(OptionalAuthGuard)
  findByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user?: types.JwtPayloadType,
  ) {
    return this.practiceExamsService.findAll(courseId, user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific practice exam by ID' })
  @UseGuards(OptionalAuthGuard)
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: types.JwtPayloadType,
  ) {
    return this.practiceExamsService.findOne(id, user?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a practice exam by ID' })
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePracticeExamDto: UpdatePracticeExamDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.practiceExamsService.update(id, updatePracticeExamDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a practice exam by ID' })
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.practiceExamsService.remove(id, user.id);
  }
}
