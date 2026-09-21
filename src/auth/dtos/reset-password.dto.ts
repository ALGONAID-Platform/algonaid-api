import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { MESSAGES } from 'src/utils/messages';

export class ResetPasswordDto {
  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: MESSAGES.VALIDATION.PASSWORD_REQUIRED })
  @IsString({ message: MESSAGES.VALIDATION.PASSWORD_STRING })
  @MinLength(8, { message: MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
    message: MESSAGES.VALIDATION.PASSWORD_COMPLEXITY,
  })
  newPassword: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  token: string;
}
