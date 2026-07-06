import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { MESSAGES } from 'src/utils/messages';

export class ResendVerificationDto {
  @ApiProperty({
    description: 'البريد الإلكتروني للمستخدم',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: MESSAGES.VALIDATION.EMAIL_INVALID })
  @IsNotEmpty({ message: MESSAGES.VALIDATION.EMAIL_REQUIRED })
  email: string;
}
