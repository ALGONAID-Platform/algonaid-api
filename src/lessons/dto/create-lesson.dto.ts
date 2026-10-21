import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { LessonStatus, LiveStatus } from '@prisma/client';

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

  @ApiProperty({ example: [{ title: 'ملخص الدرس', url: 'https://ucarecdn.com/.../file.pdf' }], required: false, description: 'قائمة ملفات الـ PDF للدرس' })
  @IsOptional()
  @IsArray()
  pdfFiles?: { title: string; url: string; order?: number }[];

  @ApiProperty({ example: 'https://api.exchangesmangement.online/uploads/lesson-cover.jpg', required: false, description: 'رابط صورة أو غلاف الدرس' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ enum: LessonStatus, example: LessonStatus.DRAFT, required: false })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  @ApiProperty({ example: true, required: false, description: 'إذا كان true يعرض الوصف فقط بدون فيديو أو ملف' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isReading?: boolean;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number;

  @ApiProperty({ example: 1, required: false, description: 'معرف الموديول (إذا لم يتم إرساله، يجب إرسال courseId ليتم وضعه بموديول افتراضي)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  moduleId?: number;

  @ApiProperty({ example: 1, required: false, description: 'معرف الكورس لإنشاء موديول افتراضي إذا لم يرسل moduleId' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  courseId?: number;

  @ApiProperty({ example: false, required: false, description: 'معاينة مجانية للطلاب غير المشتركين في الكورسات المدفوعة' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFreePreview?: boolean;

  @ApiProperty({ example: 'https://meet.google.com/xyz-abcd-efg', required: false, description: 'رابط البث المباشر (Google Meet أو Zoom)' })
  @IsOptional()
  @IsString()
  liveMeetingUrl?: string;

  @ApiProperty({ example: '2026-10-20T18:00:00.000Z', required: false, description: 'موعد بدء المحاضرة المباشرة' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date;

  @ApiProperty({ example: 90, required: false, description: 'مدة المحاضرة المباشرة بالدقائق' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  durationMinutes?: number;

  @ApiProperty({ enum: LiveStatus, example: LiveStatus.SCHEDULED, required: false, description: 'حالة البث المباشر' })
  @IsOptional()
  @IsEnum(LiveStatus)
  liveStatus?: LiveStatus;

  @ApiProperty({ example: 'https://example.com/recording.mp4', required: false, description: 'رابط تسجيل المحاضرة بعد انتهائها' })
  @IsOptional()
  @IsString()
  recordingVideoUrl?: string;

  @ApiProperty({ example: 1, required: false, description: 'رقم اليوم في الدورة' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  dayNumber?: number;

  @ApiProperty({ example: ['فهم بنية فلاتر', 'إنشاء أول ويدجت'], required: false, description: 'أهداف ومخرجات هذا الدرس', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @ApiProperty({ example: true, required: false, description: 'حضور إلزامي لاستحقاق الشهادة', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isMandatory?: boolean;
}

