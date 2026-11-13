import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CoursesEvaluationService } from './courses-evaluation.service';
import { AuthModule } from 'src/auth/auth.module';
import { GradesModule } from 'src/grades/grades.module';

@Module({
  imports: [AuthModule, GradesModule],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesEvaluationService],
  exports: [CoursesService, CoursesEvaluationService],
})
export class CoursesModule {}
 