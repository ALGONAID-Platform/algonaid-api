import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPaymentDto {
  @ApiProperty({ example: 'سند التحويل غير واضح، يرجى إعادة رفع السند بوضوح', description: 'Rejection reason' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
