import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBackupDto {
  @ApiPropertyOptional({
    description: 'صيغة النسخة الاحتياطية (json أو sql)',
    enum: ['json', 'sql'],
    default: 'json',
    example: 'json',
  })
  @IsOptional()
  @IsIn(['json', 'sql'])
  format?: 'json' | 'sql';

  @ApiPropertyOptional({
    description: 'ملاحظة أو وصف توضيحي للنسخة الاحتياطية',
    example: 'نسخة احتياطية قبل تحديث الكورسات',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
