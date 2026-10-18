import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedApiKey =
      request.headers['x-api-key'] ||
      request.headers['X-API-KEY'] ||
      request.headers['x-service-key'] ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '');

    const configuredApiKey =
      this.configService.get<string>('PAYMENT_SERVICE_API_KEY') ||
      'algonaid_payment_sec_key_2026';

    if (!providedApiKey || providedApiKey !== configuredApiKey) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'غير مصرح: مفتاح الـ API الخاص ببوابة الدفع مفقود أو غير صالح (X-API-KEY مطلوب)',
        error: 'Unauthorized',
      });
    }

    return true;
  }
}
