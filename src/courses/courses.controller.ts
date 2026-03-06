import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from 'src/prisma/client/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayloadType } from 'src/utils/types';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  create(@Body() createCourseDto: CreateCourseDto, @CurrentUser() user: JwtPayloadType) {
    return this.coursesService.create(createCourseDto, user.id);
  }

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(+id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto, @CurrentUser() user: JwtPayloadType) {
    return this.coursesService.update(+id, updateCourseDto, user.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayloadType) {
    return this.coursesService.remove(+id, user.id);
  }
}
