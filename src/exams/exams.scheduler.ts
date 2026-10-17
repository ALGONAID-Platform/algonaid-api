import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, ExamType } from '@prisma/client';
import { sortByRankingCriteria } from './helpers/ranking.helper';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class ExamsScheduler {
  private readonly logger = new Logger(ExamsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredChallenges() {
    const now = new Date();

    // جلب جميع الاختبارات التي انتهى وقتها المحدد (تحديات أو اختبارات لها endTime)
    const expiredExams = await this.prisma.exam.findMany({
      where: {
        endTime: { lte: now },
      },
      select: {
        id: true,
        title: true,
        rankingCriteria: true,
        questions: { select: { points: true } },
      },
    });

    if (expiredExams.length === 0) return;

    for (const exam of expiredExams) {
      // 1. إغلاق أي محاولات كانت لا تزال معلقة أثناء انتهاء الوقت
      const updated = await this.prisma.examAttempt.updateMany({
        where: {
          examId: exam.id,
          status: ExamStatus.IN_PROGRESS,
        },
        data: {
          status: ExamStatus.FAILED,
          completedAt: now,
        },
      });

      if (updated.count > 0) {
        this.logger.log(
          `Exam "${exam.title}" (ID: ${exam.id}) ended — closed ${updated.count} open attempt(s)`,
        );
      }

      // 2. احتساب مجموع درجات الاختبار
      const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);

      // 3. جلب جميع المحاولات المصنفة المكتملة لاحتساب الترتيب النهائي
      const rankedAttempts = await this.prisma.examAttempt.findMany({
        where: {
          examId: exam.id,
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
              userId: true,
              user: { select: { name: true, avatar: true } },
            },
          },
        },
      });

      if (rankedAttempts.length === 0) continue;

      // ترتيب الطلاب حسب معايير الاختبار
      const sortedAttempts = sortByRankingCriteria(rankedAttempts as any, exam.rankingCriteria);

      // 4. إرسال إشعار لكل طالب بالمركز والدرجة في قسم الردود (مع التحقق من عدم التكرار)
      for (let i = 0; i < sortedAttempts.length; i++) {
        const attempt = sortedAttempts[i];
        const studentUserId = attempt.student?.userId;
        if (!studentUserId) continue;

        const alreadyNotified = await this.notificationsService.hasExamNotification(
          studentUserId,
          exam.id,
        );

        if (!alreadyNotified) {
          const rank = i + 1;
          const percentage = totalPoints > 0 ? Math.round((attempt.score / totalPoints) * 100) : 0;

          await this.notificationsService.notifyExamResult(
            studentUserId,
            exam.id,
            exam.title,
            rank,
            attempt.score,
            totalPoints,
            percentage,
          );

          this.logger.log(
            `Sent final exam ranking notification to user ${studentUserId} for exam "${exam.title}" (Rank: ${rank})`,
          );
        }
      }
    }
  }
}
