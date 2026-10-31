import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RestoreBackupDto {
  @ApiPropertyOptional({
    description: 'اسم ملف النسخة الاحتياطية الموجود على السيرفر (إذا لم يتم رفع ملف في الطلب)',
    example: 'backup-2026-10-31T22-30-00-000Z.json',
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({
    description: 'تأكيد كلمة مرور حساب المالك (Owner Password) لضمان الأمان وتفادي الاسترجاع غير المقصود',
    example: 'mySecretPassword123',
  })
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
