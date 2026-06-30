import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { LessonStatus } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty({ example: 'Introduction to NestJS' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'A brief overview of NestJS', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Detailed content about NestJS architecture', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', required: false })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiProperty({ example: 'uploads/lesson-1.pdf', required: false })
  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @ApiProperty({ enum: LessonStatus, example: LessonStatus.DRAFT, required: false })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  @ApiProperty({ example: true, required: false, description: 'إذا كان true يعرض الوصف فقط بدون فيديو أو ملف' })
  @IsOptional()
  @IsBoolean()
  isReading?: boolean;

  @ApiProperty({ example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  moduleId: number;
}
