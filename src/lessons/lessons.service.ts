import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateLiveStatusDto } from './dto/update-live-status.dto';
import { MESSAGES } from 'src/utils/messages';
import { LessonStatus, Role } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) { }

  /**
   * Helper to check if user is staff (Owner/Admin) or the instructor of this course
   */
  private async isStaffOrInstructor(instructorId: number, userId?: number): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });
    if (!user) return false;
    if (user.role === Role.OWNER || user.role === Role.ADMIN) return true;
    if (user.teacherProfile && user.teacherProfile.id === instructorId) return true;
    return false;
  }

  /**
   * Helper to check if user is exempt from content masking (Admin/Owner/Instructor or actively enrolled student)
   */
  private async checkIsExemptFromMasking(courseId: number, instructorId: number, userId?: number): Promise<boolean> {
    if (!userId) return false;
    const isStaff = await this.isStaffOrInstructor(instructorId, userId);
    if (isStaff) return true;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
    if (!user) return false;

    if (user.studentProfile) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: user.studentProfile.id,
            courseId,
          },
        },
      });
      if (enrollment && enrollment.status === 'ACTIVE') return true;
    }
    return false;
  }

  /**
   * Helper to validate that a lesson's scheduledAt falls within the course's startDate and endDate
   */
  private validateLessonDateWithCourse(
    scheduledAt: Date | string | undefined | null,
    course: { title?: string; startDate?: Date | null; endDate?: Date | null },
  ) {
    if (!scheduledAt) return;

    const lessonDate = new Date(scheduledAt);
    if (isNaN(lessonDate.getTime())) return;

    if (course.startDate) {
      const courseStart = new Date(course.startDate);
      courseStart.setUTCHours(0, 0, 0, 0);
      if (lessonDate < courseStart) {
        const formattedLesson = lessonDate.toISOString().split('T')[0];
        const formattedStart = new Date(course.startDate).toISOString().split('T')[0];
        throw new BadRequestException(
          `تاريخ الدرس (${formattedLesson}) لا يمكن أن يكون قبل تاريخ بدء الدورة (${formattedStart}).`,
        );
      }
    }

    if (course.endDate) {
      const courseEnd = new Date(course.endDate);
      courseEnd.setUTCHours(23, 59, 59, 999);
      if (lessonDate > courseEnd) {
        const formattedLesson = lessonDate.toISOString().split('T')[0];
        const formattedEnd = new Date(course.endDate).toISOString().split('T')[0];
        throw new BadRequestException(
          `تاريخ الدرس (${formattedLesson}) لا يمكن أن يكون بعد تاريخ انتهاء الدورة (${formattedEnd}).`,
        );
      }
    }
  }

  async create(createLessonDto: CreateLessonDto, userId: number) {
    const { moduleId, courseId, ...lessonData } = createLessonDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isOwner = user?.role === Role.OWNER;
    let finalModuleId: number;

    if (!moduleId) {
      if (!courseId) {
        throw new BadRequestException('يجب تحديد moduleId أو courseId لإضافة الدرس');
      }

      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        include: {
          teacher: true,
          modules: { orderBy: { id: 'asc' }, take: 1 },
        },
      });

      if (!course) {
        throw new NotFoundException('الكورس المحدد غير موجود');
      }

      const isInstructor = user?.teacherProfile && course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner) {
        throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_ADD);
      }

      this.validateLessonDateWithCourse(lessonData.scheduledAt, course);

      if (course.modules && course.modules.length > 0) {
        finalModuleId = course.modules[0].id;
      } else {
        const defaultModule = await this.prisma.module.create({
          data: {
            title: 'محتوى الدورة',
            courseId: course.id,
          },
        });
        finalModuleId = defaultModule.id;
      }
    } else {
      const module = await this.prisma.module.findUnique({
        where: { id: moduleId },
        include: {
          course: {
            include: { teacher: true }
          }
        }
      });

      if (!module) {
        throw new NotFoundException(MESSAGES.MODULES.MODULE_NOT_FOUND(moduleId));
      }

      const isInstructor = user?.teacherProfile && module.course.instructorId === user.teacherProfile.id;
      if (!isInstructor && !isOwner) {
        throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_ADD);
      }

      this.validateLessonDateWithCourse(lessonData.scheduledAt, module.course);

      finalModuleId = moduleId;
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        ...lessonData,
        moduleId: finalModuleId,
      },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    // إرسال إشعار للطلاب المسجلين في هذا الكورس بإضافة درس جديد (إذا كان الدرس منشوراً فقط)
    if (lesson.status === LessonStatus.PUBLISHED) {
      try {
        const courseId = lesson.module?.course?.id;
        const courseTitle = lesson.module?.course?.title || 'الكورس';
        const teacherName = user?.name || 'المعلم';

        if (courseId) {
          await this.notificationsService.notifyNewLessonToEnrolledStudents(
            userId,
            teacherName,
            courseId,
            courseTitle,
            lesson.title,
            lesson.id,
          );
        }
      } catch (err) {
        // عدم تعطيل إنشاء الدرس في حال حدوث خطأ أثناء إرسال الإشعار
      }
    }

    return lesson;
  }

  async findAllByModule(moduleId: number, page: number = 1, limit: number = 8, userId?: number) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: {
          select: { id: true, isPaid: true, instructorId: true },
        },
      },
    });

    if (!module) {
      throw new NotFoundException(MESSAGES.MODULES.MODULE_NOT_FOUND(moduleId));
    }

    let studentId: number | undefined;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true }
      });
      studentId = user?.studentProfile?.id;
    }

    const isStaff = await this.isStaffOrInstructor(module.course.instructorId, userId);
    const isEnrolled = await this.checkIsExemptFromMasking(
      module.course.id,
      module.course.instructorId,
      userId,
    );
    const isPaidCourse = module.course.isPaid;
    const now = new Date();

    const skip = (page - 1) * limit;

    const [lessons, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { 
          moduleId,
          status: LessonStatus.PUBLISHED,
        },
        include: {
          lessonProgress: studentId ? {
            where: { studentId },
          } : false,
          exam: {
            select: { id: true }
          },
          assignment: {
            select: {
              id: true,
              title: true,
              type: true,
              maxScore: true,
              dueDate: true,
            }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy: [
          { dayNumber: 'asc' },
          { order: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.lesson.count({
        where: { 
          moduleId,
          status: LessonStatus.PUBLISHED,
        }
      })
    ]);

    const mappedLessons = lessons.map(lesson => {
      const { exam, assignment, _count, ...rest } = lesson;

      // الدرس مجدول في المستقبل ولم يقم الأدمن بفتحه يدوياً عبر بدء البث (LIVE_NOW أو COMPLETED)
      const isScheduledFuture =
        !isStaff &&
        lesson.scheduledAt &&
        new Date(lesson.scheduledAt) > now &&
        lesson.liveStatus !== 'LIVE_NOW' &&
        lesson.liveStatus !== 'COMPLETED';

      const isUnenrolledPaid = isPaidCourse && !isEnrolled && !lesson.isFreePreview;
      const shouldMask = !isStaff && (isUnenrolledPaid || isScheduledFuture);

      return {
        ...rest,
        content: isScheduledFuture ? null : lesson.content,
        liveMeetingUrl: shouldMask ? null : lesson.liveMeetingUrl,
        videoUrl: shouldMask ? null : lesson.videoUrl,
        recordingVideoUrl: shouldMask ? null : lesson.recordingVideoUrl,
        pdfUrl: shouldMask ? null : lesson.pdfUrl,
        isLocked: shouldMask,
        isScheduledFuture: !!isScheduledFuture,
        commentsCount: _count.comments,
        hasTest: !!exam,
        hasAssignment: !!assignment,
        assignment: assignment || null,
      };
    });

    return {
      data: mappedLessons,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async findLatestEnrolledLessons(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true }
    });

    const studentId = user?.studentProfile?.id;
    if (!studentId) {
      throw new ForbiddenException('Only students can access this endpoint');
    }

    const now = new Date();
    const lessons = await this.prisma.lesson.findMany({
      where: {
        status: LessonStatus.PUBLISHED,
        module: {
          course: {
            isPaid: false, // الكورسات المجانية فقط
            enrollments: {
              some: {
                studentId: studentId,
                status: 'ACTIVE',
              }
            }
          }
        },
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
          { liveStatus: { in: ['LIVE_NOW', 'COMPLETED'] } },
        ],
      },
      include: {
        lessonProgress: {
          where: { studentId },
        },
        exam: {
          select: { id: true }
        },
        _count: {
          select: { comments: true }
        },
        module: {
          select: {
            id: true,
            title: true,
            course: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 7,
    });

    const mappedLessons = lessons.map(lesson => {
      const { exam, _count, module, ...rest } = lesson;
      return {
        ...rest,
        commentsCount: _count.comments,
        hasTest: !!exam,
        moduleName: module.title,
        courseName: module.course.title,
        moduleId: module.id,
        courseId: module.course.id,
      };
    });

    return mappedLessons;
  }


  async findOne(id: number, userId?: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        exam: true,
        assignment: {
          include: {
            exam: true,
          },
        },
        module: {
          include: {
            course: {
              include: { teacher: true }
            }
          }
        }
      }
    });

    if (!lesson) {
      throw new NotFoundException(MESSAGES.LESSONS.LESSON_NOT_FOUND(id));
    }

    if (lesson.status === LessonStatus.DRAFT) {
      if (!userId) {
        throw new ForbiddenException(MESSAGES.LESSONS.LESSON_NOT_FOUND(id));
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { teacherProfile: true }
      });
      const isInstructor = user?.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
      const isOwner = user?.role === Role.OWNER;

      if (!isInstructor && !isOwner) {
        throw new ForbiddenException(MESSAGES.LESSONS.LESSON_NOT_FOUND(id));
      }
    }

    const isStaff = await this.isStaffOrInstructor(lesson.module.course.instructorId, userId);
    const now = new Date();
    const isScheduledFuture =
      !isStaff &&
      lesson.scheduledAt &&
      new Date(lesson.scheduledAt) > now &&
      lesson.liveStatus !== 'LIVE_NOW' &&
      lesson.liveStatus !== 'COMPLETED';

    const latestComments = isScheduledFuture
      ? []
      : await this.prisma.comment.findMany({
          where: {
            lessonId: id,
            parentId: null,
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
          }
        });

    const commentsCount = isScheduledFuture
      ? 0
      : await this.prisma.comment.count({
          where: {
            lessonId: id,
          }
        });

    const isEnrolled = await this.checkIsExemptFromMasking(
      lesson.module.course.id,
      lesson.module.course.instructorId,
      userId,
    );
    const isPaidCourse = lesson.module.course.isPaid;
    const isUnenrolledPaid = isPaidCourse && !isEnrolled && !lesson.isFreePreview;
    const shouldMask = !isStaff && (isUnenrolledPaid || isScheduledFuture);

    return {
      ...lesson,
      content: isScheduledFuture ? null : (shouldMask ? null : lesson.content),
      liveMeetingUrl: shouldMask ? null : lesson.liveMeetingUrl,
      videoUrl: shouldMask ? null : lesson.videoUrl,
      recordingVideoUrl: shouldMask ? null : lesson.recordingVideoUrl,
      pdfUrl: shouldMask ? null : lesson.pdfUrl,
      assignment: shouldMask ? null : lesson.assignment,
      exam: shouldMask ? null : lesson.exam,
      isLocked: shouldMask,
      isScheduledFuture: !!isScheduledFuture,
      courseId: lesson.module.course.id,
      commentsCount,
      latestComments: latestComments,
    };
  }

  async update(id: number, updateLessonDto: UpdateLessonDto, userId: number) {
    const lesson = await this.findOne(id, userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_UPDATE);
    }

    const { moduleId, courseId, ...data } = updateLessonDto;

    let targetCourse = lesson.module.course;
    if (moduleId && moduleId !== lesson.moduleId) {
      const targetModule = await this.prisma.module.findUnique({
        where: { id: moduleId },
        include: { course: true },
      });
      if (!targetModule) {
        throw new NotFoundException(MESSAGES.MODULES.MODULE_NOT_FOUND(moduleId));
      }
      targetCourse = targetModule.course as any;
    }

    const scheduledAtToCheck =
      data.scheduledAt !== undefined ? data.scheduledAt : lesson.scheduledAt;
    if (scheduledAtToCheck) {
      this.validateLessonDateWithCourse(scheduledAtToCheck, targetCourse);
    }

    const updatedLesson = await this.prisma.lesson.update({
      where: { id },
      data: {
        ...data,
        ...(moduleId && { moduleId }),
      },
      include: {
        module: {
          include: {
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (lesson.status !== LessonStatus.PUBLISHED && updatedLesson.status === LessonStatus.PUBLISHED) {
      try {
        const courseId = updatedLesson.module?.course?.id;
        const courseTitle = updatedLesson.module?.course?.title || 'الكورس';
        const teacherName = user?.name || 'المعلم';

        if (courseId) {
          await this.notificationsService.notifyNewLessonToEnrolledStudents(
            userId,
            teacherName,
            courseId,
            courseTitle,
            updatedLesson.title,
            updatedLesson.id,
          );
        }
      } catch (err) {}
    }

    return updatedLesson;
  }

  async remove(id: number, userId: number) {
    const lesson = await this.findOne(id, userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_DELETE);
    }

    await this.prisma.lesson.delete({
      where: { id },
    });

    return {
      message: MESSAGES.LESSONS.LESSON_DELETED,
    };
  }

  async updateLiveStatus(id: number, dto: UpdateLiveStatusDto, userId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(MESSAGES.LESSONS.LESSON_NOT_FOUND(id));
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true },
    });

    const isInstructor = user?.teacherProfile && lesson.module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.LESSONS.UNAUTHORIZED_UPDATE);
    }

    const updated = await this.prisma.lesson.update({
      where: { id },
      data: {
        liveStatus: dto.liveStatus,
        ...(dto.recordingVideoUrl !== undefined && { recordingVideoUrl: dto.recordingVideoUrl }),
      },
    });

    return {
      message: 'تم تحديث حالة البث المباشر بنجاح.',
      lesson: updated,
    };
  }
}
