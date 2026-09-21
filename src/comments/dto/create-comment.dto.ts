import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsInt()
  @IsNotEmpty()
  lessonId: number;

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
 