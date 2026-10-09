import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { LeaderboardService } from './leaderboard.service';
import { ExamsScheduler } from './exams.scheduler';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { UploadcareStorageService } from 'src/utils/uploadcare-storage.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    ExamsService,
    LeaderboardService,
    ExamsScheduler,
    UploadcareStorageService,
  ],
  controllers: [ExamsController],
})
export class ExamsModule {}
