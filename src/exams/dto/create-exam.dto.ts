import {
  IsString, IsNotEmpty, IsOptional, IsInt, Min, Max,
  IsArray, ValidateNested, IsBoolean, IsEnum, ArrayMinSize,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ExamType, QuestionType, RankingCriteria } from '@prisma/client';

// ===========================
// Option DTO
// ===========================
export class CreateOptionDto {
  @ApiProperty({ description: 'نص الخيار' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'هل هذا الخيار صحيح؟' })
  @IsBoolean()
  isCorrect: boolean;
}

// ===========================
// Question DTO
// ===========================
export class CreateQuestionDto {
  @ApiProperty({ description: 'نص السؤال' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ required: false, description: 'رابط صورة السؤال (اختياري)' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ enum: QuestionType, default: QuestionType.MULTIPLE_CHOICE })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({ default: 1, description: 'درجة السؤال' })
  @IsInt()
  @Min(1)
  points: number;

  @ApiProperty({ type: [CreateOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  @ArrayMinSize(2, { message: 'يجب أن يحتوي السؤال على خيارين على الأقل' })
  options: CreateOptionDto[];
}

// ===========================
// Exam DTO
// ===========================
export class CreateExamDto {
  @ApiProperty({ description: 'عنوان الاختبار' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false, description: 'وصف الاختبار' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, description: 'رابط صورة الاختبار' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ default: 50, description: 'درجة النجاح (من 0 إلى 100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore: number;

  @ApiProperty({ default: 1, description: 'عدد المحاولات المسموح بها' })
  @IsInt()
  @Min(1)
  maxAttempts: number;

  @ApiProperty({ required: false, description: 'مدة الاختبار بالدقائق (اختياري)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimit?: number;

  @ApiProperty({ enum: ExamType, default: ExamType.LESSON_QUIZ })
  @IsEnum(ExamType)
  @IsOptional()
  examType?: ExamType;

  @ApiProperty({ enum: RankingCriteria, default: RankingCriteria.BOTH })
  @IsEnum(RankingCriteria)
  @IsOptional()
  rankingCriteria?: RankingCriteria;

  @ApiProperty({ required: false, description: 'وقت بدء التحدي (للنوع CHALLENGE فقط)' })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiProperty({ required: false, description: 'وقت انتهاء التحدي (للنوع CHALLENGE فقط)' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({ required: false, description: 'اختبار على مستوى درس معين' })
  @IsInt()
  @IsOptional()
  lessonId?: number;

  @ApiProperty({ required: false, description: 'اختبار على مستوى كورس كامل' })
  @IsInt()
  @IsOptional()
  courseId?: number;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}
