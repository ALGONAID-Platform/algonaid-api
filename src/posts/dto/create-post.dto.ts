import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsArray, ArrayMinSize } from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({ description: 'عنوان المنشور', example: 'مرحبًا بكم' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'محتوى المنشور', example: 'هذا هو محتوى المنشور...' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'صورة مرفقة', example: 'http://example.com/image.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'فيديو مرفق', example: 'http://example.com/video.mp4' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'هل هذا المنشور عبارة عن استطلاع؟', example: false })
  @IsOptional()
  @IsBoolean()
  isPoll?: boolean;

  @ApiPropertyOptional({ description: 'خيارات الاستطلاع (في حال كان isPoll = true)', example: ['خيار 1', 'خيار 2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  pollOptions?: string[];

  @ApiPropertyOptional({ description: 'السماح بالتعليقات على المنشور', example: true })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;
}
