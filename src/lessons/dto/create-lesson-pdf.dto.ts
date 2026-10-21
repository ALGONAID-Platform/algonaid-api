import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLessonPdfDto {
  @ApiProperty({ example: 'ملخص الدرس', description: 'عنوان ملف الـ PDF' })
  @IsNotEmpty({ message: 'عنوان الملف مطلوب' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'https://ucarecdn.com/.../lesson.pdf', required: false, description: 'رابط الملف (اختياري عند رفع ملف مباشر)' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ example: 0, required: false, description: 'ترتيب الملف' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number;
}
