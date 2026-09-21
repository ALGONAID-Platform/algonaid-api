import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupUnverifiedAccounts() {
    this.logger.log('Starting unverified accounts cleanup CRON job...');

    // 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      // Find all users who are not verified and created more than 7 days ago
      const usersToDelete = await this.prisma.user.findMany({
        where: {
          emailVerified: false,
          createdAt: {
            lt: sevenDaysAgo,
          },
          // Additional safety: Ensure they haven't made any purchases
          // If a user has active enrollments, we probably shouldn't delete them.
          studentProfile: {
            enrollments: {
              none: {},
            },
          },
        },
      });

      if (usersToDelete.length === 0) {
        this.logger.log('No unverified accounts found for deletion.');
        return;
      }

      this.logger.log(`Found ${usersToDelete.length} unverified accounts older than 7 days. Deleting...`);

      const userIds = usersToDelete.map(u => u.id);

      // Prisma requires us to delete dependent records or use onDelete: Cascade in schema.
      // Assuming Prisma schema has cascade deletes for profiles/tokens etc, 
      // otherwise this will throw a foreign key constraint error.
      const deleted = await this.prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });

      this.logger.log(`Successfully deleted ${deleted.count} unverified accounts.`);
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
