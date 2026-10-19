import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ExternalPaymentApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ExternalPaymentApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // جلب المفتاح السري المشترك من متغيرات البيئة (مع مفتاح افتراضي قوي كاحتياطي)
    const configuredSecret =
      this.configService.get<string>('EXTERNAL_PAYMENT_SECRET') ||
      this.configService.get<string>('KARTI_API_KEY') ||
      'algonaid_karti_secret_key_2026';

    // استخراج المفتاح من الـ Headers المدعومة (x-api-key أو x-karti-secret أو Bearer token)
    const authHeader = request.headers['authorization'];
    let bearerToken = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    const providedKey = (
      request.headers['x-api-key'] ||
      request.headers['x-karti-secret'] ||
      bearerToken
    ) as string | undefined;

    if (!providedKey || providedKey.trim() !== configuredSecret) {
      this.logger.warn(
        `Blocked unauthorized external payment request from IP: ${request.ip} for path: ${request.path}`,
      );
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'غير مصرح بالوصول: مفتاح الربط السري (x-api-key) مطلوب وغير صالح.',
        error: 'INVALID_API_KEY',
      });
    }

    return true;
  }
}

