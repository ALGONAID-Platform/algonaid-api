import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class VerifyUserDto {
  @ApiPropertyOptional({ description: 'معرّف المستخدم (ID)', example: 42 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: 'البريد الإلكتروني للمستخدم', example: 'student@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'حالة التوثيق (افتراضياً true)', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}
