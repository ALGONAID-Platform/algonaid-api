import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Currency } from '@prisma/client';

export class SubmitPaymentDto {
  @ApiProperty({ example: 1, description: 'ID of the course being paid for' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  courseId: number;

  @ApiProperty({ example: 49.99, description: 'المبلغ المدفوع بالسند حسب العملة المختارة' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    enum: Currency,
    default: Currency.YER_OLD,
    description: 'نوع العملة المدفوعة: YER_OLD (عملة قديمة), YER_NEW (عملة جديدة), SAR (سعودي), USD (دولار)',
    required: false,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency = Currency.YER_OLD;

  @ApiProperty({
    example: 1,
    description: 'معرّف الحساب البنكي / المحفظة التي تم التحويل إليها من قائمة الحسابات',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  paymentAccountId?: number;

  @ApiProperty({
    example: 'TRX-9823145',
    description: 'رقم الحوالة أو رقم عملية الإيداع الموضح في السند',
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionNumber?: string;

  @ApiProperty({ example: 'https://storage.googleapis.com/.../receipt.jpg', description: 'URL of the payment receipt' })
  @IsString()
  @IsNotEmpty()
  receiptUrl: string;

  @ApiProperty({ example: 'تم التحويل عبر تطبيق الكريمي جوال', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
