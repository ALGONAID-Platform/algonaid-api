import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { OptionalAuthGuard } from 'src/auth/guards/optional-auth.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { SwaggerCreateCourse, SwaggerDeleteCourse, SwaggerGetCourse, SwaggerUpdateCourse, SwaggerGetAllCourses, SwaggerSearchCourses, SwaggerGetKarttyCourses } from './decorators/swagger.decorator';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ConvertToRecordedDto } from './dto/convert-to-recorded.dto';

import { CoursesEvaluationService } from './courses-evaluation.service';

@ApiTags('courses')
@ApiBearerAuth('JWT-auth')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly coursesEvaluationService: CoursesEvaluationService,
  ) { }

  @Post()
  @SwaggerCreateCourse()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  create(@Body() createCourseDto: CreateCourseDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.create(createCourseDto, user.id);
  }

  @Get()
  @SkipThrottle()
  @SwaggerGetAllCourses()
  @UseGuards(OptionalAuthGuard)
  findAll(@CurrentUser() user?: types.JwtPayloadType) {
    return this.coursesService.findAll(user?.id, user?.role);
  }

  @Get("my-courses/recent")
  @SkipThrottle()
  @ApiOperation({ summary: 'Get up to 5 recent enrolled courses' })
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  findMyRecentCourses(@CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.findMyCourses(user.id, 5);
  }

  @Get("my-courses")
  @SkipThrottle()
  @SwaggerGetAllCourses()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  findMyCourses(@CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.findMyCourses(user.id);
  }

  @Get('search')
  @SkipThrottle()
  @SwaggerSearchCourses()
  @UseGuards(OptionalAuthGuard)
  search(@Query('q') query: string, @CurrentUser() user?: types.JwtPayloadType) {
    // Limit query length to prevent ReDoS and DB overload
    const safeQuery = (query || '').slice(0, 100).trim();
    return this.coursesService.search(safeQuery, user?.id);
  }

  @Get('paid')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get all paid courses (excludes already-enrolled courses for authenticated users)' })
  @UseGuards(OptionalAuthGuard)
  findPaidCourses(@CurrentUser() user?: types.JwtPayloadType) {
    return this.coursesService.findPaidCourses(user?.id);
  }

  @Get(['admin/paid', 'paid/admin'])
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all paid courses for admin (without enrollment exclusion)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findPaidCoursesForAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.findPaidCoursesForAdmin(
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get(['kartty', 'external/kartty'])
  @SkipThrottle()
  @SwaggerGetKarttyCourses()
  findPaidCoursesForKartty() {
    return this.coursesService.findPaidCoursesForKartty();
  }

  @Get(':id')
  @SkipThrottle()
  @SwaggerGetCourse()
  @UseGuards(OptionalAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user?: types.JwtPayloadType) {
    return this.coursesService.findOne(id, user?.id);
  }

  @Patch(':id/convert-to-recorded')
  @ApiOperation({ summary: 'Convert live cohort course to recorded course with optional new prices' })
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  convertToRecorded(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertToRecordedDto,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.coursesService.convertToRecorded(id, user.id, dto);
  }

  @Patch(':id')
  @SwaggerUpdateCourse()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCourseDto: UpdateCourseDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.update(id, updateCourseDto, user.id);
  }

  @Delete(':id')
  @SwaggerDeleteCourse()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  remove(@Param('id' , ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.remove(id, user.id);
  }

  @Get(':id/mentionable-users')
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get a list of users that can be mentioned in this course (instructor and enrolled students)' })
  getMentionableUsers(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.getMentionableUsers(id);
  }

  @Get(':id/my-evaluation')
  @SkipThrottle()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get student evaluation report, cumulative GPA, and daily timeline for this course' })
  getMyEvaluation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.coursesEvaluationService.getMyEvaluation(id, user.id);
  }

  @Post(':id/certificate/claim')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Claim / generate verified course completion certificate' })
  claimCertificate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.coursesEvaluationService.claimCertificate(id, user.id);
  }

  @Get(':id/certificate')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get course certificate status and image' })
  getCertificate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.coursesEvaluationService.claimCertificate(id, user.id);
  }

  @Post(':id/reviews')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Submit rating and review for course' })
  submitReview(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
    @Body() dto: { rating: number; comment?: string },
  ) {
    return this.coursesEvaluationService.submitReview(id, user.id, dto);
  }

  @Get(':id/reviews')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get reviews for course' })
  getReviews(@Param('id', ParseIntPipe) id: number) {
    return this.coursesEvaluationService.getCourseReviews(id);
  }
}
