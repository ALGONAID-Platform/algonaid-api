import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SubmissionStatus } from '@prisma/client';

export class BulkGradeItemDto {
  @ApiProperty({ description: 'معرف التسليم' })
  @Type(() => Number)
  @IsInt({ message: 'معرف التسليم يجب أن يكون رقماً' })
  submissionId: number;

  @ApiPropertyOptional({ description: 'الدرجة الممنوحة لهذا التسليم المحدد' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'الدرجة يجب أن تكون رقماً صحيحاً' })
  @Min(0, { message: 'الدرجة لا يمكن أن تكون سالبة' })
  score?: number;

  @ApiPropertyOptional({ description: 'ملاحظات المعلم لهذا التسليم المحدد' })
  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  feedback?: string;

  @ApiPropertyOptional({ description: 'رابط صورة التصحيح' })
  @IsOptional()
  @IsString()
  feedbackImageUrl?: string;

  @ApiPropertyOptional({ enum: SubmissionStatus })
  @IsOptional()
  @IsEnum(SubmissionStatus, { message: 'حالة التقييم غير صالحة' })
  status?: SubmissionStatus;
}

export class BulkGradeSubmissionsDto {
  @ApiPropertyOptional({
    description: 'قائمة بمعرفات التسليمات المراد تطبيق الرد المشترك عليها',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  submissionIds?: number[];

  @ApiPropertyOptional({
    description: 'قائمة تفصيلية بالتسليمات مع درجات وملاحظات مخصصة لكل تسليم',
    type: [BulkGradeItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGradeItemDto)
  items?: BulkGradeItemDto[];

  @ApiPropertyOptional({
    description: 'درجة مشتركة تطبق على جميع التسليمات المحددة',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'الدرجة يجب أن تكون رقماً صحيحاً' })
  @Min(0, { message: 'الدرجة لا يمكن أن تكون سالبة' })
  commonScore?: number;

  @ApiPropertyOptional({
    description: 'رد أو إجابة مشتركة أو ملاحظة موحدة لجميع التسليمات المحددة',
  })
  @IsOptional()
  @IsString()
  commonFeedback?: string;

  @ApiPropertyOptional({
    description: 'رابط صورة أو توضيح مشترك لجميع التسليمات',
  })
  @IsOptional()
  @IsString()
  commonFeedbackImageUrl?: string;

  @ApiPropertyOptional({
    enum: SubmissionStatus,
    default: SubmissionStatus.GRADED,
    description: 'الحالة المشتركة لجميع التسليمات المحددة',
  })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  commonStatus?: SubmissionStatus;
}
