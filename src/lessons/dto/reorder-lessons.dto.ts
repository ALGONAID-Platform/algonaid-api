import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderLessonsDto {
  @ApiProperty({
    example: [3, 1, 4, 2],
    description: 'قائمة معرفات الدروس بالترتيب المطلوب (من الأول إلى الأخير)',
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  lessonIds: number[];
}
