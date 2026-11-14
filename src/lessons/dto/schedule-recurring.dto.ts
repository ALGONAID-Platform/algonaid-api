import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleRecurringDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'معرف الكورس (اختياري إذا تم تمريره في رابط الـ URL)',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  courseId?: number;

  @ApiProperty({
    example: '2026-11-21',
    description: 'تاريخ البدء أو تاريخ الأسبوع الأول (YYYY-MM-DD أو صيغة ISO)',
  })
  @IsNotEmpty({ message: 'تاريخ البدء مطلوب' })
  @IsString()
  startDate: string;

  @ApiProperty({
    example: [6, 0, 1],
    description:
      'أيام التدريس في الأسبوع (0 للأحد، 1 للاثنين، 2 للثلاثاء، 3 للأربعاء، 4 للخميس، 5 للجمعة، 6 للسبت) أو أسماء الأيام',
    type: [Object],
  })
  @IsArray()
  @IsNotEmpty({ message: 'يجب اختيار يوم واحد على الأقل في الأسبوع' })
  daysOfWeek: (number | string)[];

  @ApiProperty({
    example: '18:00',
    description: 'توقيت بدء الدرس (HH:mm بصيغة 24 ساعة، مثل 18:00 أو 20:30)',
  })
  @IsNotEmpty({ message: 'توقيت الدرس مطلوب' })
  @IsString()
  time: string;

  @ApiPropertyOptional({
    example: 60,
    description: 'مدة الدرس بالدقائق (اختياري)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMinutes?: number;

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 5],
    description:
      'معرفات دروس محددة لجدولتها بالترتيب (اختياري، إذا لم تُرسل سيتم جدولة جميع دروس الكورس مرتبة بحسب order)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  lessonIds?: number[];

  @ApiPropertyOptional({
    example: true,
    description: 'تحديث رقم اليوم dayNumber تسلسلياً (1، 2، 3...) لكل درس مجدول',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  updateDayNumber?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description: 'رقم اليوم للبدء منه في الترقيم التسلسلي (افتراضياً 1 أو رقم الدرس الأول)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  startDayNumber?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'تكرار كل عدد من الأسابيع (افتراضياً 1 أي كل أسبوع)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  intervalWeeks?: number;

  @ApiPropertyOptional({
    example: -180,
    description: 'فرق المنطقة الزمنية بالدقائق عن UTC (مثل -180 لتوقيت السعودية/اليمن UTC+3)',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  timezoneOffset?: number;
}
