import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class VerifyCheckoutDto {
  @ApiProperty({
    description: 'معرّف المستخدم (يقبل البريد الإلكتروني أو الرقم الأكاديمي STU-xxx أو userId)',
    example: 'student@example.com',
  })
  @IsString({ message: 'معرّف المستخدم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'معرّف المستخدم مطلوب للتحقق' })
  userIdentifier: string;

  @ApiProperty({
    description: 'معرّف الكورس المراد سداد رسومه',
    example: 5,
  })
  @Type(() => Number)
  @IsInt({ message: 'معرّف الكورس يجب أن يكون رقماً صحيحاً' })
  @IsPositive({ message: 'معرّف الكورس يجب أن يكون موجباً' })
  @IsNotEmpty({ message: 'معرّف الكورس مطلوب' })
  courseId: number;

  @ApiPropertyOptional({
    enum: Currency,
    description: 'العملة المراد التحقق من تسعيرها (اختياري، إن لم ترسل ترجع جميع العملات)',
    example: Currency.YER_OLD,
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'نوع العملة غير صالح' })
  currency?: Currency;
}
