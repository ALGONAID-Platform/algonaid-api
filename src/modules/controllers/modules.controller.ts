import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { ModulesService } from '../services/modules.service';
import { SwaggerCreateModule, SwaggerDeleteModule, SwaggerGetModulesByCourse, SwaggerUpdateModule } from '../decorators/swagger.decorator';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { UserRole } from 'src/auth/enums/userRole';

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) { }

  @Post(":courseId")
  @SwaggerCreateModule()
  @UseGuards(AuthRollGuard)
  @userRoles(UserRole.ADMIN, UserRole.OWNER)
  create(@Body() createModuleDto: CreateModuleDto, @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.modulesService.create(createModuleDto, courseId);
  }

  @Get(":id")
  @SwaggerGetModulesByCourse()
  findAll(@Param('id', ParseIntPipe) id: number) {
    return this.modulesService.findAll(id);
  }



  @Patch(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(UserRole.ADMIN, UserRole.OWNER)
  @SwaggerUpdateModule()
  update(@Param('id' , ParseIntPipe) id: number, @Body() updateModuleDto: UpdateModuleDto) {
    return this.modulesService.update(id, updateModuleDto);
  }

  @Delete(':id')
  @UseGuards(AuthRollGuard)
  @userRoles(UserRole.ADMIN, UserRole.OWNER)
  @SwaggerDeleteModule()
  remove(@Param('id' , ParseIntPipe) id: number) {
    return this.modulesService.remove(id);
  }
}
