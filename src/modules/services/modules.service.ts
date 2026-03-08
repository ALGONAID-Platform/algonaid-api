import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) { }
  async create(createModuleDto: CreateModuleDto, courseId: number) {

    const {title, description } = createModuleDto;

    await this.prisma.module.create({
      data: {
        title,
        description,
        courseId
      }
    })
    return {
      message: "module created successfuly",
      data: {
        ...createModuleDto,
        courseId
      }
    }

  }

  async findAll(moduleId: number) {
    const module = await this.prisma.module.findMany()
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return module;
  }

  findOne(id: number) {
    return `This action returns a #${id} module`;
  }

  async update(id: number, updateModuleDto: UpdateModuleDto) {
    const module = await this.prisma.module.findUnique({
      where: { id },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.module.update({
      where: { id },
      data: updateModuleDto,
    });
  }

  async remove(id: number) {
    const module = await this.prisma.module.findUnique({
      where: { id },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.module.delete({
      where: { id },
    });
  }
}
