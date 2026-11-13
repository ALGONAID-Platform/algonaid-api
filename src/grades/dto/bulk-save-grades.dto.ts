import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GradeEntryDto {
  @ApiProperty({ description: 'ID of the student' })
  @IsNumber()
  studentId: number;

  @ApiPropertyOptional({ description: 'ID of the assessment/assignment' })
  @IsOptional()
  @IsNumber()
  assessmentId?: number;

  @ApiPropertyOptional({ description: 'ID of the assignment (alias for assessmentId)' })
  @IsOptional()
  @IsNumber()
  assignmentId?: number;

  @ApiProperty({ description: 'Score obtained by the student' })
  @IsNumber()
  @Min(0)
  score: number;

  @ApiPropertyOptional({ description: 'Teacher note or feedback' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkSaveGradesDto {
  @ApiProperty({ type: [GradeEntryDto], description: 'Array of grade entries' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeEntryDto)
  grades: GradeEntryDto[];
}

export class UpdateSingleGradeDto {
  @ApiProperty({ description: 'Score obtained by the student' })
  @IsNumber()
  @Min(0)
  score: number;

  @ApiPropertyOptional({ description: 'Teacher note or feedback' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Teacher feedback' })
  @IsOptional()
  @IsString()
  feedback?: string;
}
