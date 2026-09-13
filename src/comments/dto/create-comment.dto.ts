import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

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
}
 