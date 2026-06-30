import { Module } from '@nestjs/common';
import { PracticeExamsService } from './practice-exams.service';
import { PracticeExamsController } from './practice-exams.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PracticeExamsController],
  providers: [PracticeExamsService],
  exports: [PracticeExamsService],
})
export class PracticeExamsModule {}
