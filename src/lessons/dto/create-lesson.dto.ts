import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

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

  @ApiProperty({ example: '{"questions": []}', required: false })
  @IsOptional()
  @IsString()
  exam?: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsInt()
  moduleId: number;
}
