import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { OptionalAuthGuard } from 'src/auth/guards/optional-auth.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerCreateCourse, SwaggerDeleteCourse, SwaggerGetCourse, SwaggerUpdateCourse, SwaggerGetAllCourses, SwaggerSearchCourses } from './decorators/swagger.decorator';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('courses')
@ApiBearerAuth('JWT-auth')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) { }

  @Post()
  @SwaggerCreateCourse()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @userRoles(Role.STUDENT)
  create(@Body() createCourseDto: CreateCourseDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.create(createCourseDto, user.id);
  }

  @Get()
  @SwaggerGetAllCourses()
  @UseGuards(OptionalAuthGuard)
  findAll(@CurrentUser() user?: types.JwtPayloadType) {
    return this.coursesService.findAll(user?.id);
  }

  @Get("my-courses")
  @SwaggerGetAllCourses()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  findMyCourses(@CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.findMyCourses(user.id);
  }

  @Get('search')
  @SwaggerSearchCourses()
  @UseGuards(OptionalAuthGuard)
  search(@Query('q') query: string, @CurrentUser() user?: types.JwtPayloadType) {
    return this.coursesService.search(query || '', user?.id);
  }


  @Get(':id')
  @SwaggerGetCourse()
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(+id);
  }

  @Patch(':id')
  @SwaggerUpdateCourse()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.update(+id, updateCourseDto, user.id);
  }

  @Delete(':id')
  @SwaggerDeleteCourse()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  remove(@Param('id' , ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.coursesService.remove(id, user.id);
  }
}
