import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class SubmitPaymentDto {
  @ApiProperty({ example: 1, description: 'ID of the course being paid for' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  courseId: number;

  @ApiProperty({ example: 49.99, description: 'Amount paid in the receipt' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'https://storage.googleapis.com/.../receipt.jpg', description: 'URL of the payment receipt' })
  @IsString()
  @IsNotEmpty()
  receiptUrl: string;

  @ApiProperty({ example: 'Payment via Bank transfer reference #123456', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
