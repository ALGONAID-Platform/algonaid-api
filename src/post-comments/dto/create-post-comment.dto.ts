import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePostCommentDto {
  @ApiProperty({ description: 'نص التعليق' })
  @IsNotEmpty()
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'صورة مرفقة' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'رقم التعليق الأب في حالة الرد' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @ApiPropertyOptional({ description: 'معرفات المستخدمين المشار إليهم', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  mentionedUserIds?: number[];
}

