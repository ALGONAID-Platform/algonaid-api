import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class ConfirmExternalPaymentDto {
  @ApiProperty({
    example: 'STU-1729241-12',
    description: 'معرّف الطالب (يقبل الرقم الأكاديمي، أو البريد الإلكتروني، أو userId)',
  })
  @IsString({ message: 'معرّف المستخدم يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'معرّف المستخدم مطلوب' })
  userIdentifier: string;

  @ApiProperty({ example: 5, description: 'معرّف الكورس المراد سداد رسومه' })
  @Type(() => Number)
  @IsInt({ message: 'معرّف الكورس يجب أن يكون رقماً صحيحاً' })
  @IsPositive({ message: 'معرّف الكورس يجب أن يكون موجباً' })
  @IsNotEmpty({ message: 'معرّف الكورس مطلوب' })
  courseId: number;

  @ApiProperty({ example: 35000, description: 'المبلغ المدفوع' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'المبلغ يجب أن يكون أكبر من صفر' })
  @IsNotEmpty({ message: 'المبلغ مطلوب' })
  amount: number;

  @ApiProperty({
    enum: Currency,
    default: Currency.YER_OLD,
    description: 'نوع العملة: YER_OLD (قديم), YER_NEW (جديد), SAR (سعودي), USD (دولار)',
    required: false,
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'نوع العملة غير صالح' })
  currency?: Currency = Currency.YER_OLD;

  @ApiProperty({
    example: 'KARTI-9823145',
    description: 'رقم العملية الصادر من تطبيق كرتي أو بوابة الدفع',
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionNumber?: string;

  @ApiProperty({
    example: 'سداد إلكتروني مباشر عبر تطبيق كرتي',
    description: 'ملاحظات إضافية عن العملية',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
