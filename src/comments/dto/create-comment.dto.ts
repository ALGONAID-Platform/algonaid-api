import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsInt()
  @IsOptional()
  lessonId?: number;

  @IsInt()
  @IsOptional()
  examId?: number;

  @IsInt()
  @IsOptional()
  parentId?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  mentionedUserIds?: number[];

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
 