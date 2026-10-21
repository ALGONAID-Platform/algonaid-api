import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateCourseDto } from './dto/update-course.dto';
import { MESSAGES } from 'src/utils/messages';
import { CourseType } from '@prisma/client';
import { ConvertToRecordedDto } from './dto/convert-to-recorded.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createCourseDto: CreateCourseDto, userId: number) {
    let teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      teacher = await this.prisma.teacher.create({
        data: {
          userId,
          specialization: 'إدارة المنصة / مدرب',
        },
      });
    }

    return this.prisma.course.create({
      data: {
        ...createCourseDto,
        instructorId: teacher.id,
      },
    });
  }

  async findMyCourses(userId: number, limit?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
    
    const student = user?.studentProfile;

    if (!student) {
      return [];
    }

    const isOwner = user?.role === 'OWNER';
   
    const myEnrollments = await this.prisma.enrollment.findMany({
      where: { 
        studentId: student.id,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}),
      include: {
        course: {
          include: {
            teacher: { include: { user: { select: { name: true, avatar: true } } } },
            _count: { 
              select: { 
                modules: true,
                enrollments: { where: { status: 'ACTIVE' } }
              } 
            },
            practiceExams: {
              select: { createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            modules: {
              include: {
                lessons: {
                  where: {
                    ...(!isOwner && { status: 'PUBLISHED' }),
                  },
                  orderBy: [
                    { dayNumber: 'asc' },
                    { order: 'asc' },
                    { createdAt: 'asc' },
                    { id: 'asc' },
                  ],
                  include: {
                    lessonProgress: {
                      where: { studentId: student?.id },
                    },
                    exam: {
                      include: {
                        attempts: {
                          where: { studentId: student?.id, status: 'PASSED' },
                          take: 1,
                        }
                      }
                    }
                  },
                },
              },
            },
          },
        },
      },
    });

    return myEnrollments.map((enrol) => {
      const { course } = enrol;
      const { modules, _count, practiceExams, description, ...rest } = course;

      let totalLessons = 0;
      let completedLessons = 0;
      let lastContentAddedAt: Date | null = null;

      if (practiceExams && practiceExams.length > 0) {
        lastContentAddedAt = practiceExams[0].createdAt;
      }

      let allLessonsCount = 0;
      modules.forEach((module) => {
        module.lessons.forEach((lesson) => {
          allLessonsCount++;
          if (!lastContentAddedAt || lesson.createdAt > lastContentAddedAt) {
            lastContentAddedAt = lesson.createdAt;
          }
          if (lesson.exam && lesson.exam.createdAt) {
            if (!lastContentAddedAt || lesson.exam.createdAt > lastContentAddedAt) {
              lastContentAddedAt = lesson.exam.createdAt;
            }
          }

          if (lesson.isMandatory !== false) {
            totalLessons++;
            const progress = lesson.lessonProgress;
            const passedExam = lesson.exam?.attempts;
            if (
              (progress && progress.length > 0 && progress[0].isCompleted) ||
              (passedExam && passedExam.length > 0)
            ) {
              completedLessons++;
            }
          }
        });
      });

      const progressPercentage =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : (allLessonsCount > 0 ? 100 : 0);

    return {
      ...rest,
      description: null,
      moduleTitles: modules.slice(0, 3).map((m) => m.title),
      modulesCount: _count.modules,
      enrollmentsCount: _count.enrollments || 0,
      isEnrolled: true, // دائماً ترو لأننا جلبناها من جدول التسجيلات
      enrollmentStatus: enrol.status,
      totalLessons,
      completedLessons,
      progressPercentage,
      lastContentAddedAt,
    };
  });
}


  async findAll(userId?: number, role?: string) {
    const student = userId ? await this.prisma.student.findUnique({ where: { userId } }) : null;
    const studentId = student?.id;
    const isPrivileged = role === 'OWNER' || role === 'ADMIN';

    const courses = await this.prisma.course.findMany({
      where: {
        isPaid: false,
        ...((studentId && !isPrivileged) ? {
          NOT: {
            enrollments: {
              some: {
                studentId: studentId,
                status: 'ACTIVE',
              },
            },
          },
        } : {}),
      },
      include: {
        teacher: { include: { user: { select: { name: true, avatar: true } } } },
        modules: { select: { title: true }, take: 3 },
        _count: { 
          select: { 
            modules: true,
            enrollments: { where: { status: 'ACTIVE' } } 
          } 
        },
        // ملاحظة: بما أننا استبعدنا المشتركين، الـ enrollments هنا ستكون دائماً فارغة لهذا الطالب
        enrollments: studentId ? { where: { studentId }, select: { id: true } } : false,
      },
    });

    return courses.map((course) => {
      const { modules, enrollments, _count, description, ...rest } = course;
      return {
        ...rest,
        description: null,
        moduleTitles: modules.map((m) => m.title),
        modulesCount: _count.modules,
        enrollmentsCount: _count.enrollments || 0,
        // ستكون دائماً false الآن في قائمة الاكتشاف، وهذا هو المنطق السليم
        isEnrolled: !!(enrollments && enrollments.length > 0),
      };
    });
  }

  async findPaidCourses(userId?: number) {
    const student = userId ? await this.prisma.student.findUnique({ where: { userId } }) : null;
    const studentId = student?.id;

    const courses = await this.prisma.course.findMany({
      where: {
        isPaid: true,
        // استبعد الكورسات التي اشترك فيها الطالب بالفعل
        ...(studentId && {
          NOT: {
            enrollments: {
              some: {
                studentId,
                status: 'ACTIVE',
              },
            },
          },
        }),
      },
      include: {
        teacher: { include: { user: { select: { name: true, avatar: true } } } },
        _count: {
          select: {
            enrollments: { where: { status: 'ACTIVE' } },
          },
        },
        enrollments: studentId ? { where: { studentId }, select: { id: true } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return courses.map((course) => {
      const { enrollments, _count, description, ...rest } = course;
      const enrollmentsCount = _count.enrollments || 0;
      const isFull = course.maxStudents != null ? enrollmentsCount >= course.maxStudents : false;
      const remainingSeats = course.maxStudents != null ? Math.max(0, course.maxStudents - enrollmentsCount) : null;
      return {
        ...rest,
        description: null,
        enrollmentsCount,
        maxStudents: course.maxStudents,
        isFull,
        remainingSeats,
        isEnrolled: !!(enrollments && enrollments.length > 0),
      };
    });
  }

  async findPaidCoursesForKartty() {
    const courses = await this.prisma.course.findMany({
      where: {
        isPaid: true,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return courses.map((course) => {
      const price = course.price ? Number(course.price) : Number(course.discountedPrice || 0);
      const discountedPrice = course.discountedPrice ? Number(course.discountedPrice) : null;

      return {
        id: course.id,
        title: course.title,
        imageUrl: course.thumbnail || null,
        instructorName: course.teacher?.user?.name || 'أ. بشار الجُنيد',
        currency: 'USD',
        price,
        discountedPrice,
      };
    });
  }

  async search(query: string, userId?: number) {
    if (!query) {
      return { courses: [], modules: [], lessons: [], practiceExams: [] };
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

    const practiceExamsData = await this.prisma.practiceExam.findMany({
      where: { title: { contains: query, mode: 'insensitive' } },
      select: {
        id: true,
        title: true,
        grade: true,
        pdfUrl: true,
        courseId: true,
        course: {
          select: {
            title: true,
          },
        },
      },
    });

    const practiceExams = practiceExamsData.map((exam) => ({
      id: exam.id,
      title: exam.title,
      grade: exam.grade,
      pdfUrl: exam.pdfUrl,
      courseId: exam.courseId,
      courseTitle: exam.course?.title,
    }));

    return {
      courses,
      modules,
      lessons,
      practiceExams,
    };
  }

  async findOne(id: number, userId?: number) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: {
              where: {
                status: 'ACTIVE'
              }
            }
          }
        }
      },
    });

    if (!course) {
      throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND(id));
    }

    let isEnrolled = false;
    let paymentStatus: string | null = null;

    if (userId) {
      const student = await this.prisma.student.findUnique({ where: { userId } });
      if (student) {
        const enrollment = await this.prisma.enrollment.findUnique({
          where: {
            studentId_courseId: {
              studentId: student.id,
              courseId: id,
            },
          },
        });
        isEnrolled = !!(enrollment && enrollment.status === 'ACTIVE');

        const latestPayment = await this.prisma.payment.findFirst({
          where: {
            studentId: student.id,
            courseId: id,
          },
          orderBy: { createdAt: 'desc' },
        });
        paymentStatus = latestPayment ? latestPayment.status : null;
      }
    }

    // Fetch the latest 3 comments for this course
    const latestComments = await this.prisma.comment.findMany({
      where: {
        lesson: {
          module: {
            courseId: id,
          },
        },
        parentId: null, // Only top-level comments
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true,
          }
        },
        lesson: {
          select: {
            id: true,
            title: true,
          }
        }
      }
    });

    const { _count, ...courseData } = course;
    const activeEnrollmentsCount = _count?.enrollments || 0;
    const maxStudents = course.maxStudents;
    const isFull = maxStudents != null ? activeEnrollmentsCount >= maxStudents : false;
    const remainingSeats = maxStudents != null ? Math.max(0, maxStudents - activeEnrollmentsCount) : null;

    const generalPrice = Number(course.discountedPrice || course.price || 0);
    const pricing = {
      YER_OLD: {
        originalPrice: course.priceYerOld ? Number(course.priceYerOld) : null,
        discountedPrice: course.discountedPriceYerOld ? Number(course.discountedPriceYerOld) : null,
        finalPrice: Number(course.discountedPriceYerOld || course.priceYerOld || generalPrice),
        currencyLabel: 'ريال يمني (عملة قديمة - صنعاء)',
      },
      YER_NEW: {
        originalPrice: course.priceYerNew ? Number(course.priceYerNew) : null,
        discountedPrice: course.discountedPriceYerNew ? Number(course.discountedPriceYerNew) : null,
        finalPrice: Number(course.discountedPriceYerNew || course.priceYerNew || generalPrice),
        currencyLabel: 'ريال يمني (عملة جديدة - عدن)',
      },
      SAR: {
        originalPrice: course.priceSar ? Number(course.priceSar) : null,
        discountedPrice: course.discountedPriceSar ? Number(course.discountedPriceSar) : null,
        finalPrice: Number(course.discountedPriceSar || course.priceSar || 0),
        currencyLabel: 'ريال سعودي',
      },
      USD: {
        originalPrice: course.price ? Number(course.price) : null,
        discountedPrice: course.discountedPrice ? Number(course.discountedPrice) : null,
        finalPrice: generalPrice,
        currencyLabel: 'دولار أمريكي',
      },
    };

    return {
      ...courseData,
      enrollmentsCount: activeEnrollmentsCount,
      maxStudents,
      isFull,
      remainingSeats,
      capacityText: maxStudents != null
        ? (isFull ? `اكتمل العدد (الحد الأقصى: ${maxStudents} طالب)` : `متبقي ${remainingSeats} مقاعد من أصل ${maxStudents}`)
        : 'المقاعد غير محدودة',
      pricing,
      isEnrolled,
      paymentStatus,
      latestComments: latestComments,
    };
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
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
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
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.COURSES.UNAUTHORIZED_DELETE);
    }
   await this.prisma.course.delete({
      where: { id },
    });

    return {
      message: MESSAGES.COURSES.COURSE_DELETED
    }
  }

  async getMentionableUsers(courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, createdAt: true }
            }
          }
        },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true, createdAt: true }
                }
              }
            }
          }
        }
      }
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const mentionableUsers = [];

    // Add instructor
    if (course.teacher && course.teacher.user) {
      mentionableUsers.push({
        id: course.teacher.user.id,
        name: course.teacher.user.name,
        avatar: course.teacher.user.avatar,
        role: 'INSTRUCTOR'
      });
    }

    // Add students
    for (const enrollment of course.enrollments) {
      if (enrollment.student && enrollment.student.user) {
        mentionableUsers.push({
          id: enrollment.student.user.id,
          name: enrollment.student.user.name,
          avatar: enrollment.student.user.avatar,
          role: 'STUDENT'
        });
      }
    }

    return mentionableUsers;
  }

  async convertToRecorded(id: number, userId: number, dto: ConvertToRecordedDto) {
    const course = await this.findOne(id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException(MESSAGES.COURSES.USER_NOT_FOUND);
    }

    const isInstructor = user.teacherProfile && course.instructorId === user.teacherProfile.id;
    const isOwner = user.role === 'OWNER';

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.COURSES.UNAUTHORIZED_UPDATE);
    }

    // 1. Convert course to RECORDED and optionally update prices
    const updatedCourse = await this.prisma.course.update({
      where: { id },
      data: {
        courseType: CourseType.RECORDED,
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.discountedPrice !== undefined && { discountedPrice: dto.discountedPrice }),
        scheduleDaysText: null,
      },
    });

    // 2. Clear liveMeetingUrl from all lessons in this course
    await this.prisma.lesson.updateMany({
      where: {
        module: {
          courseId: id,
        },
      },
      data: {
        liveMeetingUrl: null,
      },
    });

    return {
      message: 'تم تحويل الدورة المباشرة إلى كورس مسجل بنجاح وتفريغ روابط البث المباشر.',
      course: updatedCourse,
    };
  }
}
