import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus } from 'src/prisma/client/enums';
import { SubmitExamDto } from './dto/exam-submission.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

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
