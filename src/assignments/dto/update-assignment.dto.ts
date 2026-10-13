import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateAssignmentDto } from './create-assignment.dto';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AssignmentType } from '@prisma/client';

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ description: 'عنوان التكليف' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'وصف أو تفاصيل المسألة والمطلوب تنفيذه' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: AssignmentType,
    description: 'نوع التكليف: TASK (واجب/مهمة عملية) أو QUIZ (كويز)',
  })
  @IsOptional()
  @IsEnum(AssignmentType)
  type?: AssignmentType;

  @ApiPropertyOptional({ description: 'الدرجة الكلية القصوى للتكليف' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;

  @ApiPropertyOptional({ description: 'الموعد النهائي لتسليم التكليف' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'رابط ملف مرفق من المعلم' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: 'معرّف الاختبار المرتبط إن وجد' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  examId?: number;
}

