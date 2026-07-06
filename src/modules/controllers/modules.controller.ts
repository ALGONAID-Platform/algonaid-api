import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { ModulesService } from '../services/modules.service';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';

@ApiTags('modules')
@ApiBearerAuth('JWT-auth')
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) { }

  @Post()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Create a new module for a course' })
  @ApiResponse({ status: 201, description: 'The module has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createModuleDto: CreateModuleDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.modulesService.create(createModuleDto, user.id);
  }

  @Get()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all modules' })
  findAll(@CurrentUser() user: types.JwtPayloadType) {
    return this.modulesService.findAll(user.id);
  }

  @Get('course/:courseId')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get all modules for a specific course' })
  findByCourse(@Param('courseId', ParseIntPipe) courseId: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.modulesService.findByCourse(courseId, user.id);
  }

  @Get('course/:courseId/guest')
  @ApiOperation({ summary: 'Get all modules for a specific course for a guest' })
  findByCourseGuest(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.modulesService.findByCourse(courseId);
  }

  @Get(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get a specific module by ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.modulesService.findOne(id, user.id);
  }

  @Patch(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Update a module' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateModuleDto: UpdateModuleDto, @CurrentUser() user: types.JwtPayloadType) {
    return this.modulesService.update(id, updateModuleDto, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Delete a module' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: types.JwtPayloadType) {
    return this.modulesService.remove(id, user.id);
  }
}
  