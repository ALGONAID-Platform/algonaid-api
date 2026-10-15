import {
  IsString, IsNotEmpty, IsOptional, IsInt, Min, Max,
  IsArray, ValidateNested, IsBoolean, IsEnum, ArrayMinSize,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ExamType, QuestionType, RankingCriteria } from '@prisma/client';

export class CreateOptionDto {
  @ApiProperty({ description: 'نص الخيار' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'هل هذا الخيار صحيح؟' })
  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuestionDto {
  @ApiProperty({ description: 'نص السؤال' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ required: false, description: 'رابط صورة السؤال' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ enum: QuestionType, default: QuestionType.MULTIPLE_CHOICE })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({ default: 1 })
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

export class CreateExamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ default: 50 })
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore: number;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  maxAttempts: number;

  @ApiProperty({ required: false })
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

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  lessonId?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  courseId?: number;

  @ApiProperty({
    required: false,
    description: 'هل يتم جعل الاختبار تكليفاً داخل الدرس (ضمن تبويب التكليف) أم اختباراً مرحلياً خارجياً بعد الدرس؟',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  asAssignment?: boolean;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}
