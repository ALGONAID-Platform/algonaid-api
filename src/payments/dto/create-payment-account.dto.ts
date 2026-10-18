import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class CreatePaymentAccountDto {
  @ApiProperty({
    description: 'اسم الخدمة أو البنك أو شركة الصرافة',
    example: 'بنك الكريمي للتمويل الأصغر الإسلامي',
  })
  @IsString({ message: 'اسم المزود يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم المزود مطلوب' })
  providerTitle: string;

  @ApiProperty({
    description: 'اسم صاحب الحساب أو المستفيد المعتمد',
    example: 'بشار أحمد الجنيد',
  })
  @IsString({ message: 'اسم صاحب الحساب يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم صاحب الحساب مطلوب' })
  accountHolder: string;

  @ApiProperty({
    description: 'رقم الحساب البنكي أو رقم المحفظة أو رقم الهاتف للتحويل',
    example: '12345678',
  })
  @IsString({ message: 'رقم الحساب يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رقم الحساب مطلوب' })
  accountNumber: string;

  @ApiPropertyOptional({
    enum: Currency,
    description: 'العملة المخصصة لهذا الحساب (اتركه فارغاً إذا كان يدعم جميع العملات)',
    example: Currency.YER_OLD,
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'نوع العملة غير صالح' })
  currency?: Currency;

  @ApiPropertyOptional({
    description: 'تعليمات أو ملاحظات خاصة بالتحويل للمشتركين',
    example: 'يرجى كتابة اسم الطالب ورقم الهاتف في خانة الغرض من الحوالة.',
  })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'رابط صورة رمز الاستجابة السريع (QR Code) للمحفظة أو الحساب',
    example: 'https://ucarecdn.com/.../kuraimi-qr.png',
  })
  @IsOptional()
  @IsString()
  qrCodeUrl?: string;

  @ApiPropertyOptional({
    description: 'حالة الحساب (نشط ومتاح للطلاب أم معطل مؤقتاً)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean = true;

  @ApiPropertyOptional({
    description: 'ترتيب ظهور الحساب في قائمة طرق الدفع (الأصغر يظهر أولاً)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number = 0;
}
