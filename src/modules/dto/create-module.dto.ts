import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'Module 1: Introduction' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'Basic introduction to the course', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsInt()
  courseId: number;
}
