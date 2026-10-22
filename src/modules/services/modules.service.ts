import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MESSAGES } from 'src/utils/messages';
import { LessonStatus, Role } from '@prisma/client';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createModuleDto: CreateModuleDto, userId: number) {
    const { courseId, title, description, imageUrl } = createModuleDto;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { teacher: true }
    });

    if (!course) {
      throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND(courseId));
    }

    // Check if the user is the instructor of the course or an OWNER
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.MODULES.UNAUTHORIZED_ADD);
    }

    return this.prisma.module.create({
      data: {
        title,
        description,
        courseId,
        imageUrl,
      },
    });
  }

  async findAll(userId?: number) {
    let studentId: number | undefined;
    let isOwner = false;
    let isAdmin = false;
    let activeEnrollmentCourseIds: number[] = [];
    let instructorId: number | undefined;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true, teacherProfile: true },
      });
      studentId = user?.studentProfile?.id;
      isOwner = user?.role === Role.OWNER;
      isAdmin = user?.role === Role.ADMIN;
      instructorId = user?.teacherProfile?.id;
      if (studentId) {
        const enrollments = await this.prisma.enrollment.findMany({
          where: { studentId, status: 'ACTIVE' },
          select: { courseId: true },
        });
        activeEnrollmentCourseIds = enrollments.map((e) => e.courseId);
      }
    }

    const modules = await this.prisma.module.findMany({
      include: {
        course: {
          select: { id: true, isPaid: true, instructorId: true },
        },
        lessons: {
          where: {
            ...(!isOwner && { status: LessonStatus.PUBLISHED })
          },
          orderBy: [
            { dayNumber: 'asc' },
            { order: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
          include: {
            exam: {
              select: {
                id: true,
                assignment: { select: { id: true, type: true } },
              },
            },
            assignment: {
              select: {
                id: true,
                type: true,
                examId: true,
              },
            },
            pdfFiles: {
              orderBy: { order: 'asc' },
            },
            lessonProgress: studentId ? {
              where: { studentId },
            } : false,
            _count: { select: { comments: true } }
          }
        },
        _count: {
          select: { 
            lessons: {
              where: { status: LessonStatus.PUBLISHED }
            }
          }
        }
      }
    });

    return modules.map((mod) => {
      const { lessons, course, _count, ...rest } = mod;

      const isExempt = activeEnrollmentCourseIds.includes(mod.courseId);
      const isUnenrolledPaid = Boolean(course?.isPaid && !isExempt);

      const now = new Date();

      const mappedLessons = lessons.map(lesson => {
        // @ts-ignore
        const { _count: lessonCount, assignment, exam, pdfFiles, ...lessonRest } = lesson;
        const isAssignmentQuiz = Boolean(
          (assignment && assignment.type === 'QUIZ') ||
          (exam && (exam as any).assignment)
        );
        const hasCheckpointExam = Boolean(exam && !isAssignmentQuiz);

        const isScheduledFuture =
          !isExempt &&
          lesson.scheduledAt &&
          new Date(lesson.scheduledAt) > now &&
          lesson.liveStatus !== 'LIVE_NOW' &&
          lesson.liveStatus !== 'COMPLETED';

        const isFreePreview = Boolean(lesson.isFreePreview);
        const shouldMask = (isUnenrolledPaid && !isFreePreview) || isScheduledFuture;

        const rawPdfFiles = (pdfFiles as any[]) || [];
        const primaryPdf = rawPdfFiles.length > 0 ? rawPdfFiles[0].url : lesson.pdfUrl;
        const formattedPdfFiles = rawPdfFiles.length > 0
          ? rawPdfFiles.map(f => ({ id: f.id, title: f.title, url: f.url, order: f.order }))
          : (lesson.pdfUrl ? [{ id: 0, title: 'ملف الدرس الأساسي', url: lesson.pdfUrl, order: 0 }] : []);

        return {
          ...lessonRest,
          // حجب المحتوى الحساس للكورسات المدفوعة لغير المشتركين
          description: shouldMask ? null : lesson.description,
          content: shouldMask ? null : lesson.content,
          videoUrl: shouldMask ? null : lesson.videoUrl,
          recordingVideoUrl: shouldMask ? null : lesson.recordingVideoUrl,
          pdfUrl: shouldMask ? null : primaryPdf,
          pdfFiles: shouldMask ? [] : formattedPdfFiles,
          liveMeetingUrl: shouldMask ? null : lesson.liveMeetingUrl,
          assignment: shouldMask ? null : assignment,
          exam: shouldMask ? null : exam,
          hasExam: shouldMask ? false : hasCheckpointExam,
          isAssignmentQuiz: shouldMask ? false : isAssignmentQuiz,
          hasAssignment: shouldMask ? false : Boolean(assignment),
          hasTest: shouldMask ? false : Boolean(exam),
          status: shouldMask ? null : lesson.status,
          liveStatus: shouldMask ? null : lesson.liveStatus,
          isLocked: shouldMask,
          isScheduledFuture: Boolean(isScheduledFuture),
          isFreePreview,
          isPaidCourse: Boolean(course?.isPaid),
          commentsCount: shouldMask ? 0 : (lessonCount?.comments || 0),
        };
      });

      const mandatoryLessons = mappedLessons.filter((l) => (l as any).isMandatory !== false);
      const totalLessons = mandatoryLessons.length;
      let completedLessons = 0;

      if (studentId) {
        mandatoryLessons.forEach(lesson => {
          // @ts-ignore
          const progress = lesson.lessonProgress;
          if (progress && progress.length > 0 && progress[0].isCompleted) {
            completedLessons++;
          }
        });
      }

      const progressPercentage =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : (mappedLessons.length > 0 ? 100 : 0);

      return {
        ...rest,
        lessons: mappedLessons,
        totalLessons,
        completedLessons,
        progressPercentage: studentId ? progressPercentage : undefined,
      };
    });
  }

  async findByCourse(courseId: number, userId?: number) {
    let studentId: number | undefined;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true },
      });
      studentId = user?.studentProfile?.id;
    }

    const modules = await this.prisma.module.findMany({
      where: { courseId },
      include: {
        _count: {
          select: {
            lessons: {
              where: { status: LessonStatus.PUBLISHED },
            },
          },
        },
        lessons: studentId
          ? {
              where: {
                status: LessonStatus.PUBLISHED,
                isMandatory: true,
                lessonProgress: {
                  some: {
                    studentId,
                    isCompleted: true,
                  },
                },
              },
              select: { id: true },
            }
          : false,
      },
      orderBy: { id: 'asc' },
    });

    return modules.map((mod) => {
      const { lessons, _count, ...rest } = mod;
      const totalLessons = _count.lessons;
      const completedLessons = lessons ? lessons.length : 0;
      const progressPercentage =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return {
        ...rest,
        totalLessons,
        completedLessons,
        progressPercentage: studentId ? progressPercentage : undefined,
        lessons: [],
      };
    });
  }

  async findOne(id: number, userId?: number) {
    let isOwner = false;
    let isStudent = false;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      isOwner = user?.role === Role.OWNER || user?.role === Role.STUDENT;
      isStudent = user?.role === Role.STUDENT;
    }

    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        lessons: {
          where: {
            ...((!isOwner || isStudent) && { status: LessonStatus.PUBLISHED })
          },
          include: {
            exam: { select: { id: true } }
          }
        },
        course: {
          include: {
            teacher: true
          }
        }
      },
    });

    if (!module) {
      throw new NotFoundException(MESSAGES.MODULES.MODULE_NOT_FOUND(id));
    }

    return module;
  }

  async update(id: number, updateModuleDto: UpdateModuleDto, userId: number) {
    const module = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teacherProfile: true }
    });

    const isInstructor = user?.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.MODULES.UNAUTHORIZED_UPDATE);
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

    const isInstructor = user?.teacherProfile && module.course.instructorId === user.teacherProfile.id;
    const isOwner = user?.role === Role.OWNER;

    if (!isInstructor && !isOwner) {
      throw new ForbiddenException(MESSAGES.MODULES.UNAUTHORIZED_DELETE);
    }

    await this.prisma.module.delete({
      where: { id },
    });

    return {
      message: MESSAGES.MODULES.MODULE_DELETED,
    };
  }
}
