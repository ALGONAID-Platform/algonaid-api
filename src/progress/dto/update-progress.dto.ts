import { IsBoolean, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProgressDto {
  @ApiProperty({ description: 'ID of the lesson' })
  @IsNumber()
  @IsNotEmpty()
  lessonId: number;

  @ApiProperty({ description: 'Completion status', default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;
}
 