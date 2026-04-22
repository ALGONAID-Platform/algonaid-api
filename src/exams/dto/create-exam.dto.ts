import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsArray, ValidateNested, IsBoolean, IsEnum, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { QuestionType } from 'src/prisma/client/enums';

export class CreateOptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ enum: QuestionType, default: QuestionType.MULTIPLE_CHOICE })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  points: number;

  @ApiProperty({ type: [CreateOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  @ArrayMinSize(2, { message: 'Question must have at least 2 options' })
  options: CreateOptionDto[];
}

export class CreateExamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ default: 50 })
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore: number;

  @ApiProperty({ default: 3 })
  @IsInt()
  @Min(1)
  maxAttempts: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  lessonId: number;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}
