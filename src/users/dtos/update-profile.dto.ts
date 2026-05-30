import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  background?: string;

  // Student specific details
  @IsOptional()
  @IsString()
  grade?: string;
 
  @IsOptional()
  @IsDateString()
  birthDate?: string | Date;

  @IsOptional()
  @IsString()
  address?: string;
}
