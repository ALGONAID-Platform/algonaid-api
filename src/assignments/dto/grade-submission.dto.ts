import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { SubmissionStatus } from '@prisma/client';

export class GradeSubmissionDto {
  @ApiProperty({ description: 'الدرجة الممنوحة للطالب', example: 95 })
  @Type(() => Number)
  @IsInt({ message: 'الدرجة يجب أن تكون رقماً صحيحاً' })
  @Min(0, { message: 'الدرجة لا يمكن أن تكون سالبة' })
  @IsNotEmpty({ message: 'الدرجة مطلوبة' })
  score: number;

  @ApiPropertyOptional({
    description: 'ملاحظات المعلم وتقييمه للحل',
    example: 'أداء ممتاز، ولكن انتبه لمعالجة حالات الخطأ في السطر 45.',
  })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  feedback?: string;

  @ApiPropertyOptional({
    description: 'رابط صورة التصحيح أو التوضيح إن وجد',
    example: 'https://ucarecdn.com/.../correction.png',
  })
  @IsOptional()
  @IsString()
  feedbackImageUrl?: string;

  @ApiPropertyOptional({
    enum: [SubmissionStatus.GRADED, SubmissionStatus.RESUBMISSION_REQUESTED],
    default: SubmissionStatus.GRADED,
    description: 'حالة التسليم بعد المراجعة: GRADED أو RESUBMISSION_REQUESTED',
  })
  @IsOptional()
  @IsEnum(SubmissionStatus, { message: 'حالة التقييم غير صالحة' })
  status?: SubmissionStatus = SubmissionStatus.GRADED;
}

