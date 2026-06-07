import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { MESSAGES } from 'src/utils/messages';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty({ message: MESSAGES.VALIDATION.EMAIL_REQUIRED })
  @IsEmail({}, { message: MESSAGES.VALIDATION.EMAIL_INVALID })
  email: string;
}
