import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, ExamType, Role } from '@prisma/client';
import { sortByRankingCriteria, getGradeLabel } from './helpers/ranking.helper';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        rankingCriteria: true,
        title: true,
        startTime: true,
        endTime: true,
        examType: true,
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const now = new Date();
    const isEnded = exam.endTime ? exam.endTime <= now : true;

    const rankedAttempts = await this.prisma.examAttempt.findMany({
      where: {
        examId,
        isRanked: true,
        status: { not: ExamStatus.IN_PROGRESS },
      },
      select: {
        id: true,
        score: true,
        timeTaken: true,
        startedAt: true,
        completedAt: true,
        student: {
          select: {
            id: true,
            user: { select: { name: true, avatar: true } },
          },
        },
      },
    });

    // ضمان فرادة الطلاب وعدم تكرار أي طالب في القائمة
    const uniqueRankedAttempts: typeof rankedAttempts = [];
    const seenStudentIds = new Set<number>();
    for (const att of rankedAttempts) {
      if (!seenStudentIds.has(att.student.id)) {
        seenStudentIds.add(att.student.id);
        uniqueRankedAttempts.push(att);
      }
    }

    if (!isEnded) {
      // أثناء سير الاختبار: عرض أسماء المشاركين وصورهم وتوقيت المشاركة فقط بدون درجات وبدون ترتيب
      const participants = [...uniqueRankedAttempts]
        .sort((a, b) => {
          const timeA = a.completedAt ? new Date(a.completedAt).getTime() : (a.startedAt ? new Date(a.startedAt).getTime() : 0);
          const timeB = b.completedAt ? new Date(b.completedAt).getTime() : (b.startedAt ? new Date(b.startedAt).getTime() : 0);
          return timeB - timeA;
        })
        .map((attempt) => ({
          studentId: attempt.student.id,
          name: attempt.student.user.name,
          avatar: attempt.student.user.avatar,
          completedAt: attempt.completedAt || attempt.startedAt,
          participatedAt: attempt.completedAt || attempt.startedAt,
        }));

      return {
        examId,
        examTitle: exam.title,
        rankingCriteria: exam.rankingCriteria,
        isEnded: false,
        status: 'ONGOING',
        endTime: exam.endTime,
        participantsCount: uniqueRankedAttempts.length,
        leaderboard: participants,
        participants,
      };
    }

    // بعد انتهاء الاختبار: عرض قائمة المتصدرين الكاملة بالدرجات والمراكز والوقت المستغرق
    let sorted = sortByRankingCriteria(uniqueRankedAttempts, exam.rankingCriteria);

    if (!sorted.some((a) => a.score > 0)) {
      sorted = [];
    }

    const leaderboard = sorted.map((attempt, index) => ({
      rank: index + 1,
      studentId: attempt.student.id,
      name: attempt.student.user.name,
      avatar: attempt.student.user.avatar,
      score: attempt.score,
      timeTakenMs: attempt.timeTaken ?? 0,
      completedAt: attempt.completedAt,
      participatedAt: attempt.completedAt || attempt.startedAt,
    }));

    return {
      examId,
      examTitle: exam.title,
      rankingCriteria: exam.rankingCriteria,
      isEnded: true,
      status: 'ENDED',
      endTime: exam.endTime,
      participantsCount: uniqueRankedAttempts.length,
      leaderboard,
      participants: leaderboard,
    };
  }

  async getMyResult(examId: number, userId: number) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student profile not found');

    const attempt = await this.prisma.examAttempt.findFirst({
      where: {
        examId,
        studentId: student.id,
        status: { in: [ExamStatus.PASSED, ExamStatus.FAILED, ExamStatus.IMPROVEMENT_NEEDED] },
      },
      orderBy: { id: 'desc' },
      include: {
        exam: {
          select: {
            title: true,
            passingScore: true,
            rankingCriteria: true,
            questions: {
              include: {
                options: true,
              },
              orderBy: { id: 'asc' },
            },
          },
        },
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

    if (!attempt) throw new NotFoundException('لم تقم بإجراء هذا الاختبار بعد');

    const totalPoints = attempt.exam.questions.reduce(
      (sum, q) => sum + q.points,
      0,
    );

    const questions = attempt.exam.questions.map((q) => {
      const answer = attempt.answers.find((a) => a.questionId === q.id);
      const correctOption = q.options.find((o) => o.isCorrect);
      const isCorrect = answer?.selectedOption ? answer.selectedOption.isCorrect : false;
      return {
        id: q.id,
        questionId: q.id,
        text: q.text,
        questionText: q.text,
        imageUrl: q.imageUrl,
        questionImage: q.imageUrl,
        type: q.type,
        points: q.points,
        earnedPoints: isCorrect ? q.points : 0,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          questionId: q.id,
        })),
        selectedOption: answer?.selectedOption
          ? { id: answer.selectedOption.id, text: answer.selectedOption.text }
          : null,
        selectedOptionId: answer?.selectedOptionId ?? null,
        correctOption: correctOption
          ? { id: correctOption.id, text: correctOption.text }
          : null,
        correctOptionId: correctOption?.id ?? null,
        isCorrect,
        userAnswerId: answer?.selectedOptionId ?? null,
      };
    });

    const passingPoints = totalPoints > 0 ? Math.ceil((attempt.exam.passingScore / 100) * totalPoints) : 0;

    return {
      attemptId: attempt.id,
      id: attempt.id,
      examId: attempt.examId,
      studentId: attempt.studentId,
      examTitle: attempt.exam.title,
      score: attempt.score,
      totalPoints,
      percentage: totalPoints > 0 ? Math.round((attempt.score / totalPoints) * 100) : 0,
      passingScore: attempt.exam.passingScore,
      passingPoints,
      minPassingScore: passingPoints,
      status: attempt.status,
      timeTakenMs: attempt.timeTaken ?? 0,
      completedAt: attempt.completedAt,
      questions,
    };
  }

  async getStats(examId: number, userId: number, userRole: Role) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: { include: { options: true } },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const now = new Date();
    const isChallengeActive =
      exam.examType === ExamType.CHALLENGE &&
      exam.endTime &&
      exam.endTime > now;

    if (
      isChallengeActive &&
      userRole !== Role.ADMIN &&
      userRole !== Role.OWNER
    ) {
      throw new ForbiddenException(
        'الإحصائيات ستكون متاحة بعد انتهاء التحدي',
      );
    }

    const allAttempts = await this.prisma.examAttempt.findMany({
      where: { examId },
      include: {
        answers: {
          include: { selectedOption: true },
        },
      },
    });

    const completed = allAttempts.filter(
      (a) => a.status !== ExamStatus.IN_PROGRESS,
    );
    const notCompleted = allAttempts.filter(
      (a) => a.status === ExamStatus.IN_PROGRESS,
    );

    const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);
    const gradeDistribution = { excellent: 0, veryGood: 0, good: 0, acceptable: 0, failed: 0 };
    let scoreSum = 0;

    for (const attempt of completed) {
      scoreSum += attempt.score;
      const grade = getGradeLabel(attempt.score, totalPoints);
      gradeDistribution[grade]++;
    }

    const questionStats = exam.questions.map((question) => {
      const correctOptionIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id);

      let correctCount = 0;
      let wrongCount = 0;

      for (const attempt of allAttempts) {
        const answer = attempt.answers.find(
          (a) => a.questionId === question.id,
        );
        if (!answer) continue;
        if (correctOptionIds.includes(answer.selectedOptionId)) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }

      const totalAnswered = correctCount + wrongCount;
      return {
        questionId: question.id,
        text: question.text,
        imageUrl: question.imageUrl,
        totalAnswered,
        correctCount,
        wrongCount,
        correctPercentage:
          totalAnswered > 0
            ? Math.round((correctCount / totalAnswered) * 100)
            : 0,
      };
    });

    return {
      overview: {
        totalParticipants: allAttempts.length,
        completed: completed.length,
        notCompleted: notCompleted.length,
        averageScore:
          completed.length > 0
            ? Math.round((scoreSum / completed.length) * 10) / 10
            : 0,
        gradeDistribution,
      },
      questions: questionStats,
    };
  }
}
