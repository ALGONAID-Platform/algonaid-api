import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CoursesEvaluationService } from './courses-evaluation.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesEvaluationService],
  exports: [CoursesService, CoursesEvaluationService],
})
export class CoursesModule {}
 