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
          modules: {
            include: {
              lessons: {
                where: {
                  status: 'PUBLISHED',
                },
                include: {
                  lessonProgress: {
                    where: { studentId: student?.id },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // تنظيف البيانات لتعود بنفس تنسيق الكورس العادي
  return myEnrollments.map((enrol) => {
    const { course } = enrol;
    const { modules, _count, ...rest } = course;

    let totalLessons = 0;
    let completedLessons = 0;

    modules.forEach((module) => {
      totalLessons += module.lessons.length;
      module.lessons.forEach((lesson) => {
        const progress = lesson.lessonProgress;
        if (progress && progress.length > 0 && progress[0].isCompleted) {
          completedLessons++;
        }
      });
    });

    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      ...rest,
      moduleTitles: modules.slice(0, 3).map((m) => m.title),
      modulesCount: _count.modules,
      isEnrolled: true, // دائماً ترو لأننا جلبناها من جدول التسجيلات
      enrollmentStatus: enrol.status,
      totalLessons,
      completedLessons,
      progressPercentage,
    };
  });
}


async findAll(userId?: number) {
  const student = userId ? await this.prisma.student.findUnique({ where: { userId } }) : null;
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
      isEnrolled: !!(enrollments && enrollments.length > 0),
    };
  });
}

  async search(query: string, userId?: number) {
    if (!query) {
      return { courses: [], modules: [], lessons: [] };
    }

    const student = userId ? await this.prisma.student.findUnique({ where: { userId } }) : null;
    const studentId = student?.id;

    const coursesData = await this.prisma.course.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          {
            modules: {
              some: {
                title: { contains: query, mode: 'insensitive' },
              },
            },
          },
          {
            modules: {
              some: {
                lessons: {
                  some: {
                    title: { contains: query, mode: 'insensitive' },
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        teacher: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        enrollments: studentId ? { where: { studentId }, select: { id: true } } : false,
      },
    });

    const courses = coursesData.map((course) => {
      const { enrollments, teacher, ...rest } = course;
      return {
        ...rest,
        teacher: teacher?.user ? { name: teacher.user.name } : null,
        isEnrolled: enrollments && enrollments.length > 0,
      };
    });

    const modulesData = await this.prisma.module.findMany({
      where: { title: { contains: query, mode: 'insensitive' } },
      select: {
        id: true,
        title: true,
        courseId: true,
        course: {
          select: {
            title: true,
          },
        },
      },
    });

    const modules = modulesData.map((module) => ({
      id: module.id,
      title: module.title,
      courseId: module.courseId,
      courseTitle: module.course?.title,
    }));

    const lessonsData = await this.prisma.lesson.findMany({
      where: { title: { contains: query, mode: 'insensitive' } },
      select: {
        id: true,
        title: true,
        moduleId: true,
        module: {
          select: {
            courseId: true,
          },
        },
      },
    });

    const lessons = lessonsData.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      moduleId: lesson.moduleId,
      courseId: lesson.module?.courseId,
    }));

    return {
      courses,
      modules,
      lessons,
    };
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
