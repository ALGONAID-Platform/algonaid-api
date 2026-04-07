import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createModuleDto: CreateModuleDto, userId: number) {
    const { courseId, title, description } = createModuleDto;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { teacher: true }
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    // Check if the user is the instructor of the course or an OWNER
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isInstructor = !!user.teacherProfile && (course?.instructorId === user.teacherProfile.id || (module as any)?.course?.instructorId === user.teacherProfile.id);
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to add modules to this course');
    }

    return this.prisma.module.create({
      data: {
        title,
        description,
        courseId,
      },
    });
  }

  async findAll() {
    return this.prisma.module.findMany({
      include: {
        lessons: true,
      }
    });
  }

  async findByCourse(courseId: number) {
    return this.prisma.module.findMany({
      where: { courseId },
      include: {
        lessons: true,
      }
    });
  }

  async findOne(id: number) {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        lessons: true,
        course: {
          include: {
            teacher: true
          }
        }
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    return module;
  }

  async update(id: number, updateModuleDto: UpdateModuleDto, userId: number) {
    const module = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isInstructor = !!user.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to update this module');
    }

    return this.prisma.module.update({
      where: { id },
      data: updateModuleDto,
    });
  }

  async remove(id: number, userId: number) {
    const module = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isInstructor = !!user.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to delete this module');
    }

    await this.prisma.module.delete({
      where: { id },
    });

    return {
      message: 'Module deleted successfully',
    };
  }
}
