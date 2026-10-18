import { PartialType } from '@nestjs/swagger';
import { CreatePaymentAccountDto } from './create-payment-account.dto';

export class UpdatePaymentAccountDto extends PartialType(CreatePaymentAccountDto) {}
