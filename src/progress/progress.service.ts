import { Injectable, NotFoundException , BadRequestException} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) { }

 

  async updateProgress(studentUserId: number, dto: import('./dto/update-progress.dto').UpdateProgressDto) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const { lessonId, isCompleted = true } = dto;

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const existingProgress = await this.prisma.lessonProgress.findUnique({
      where: {
        studentId_lessonId: {
          studentId: student.id,
          lessonId: lesson.id,
        },
      },
    });

    let newWatchCount = (existingProgress as any)?.watchCount || 1;
    if (isCompleted && existingProgress?.isCompleted) {
      newWatchCount += 1;
    }

    if (existingProgress) {
      const [, newProgress] = await this.prisma.$transaction([
        this.prisma.lessonProgress.delete({ where: { id: existingProgress.id } }),
        this.prisma.lessonProgress.create({
          data: {
            studentId: student.id,
            lessonId: lesson.id,
            isCompleted: isCompleted,
            completedAt: isCompleted ? new Date() : null,
            watchCount: newWatchCount,
          } as any,
        })
      ]);
      return newProgress;
    } else {
      return await this.prisma.lessonProgress.create({
        data: {
          studentId: student.id,
          lessonId: lesson.id,
          isCompleted: isCompleted,
          completedAt: isCompleted ? new Date() : null,
          watchCount: 1,
        } as any,
      });
    }
  }

  async getCourseProgress(studentUserId: number, courseId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
      include: { user: true },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const isOwnerOrAdmin = student.user?.role === 'OWNER' || student.user?.role === 'ADMIN';

    const lessons = await this.prisma.lesson.findMany({
      where: {
        ...(!isOwnerOrAdmin && { status: 'PUBLISHED' }),
        module: {
          courseId: courseId,
        },
      },
    });

    if (lessons.length === 0) return { progress: 0 };

    const completedLessonsCount = await this.prisma.lesson.count({
      where: {
        id: { in: lessons.map((l) => l.id) },
        OR: [
          {
            lessonProgress: {
              some: {
                studentId: student.id,
                isCompleted: true,
              },
            },
          },
          {
            exam: {
              attempts: {
                some: {
                  studentId: student.id,
                  status: 'PASSED',
                },
              },
            },
          },
        ],
      },
    });

    const progressPercentage = (completedLessonsCount / lessons.length) * 100;

    return {
      courseId,
      totalLessons: lessons.length,
      completedLessons: completedLessonsCount,
      progressPercentage: Math.round(progressPercentage),
    };
  }

  async getLastWatched(studentUserId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const lastProgress = await this.prisma.lessonProgress.findFirst({
      where: { studentId: student.id },
      orderBy: { id: 'desc' },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!lastProgress) {
      return null;
    }

    return {
      courseName: lastProgress.lesson.module.course.title,
      categoryName: lastProgress.lesson.module.title, // الفئة
      lesson: {
        id: lastProgress.lesson.id,
        title: lastProgress.lesson.title,
        description: lastProgress.lesson.description,
        content: lastProgress.lesson.content,
        videoUrl: lastProgress.lesson.videoUrl,
        pdfUrl: lastProgress.lesson.pdfUrl,
        order: lastProgress.lesson.order,
      },
      progress: {
        id: lastProgress.id,
        isCompleted: lastProgress.isCompleted,
        completedAt: lastProgress.completedAt,
      },
    };
  }

  async getLastAccessedModuleProgress(studentUserId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const lastProgress = await this.prisma.lessonProgress.findFirst({
      where: { studentId: student.id },
      orderBy: { id: 'desc' },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!lastProgress) {
      return null;
    }

    const module = lastProgress.lesson.module;
    const isOwnerOrAdmin = student.user?.role === 'OWNER' || student.user?.role === 'ADMIN';

    const lessons = await this.prisma.lesson.findMany({
      where: {
        moduleId: module.id,
        ...(!isOwnerOrAdmin && { status: 'PUBLISHED' }),
      },
      include: {
        lessonProgress: {
          where: { studentId: student.id },
        },
        exam: {
          include: {
            attempts: {
              where: { studentId: student.id, status: 'PASSED' },
              take: 1,
            }
          }
        }
      }
    });

    let totalLessons = lessons.length;
    let completedLessons = 0;

    lessons.forEach(lesson => {
      const progressList = lesson.lessonProgress;
      const passedExamList = lesson.exam?.attempts;
      if (
        (progressList && progressList.length > 0 && progressList[0].isCompleted) ||
        (passedExamList && passedExamList.length > 0)
      ) {
        completedLessons++;
      }
    });

    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      moduleId: module.id,
      courseName: module.course.title,
      courseImage: module.course.thumbnail,
      thumbnail: module.course.thumbnail,
      moduleName: module.title,
      moduleDescription: module.description,
      totalLessons,
      completedLessons,
      progressPercentage,
    };
  }

  async getModuleGrades(studentUserId: number, moduleId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const exams = await this.prisma.exam.findMany({
      where: {
        lesson: {
          moduleId: moduleId,
        },
      },
      include: {
        questions: {
          select: { points: true },
        },
        attempts: {
          where: { studentId: student.id },
          orderBy: { score: 'desc' },
          take: 1,
        },
      },
    });

    if (exams.length === 0) {
      return { moduleId, averagePercentage: 0, examsCount: 0, examDetails: [] };
    }

    let totalPercentage = 0;
    const examDetails = [];

    for (const exam of exams) {
      const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
      let percentage = 0;
      
      if (exam.attempts.length > 0 && totalPoints > 0) {
        percentage = (exam.attempts[0].score / totalPoints) * 100;
      }
      
      totalPercentage += percentage;
      
      examDetails.push({
        examId: exam.id,
        examTitle: exam.title,
        highestScore: exam.attempts.length > 0 ? exam.attempts[0].score : 0,
        totalPoints,
        percentage: Math.round(percentage),
        isAttempted: exam.attempts.length > 0,
      });
    }

    const averagePercentage = totalPercentage / exams.length;

    return {
      moduleId,
      averagePercentage: Math.round(averagePercentage),
      examsCount: exams.length,
      examDetails,
    };
  }

  async getCourseGrades(studentUserId: number, courseId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const exams = await this.prisma.exam.findMany({
      where: {
        lesson: {
          module: {
            courseId: courseId,
          },
        },
      },
      include: {
        questions: {
          select: { points: true },
        },
        attempts: {
          where: { studentId: student.id },
          orderBy: { score: 'desc' },
          take: 1,
        },
      },
    });

    if (exams.length === 0) {
      return { courseId, averagePercentage: 0, examsCount: 0, examDetails: [] };
    }

    let totalPercentage = 0;
    const examDetails = [];

    for (const exam of exams) {
      const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
      let percentage = 0;
      
      if (exam.attempts.length > 0 && totalPoints > 0) {
        percentage = (exam.attempts[0].score / totalPoints) * 100;
      }
      
      totalPercentage += percentage;
      
      examDetails.push({
        examId: exam.id,
        examTitle: exam.title,
        highestScore: exam.attempts.length > 0 ? exam.attempts[0].score : 0,
        totalPoints,
        percentage: Math.round(percentage),
        isAttempted: exam.attempts.length > 0,
      });
    }

    const averagePercentage = totalPercentage / exams.length;

    return {
      courseId,
      averagePercentage: Math.round(averagePercentage),
      examsCount: exams.length,
      examDetails,
    };
  }
async getExcellenceCourses(studentUserId: number) {
  // 1. التأكد الحتمي من أن المعرّف عبارة عن رقم لتجنب مشاكل الـ Type Mismatch
  const userId = Number(studentUserId);
  if (isNaN(userId)) {
    throw new BadRequestException('Invalid student user ID');
  }

  // 2. جلب بيانات الطالب مع سجلات التسجيل
  const student = await this.prisma.student.findUnique({
    where: { userId: userId },
    include: {
      enrollments: true,
    },
  });

  if (!student) {
    throw new NotFoundException('Student profile not found');
  }

  // جلب كافة الكورسات المتاحة في النظام
  const courses = await this.prisma.course.findMany();
  const excellenceCourses = [];

  // 3. المرور على كافة الكورسات والتحقق من الشروط
  for (const course of courses) {
    const enrollment = student.enrollments.find((e) => e.courseId === course.id);

    // حساب نسبة التقدم في الكورس
    const progressResult = await this.getCourseProgress(userId, course.id);
    const progressPercentage = (progressResult as any)?.progressPercentage || 0;

    // جلب درجات الطالب في هذا الكورس
    const gradesResult = await this.getCourseGrades(userId, course.id);
       
    // تأمين وجود النتيجة وتوحيد قراءة النسبة المئوية 
    // (تدعم ما إذا كانت الدالة تعيد النسبة كـ 95 أو كـ 0.95)
    let average = gradesResult?.averagePercentage || 0;
    if (average > 0 && average < 1) {
      average = average * 100; // تحويل الكسر العشري (0.90) إلى نسبة مئوية (90)
    }

    const hasExams = gradesResult?.examsCount > 0;
    const allExamsAttempted = hasExams && gradesResult.examDetails.every((e: any) => e.isAttempted);

    // تحديد ما إذا كان الكورس يعتبر مكتملًا ومميزًا
    // الكورس المكتمل والمميز يجب أن يكون مسجلاً فيه وحقق الشروط
    const isCompleted = enrollment ? (allExamsAttempted && average >= 90) : false;

    excellenceCourses.push({
      courseId: course.id,
      courseTitle: course.title,
      courseImage: course.thumbnail,
      averagePercentage: average,
      completedAt: isCompleted ? enrollment?.updatedAt : null,
      isCompleted: isCompleted,
    });
  }

  // 4. ترتيب الكورسات بحيث تظهر المكتملة أولاً ثم ترتيب تنازلياً حسب الدرجة
  excellenceCourses.sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return -1;
    if (!a.isCompleted && b.isCompleted) return 1;
    return b.averagePercentage - a.averagePercentage;
  });

  return excellenceCourses;
}
  async getTotalEarnedPoints(studentUserId: number) {
    const userId = Number(studentUserId);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid student user ID');
    }

    const student = await this.prisma.student.findUnique({
      where: { userId: userId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const attempts = await this.prisma.examAttempt.groupBy({
      by: ['examId'],
      where: { studentId: student.id },
      _max: {
        score: true,
      },
    });

    const totalPoints = attempts.reduce((sum, attempt) => sum + (attempt._max.score || 0), 0);

    return { totalPoints };
  }

  async getExcellenceModules(studentUserId: number, courseId: number) {
    const userId = Number(studentUserId);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid student user ID');
    }

    const student = await this.prisma.student.findUnique({
      where: { userId: userId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const excellenceModules = [];

    for (const module of course.modules) {
      const gradesResult = await this.getModuleGrades(userId, module.id);
      
      if (gradesResult?.examsCount === 0) {
        continue;
      }
      

      let average = gradesResult?.averagePercentage || 0;
      if (average > 0 && average < 1) {
        average = average * 100;
      }

      const hasExams = gradesResult?.examsCount > 0;
      const allExamsAttempted = hasExams && gradesResult.examDetails.every((e: any) => e.isAttempted);

      const isCompleted = allExamsAttempted && average >= 85;

      excellenceModules.push({
        moduleId: module.id,
        moduleTitle: module.title,
        courseId: course.id,
        courseTitle: course.title,
        averagePercentage: average,
        isCompleted: isCompleted,
      });
    }

    excellenceModules.sort((a, b) => b.averagePercentage - a.averagePercentage);

    return excellenceModules;
  }
}
