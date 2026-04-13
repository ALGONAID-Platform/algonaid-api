import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateCourseDto } from './dto/update-course.dto';
import { MESSAGES } from 'src/utils/messages';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createCourseDto: CreateCourseDto, userId: number) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new NotFoundException(MESSAGES.COURSES.TEACHER_PROFILE_NOT_FOUND);
    }

    return this.prisma.course.create({
      data: {
        ...createCourseDto,
        instructorId: teacher.id,
      },
    });
  }

async findMyCourses(userId: number) {
  // جلب الطالب أولاً
  const student = await this.prisma.student.findUnique({
    where: { userId },
  });
 
  // جلب التسجيلات ومن ثم استخراج الكورسات منها
  const myEnrollments = await this.prisma.enrollment.findMany({
    where: { 
      studentId: student?.id,
      status: 'ACTIVE', // جلب الكورسات القائمة فقط
    },
    include: {
      course: {
        include: {
          teacher: { include: { user: { select: { name: true, email: true } } } },
          _count: { select: { modules: true } },
          modules: { select: { title: true }, take: 3 },
        },
      },
    },
  });

  // تنظيف البيانات لتعود بنفس تنسيق الكورس العادي
  return myEnrollments.map((enrol) => {
    const { course } = enrol;
    const { modules, _count, ...rest } = course;
    return {
      ...rest,
      moduleTitles: modules.map((m) => m.title),
      modulesCount: _count.modules,
      isEnrolled: true, // دائماً ترو لأننا جلبناها من جدول التسجيلات
      enrollmentStatus: enrol.status,
    };
  });
}


async findAll(userId: number) {
  const student =  await this.prisma.student.findUnique({ where: { userId } }) ;
  const studentId = student?.id;

  const courses = await this.prisma.course.findMany({
    where: studentId ? {
      enrollments: {
        none: { // تعني "لا يوجد أي سجل اشتراك يطابق الآتي"
          studentId: studentId,
        },
      },
    } : {}, // إذا لم يوجد userId، أجلب كل الكورسات كالمعتاد
    
    include: {
      teacher: { include: { user: { select: { name: true, email: true } } } },
      modules: { select: { title: true }, take: 3 },
      _count: { select: { modules: true } },
      // ملاحظة: بما أننا استبعدنا المشتركين، الـ enrollments هنا ستكون دائماً فارغة لهذا الطالب
      enrollments: studentId ? { where: { studentId }, select: { id: true } } : false,
    },
  });

  return courses.map((course) => {
    const { modules, enrollments, _count, ...rest } = course;
    return {
      ...rest,
      moduleTitles: modules.map((m) => m.title),
      modulesCount: _count.modules,
      // ستكون دائماً false الآن في قائمة الاكتشاف، وهذا هو المنطق السليم
      isEnrolled: enrollments && enrollments.length > 0,
    };
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
      throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND(id));
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
      throw new NotFoundException(MESSAGES.COURSES.USER_NOT_FOUND);
    }

    const isInstructor = user.teacherProfile && course.instructorId === user.teacherProfile.id;
    const isOwnerOrAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

    if (!isInstructor && !isOwnerOrAdmin) {
      throw new ForbiddenException(MESSAGES.COURSES.UNAUTHORIZED_UPDATE);
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
      throw new NotFoundException(MESSAGES.COURSES.USER_NOT_FOUND);
    }

    const isInstructor = user.teacherProfile && course.instructorId === user.teacherProfile.id;
    const isOwnerOrAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

    if (!isInstructor && !isOwnerOrAdmin) {
      throw new ForbiddenException(MESSAGES.COURSES.UNAUTHORIZED_DELETE);
    }
   await this.prisma.course.delete({
      where: { id },
    });

    return {
      message: MESSAGES.COURSES.COURSE_DELETED
    }
  }
}
