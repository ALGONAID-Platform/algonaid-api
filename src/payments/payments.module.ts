import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from 'src/auth/auth.module';
import { ExternalPaymentApiKeyGuard } from './guards/external-payment-api-key.guard';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ExternalPaymentApiKeyGuard],
  exports: [PaymentsService, ExternalPaymentApiKeyGuard],
})
export class PaymentsModule {}
