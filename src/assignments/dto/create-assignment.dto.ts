import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { AssignmentType } from '@prisma/client';

export class CreateAssignmentDto {
  @ApiProperty({ description: 'معرّف الدرس التابع له التكليف', example: 12 })
  @Type(() => Number)
  @IsInt({ message: 'معرّف الدرس يجب أن يكون رقماً صحيحاً' })
  @IsPositive()
  @IsNotEmpty({ message: 'معرّف الدرس مطلوب' })
  lessonId: number;

  @ApiProperty({ description: 'عنوان التكليف', example: 'تكليف الدرس الأول: بناء واجهة تسجيل الدخول' })
  @IsString({ message: 'عنوان التكليف يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'عنوان التكليف مطلوب' })
  title: string;

  @ApiPropertyOptional({ description: 'وصف أو تفاصيل المسألة والمطلوب تنفيذه' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: AssignmentType,
    default: AssignmentType.TASK,
    description: 'نوع التكليف: TASK (واجب/مهمة عملية) أو QUIZ (كويز)',
  })
  @IsOptional()
  @IsEnum(AssignmentType, { message: 'نوع التكليف غير صالح' })
  type?: AssignmentType = AssignmentType.TASK;

  @ApiPropertyOptional({ description: 'الدرجة الكلية القصوى للتكليف', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number = 100;

  @ApiPropertyOptional({ description: 'الموعد النهائي لتسليم التكليف (ISO Date)', example: '2026-11-01T23:59:59Z' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'رابط ملف مرفق من المعلم (PDF أو صورة أو تعليمات)' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: 'معرّف الاختبار إذا كان نوع التكليف كويز', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examId?: number;
}

