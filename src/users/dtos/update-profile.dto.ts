import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ description: 'User display name', example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Avatar URL', example: 'https://example.com/avatar.png', required: false })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ description: 'Avatar URL alias from frontend', required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ description: 'Background image URL', example: 'https://example.com/bg.png', required: false })
  @IsOptional()
  @IsString()
  background?: string;

  // Student specific details
  @ApiProperty({ description: 'Academic grade', example: '10th Grade', required: false })
  @IsOptional()
  @IsString()
  grade?: string;
 
  @ApiProperty({ description: 'Birth date', example: '2005-01-01', required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string | Date;

  @ApiProperty({ description: 'Physical address', example: 'Cairo, Egypt', required: false })
  @IsOptional()
  @IsString()
  address?: string;
}
