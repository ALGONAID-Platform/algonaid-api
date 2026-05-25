import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, Role } from 'src/prisma/client/enums';
import { SubmitExamDto } from './dto/exam-submission.dto';
import { CreateExamDto, CreateQuestionDto, CreateOptionDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkExamPermission(userId: number, role: Role, examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { lesson: { include: { module: { include: { course: true } } } } },
    });

    if (!exam) throw new NotFoundException('Exam not found');

    if (role !== Role.OWNER) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId },
      });
      if (!teacher || exam.lesson.module.course.instructorId !== teacher.id) {
        throw new ForbiddenException('You are not authorized to manage this exam');
      }
    }
    return exam;
  }

  async updateExam(userId: number, role: Role, examId: number, updateExamDto: UpdateExamDto) {
    await this.checkExamPermission(userId, role, examId);

    // Simplest approach: update metadata. 
    // If questions are provided, we replace them to ensure consistency.
    const { questions, ...metadata } = updateExamDto;

    return this.prisma.$transaction(async (tx) => {
      if (questions) {
        // Delete old questions (Prisma cascade will handle options)
        await tx.question.deleteMany({ where: { examId } });

        // Add new questions
        await tx.exam.update({
          where: { id: examId },
          data: {
            ...metadata,
            questions: {
              create: questions.map((q: CreateQuestionDto) => ({
                text: q.text,
                type: q.type,
                points: q.points,
                options: {
                  create: q.options.map((o: CreateOptionDto) => ({
                    text: o.text,
                    isCorrect: o.isCorrect,
                  })),
                },
              })),
            },
          },
        });
      } else {
        await tx.exam.update({
          where: { id: examId },
          data: metadata,
        });
      }
    
      return tx.exam.findUnique({
        where: { id: examId },
        include: { questions: { include: { options: true } } },
      });
    });
  }

  async deleteExam(userId: number, role: Role, examId: number) {
    await this.checkExamPermission(userId, role, examId);
    await this.prisma.exam.delete({ where: { id: examId } });
    return { message: 'Exam deleted successfully' };
  }

  async createExam(userId: number, role: Role, createExamDto: CreateExamDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: createExamDto.lessonId },
      include: { module: { include: { course: true } } },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');

    if (role !== Role.OWNER) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId },
      });
      if (!teacher || lesson.module.course.instructorId !== teacher.id) {
        throw new ForbiddenException('You are not authorized to add an exam to this lesson');
      }
    }

    // Check if exam already exists for this lesson
    const existingExam = await this.prisma.exam.findUnique({
      where: { lessonId: createExamDto.lessonId },
    });
    if (existingExam) throw new BadRequestException('Exam already exists for this lesson');

    return this.prisma.exam.create({
      data: {
        title: createExamDto.title,
        description: createExamDto.description,
        passingScore: createExamDto.passingScore,
        maxAttempts: createExamDto.maxAttempts,
        lessonId: createExamDto.lessonId,
        questions: {
          create: createExamDto.questions.map((q: CreateQuestionDto) => ({
            text: q.text,
            type: q.type,
            points: q.points,
            options: {
              create: q.options.map((o: CreateOptionDto) => ({
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            },
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });
  }

  async getExam(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          select: {
            id: true,
            text: true,
            type: true,
            points: true,
            options: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    return exam;
  }


  async startExam(studentUserId: number, examId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) throw new NotFoundException('Student profile not found');

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: {
          select: { attempts: { where: { studentId: student.id } } },
        },
      },
    });

    if (!exam) throw new NotFoundException('Exam not found');

    if (exam._count.attempts >= exam.maxAttempts) {
      throw new ForbiddenException('Maximum attempts reached for this exam');
    }

    const attempt = await this.prisma.examAttempt.create({
      data: {
        studentId: student.id,
        examId: exam.id,
        status: ExamStatus.IN_PROGRESS,
      },
    });

    return {
      message: 'Exam started successfully',
      attemptId: attempt.id,
      questions: await this.prisma.question.findMany({
        where: { examId },
        select: {
          id: true,
          text: true,
          type: true,
          options: {
            select: { id: true, text: true },
          },
        },
      }),
    };
  }

  async submitExam(studentUserId: number, attemptId: number, submission: SubmitExamDto) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { include: { questions: { include: { options: true } } } } },
    });

    if (!attempt || attempt.studentId !== student?.id) {
      throw new NotFoundException('Exam attempt not found');
    }

    if (attempt.status !== ExamStatus.IN_PROGRESS) {
      throw new BadRequestException('Exam already submitted');
    }

    let score = 0;
    let totalPoints = 0;
    const userAnswersData = [];

    for (const question of attempt.exam.questions) {
      totalPoints += question.points;
      const userAnswer = submission.answers.find((a) => a.questionId === question.id);
      const selectedOption = question.options.find((o) => o.id === userAnswer?.selectedOptionId);

      if (selectedOption?.isCorrect) {
        score += question.points;
      }

      if (userAnswer) {
        userAnswersData.push({
          questionId: question.id,
          selectedOptionId: userAnswer.selectedOptionId,
          attemptId: attempt.id,
        });
      }
    }

    const percentage = (score / totalPoints) * 100;
    let status: ExamStatus = ExamStatus.FAILED;

    if (percentage >= attempt.exam.passingScore) {
      status = ExamStatus.PASSED;
    } else if (percentage >= attempt.exam.passingScore - 10) {
      status = ExamStatus.IMPROVEMENT_NEEDED;
    }

    await this.prisma.userAnswer.createMany({
      data: userAnswersData,
    });

    return await this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        score,
        status,
        completedAt: new Date(),
      },
      include: {
        exam: true,
      },
    });
  }

  async getResult(studentUserId: number, attemptId: number) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
            selectedOption: true,
          },
        },
      },
    });

    if (!attempt || attempt.studentId !== student?.id) {
      throw new NotFoundException('Exam result not found');
    }

    return attempt;
  }
}
