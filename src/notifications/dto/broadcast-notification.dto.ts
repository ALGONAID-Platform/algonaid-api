import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class BroadcastNotificationDto {
  @ApiProperty({
    description: 'نص الإشعار أو التنبيه المراد إرساله لجميع الطلاب المشتركين',
    example: '📢 تنبيه هام لجميع طلاب كورساتنا: سيتم عقد لقاء مفتوح يوم الجمعة القادم!',
  })
  @IsString()
  @IsNotEmpty({ message: 'نص الإشعار مطلوب' })
  message: string;

  @ApiPropertyOptional({
    description: 'معرف الكورس (اختياري): حدده إذا أردت إرسال الإشعار لطلاب كورس معين فقط، أو اتركه فارغاً لإرسال الإشعار لجميع طلاب كافة الكورسات الخاصة بك',
    example: 5,
  })
  @IsInt()
  @IsOptional()
  courseId?: number;
}
