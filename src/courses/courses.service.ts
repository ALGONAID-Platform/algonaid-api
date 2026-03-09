import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCourseDto: CreateCourseDto, userId: number) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });
    
    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    return this.prisma.course.create({
      data: {
        ...createCourseDto,
        instructorId: teacher.id,
      },
    });
  }

  async findAll() {
    return this.prisma.course.findMany({
      include: {
        teacher: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto, userId: number) {
    const course = await this.findOne(id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isInstructor = user.teacherProfile && course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to update this course');
    }

    return this.prisma.course.update({
      where: { id },
      data: updateCourseDto,
    });
  }

  async remove(id: number, userId: number) {
    const course = await this.findOne(id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isInstructor = user.teacherProfile && course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException('You are not authorized to delete this course');
    }
    this.prisma.course.delete({
      where: { id },
    });

    return {
      message : "course deleted successfuly"
    }
  }
}
