import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExamStatus, ExamType } from '@prisma/client';

@Injectable()
export class ExamsScheduler {
  private readonly logger = new Logger(ExamsScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredChallenges() {
    const now = new Date();

    const expiredChallenges = await this.prisma.exam.findMany({
      where: {
        examType: ExamType.CHALLENGE,
        endTime: { lte: now },
      },
      select: { id: true, title: true },
    });

    if (expiredChallenges.length === 0) return;

    for (const exam of expiredChallenges) {
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
          `Challenge "${exam.title}" (ID: ${exam.id}) ended — closed ${updated.count} open attempt(s)`,
        );
      }
    }
  }
}
