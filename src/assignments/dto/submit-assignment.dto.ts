import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SubmitAssignmentDto {
  @ApiPropertyOptional({
    description: 'نص الحل أو الإجابة أو رابط خارجي (GitHub / Drive / Figma / Code)',
    example: 'تم حل المسألة ورفع الكود على المستودع: https://github.com/student/solution',
  })
  @IsOptional()
  @IsString({ message: 'محتوى الإجابة يجب أن يكون نصاً' })
  content?: string;

  @ApiPropertyOptional({
    description: 'رابط الملف المرفوع إذا تم رفعه مسبقاً عبر خدمة الوسائط',
    example: 'https://ucarecdn.com/.../solution.pdf',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;
}

