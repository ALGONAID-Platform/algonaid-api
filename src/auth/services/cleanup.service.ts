import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CleanupService implements OnModuleInit {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('CleanupService initialized. Running unverified accounts cleanup on startup...');
    await this.cleanupUnverifiedAccounts();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupUnverifiedAccounts() {
    this.logger.log('Starting unverified accounts cleanup CRON job (3 days threshold)...');

    // 3 days ago (72 hours)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    try {
      // Find all users who are not verified and created more than 3 days ago
      const usersToDelete = await this.prisma.user.findMany({
        where: {
          emailVerified: false,
          createdAt: {
            lt: threeDaysAgo,
          },
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      if (usersToDelete.length === 0) {
        this.logger.log('No unverified accounts older than 3 days found for deletion.');
        return;
      }

      this.logger.log(`Found ${usersToDelete.length} unverified accounts older than 3 days. Deleting...`);

      const userIds = usersToDelete.map(u => u.id);

      // Clean up dependent profile records first to prevent foreign key violations
      await this.prisma.student.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });

      await this.prisma.teacher.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });

      const deleted = await this.prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });

      this.logger.log(`Successfully deleted ${deleted.count} unverified accounts older than 3 days.`);
    } catch (error) {
      this.logger.error('Failed to cleanup unverified accounts', error);
    }

    this.logger.log('Starting expired tokens cleanup CRON job...');
    try {
      const deletedTokens = await this.prisma.tokenBlacklist.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      this.logger.log(`Successfully deleted ${deletedTokens.count} expired tokens from blacklist.`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens', error);
    }
  }
}
