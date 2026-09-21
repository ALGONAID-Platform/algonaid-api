import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleMobileLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFl...',
    description: 'رمز التعريف (ID Token) المستلم من جوجل بعد تسجيل الدخول بنجاح على الموبايل',
  })
  @IsNotEmpty({ message: 'رمز التعريف (ID Token) مطلوب' })
  @IsString({ message: 'يجب أن يكون رمز التعريف نصاً' })
  idToken: string;
}