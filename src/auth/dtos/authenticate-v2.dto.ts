import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MESSAGES } from '../../utils/messages';

export class AuthenticateV2Dto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsNotEmpty({ message: MESSAGES.VALIDATION.EMAIL_REQUIRED })
  @IsEmail({}, { message: MESSAGES.VALIDATION.EMAIL_INVALID })
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsNotEmpty({ message: MESSAGES.VALIDATION.PASSWORD_REQUIRED })
  @IsString()
  @MinLength(6, { message: MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH })
  @MaxLength(30)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
    message: MESSAGES.VALIDATION.PASSWORD_COMPLEXITY,
  })
  password: string;

  @ApiPropertyOptional({ example: 'John Doe', description: 'User name (required for registration)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
