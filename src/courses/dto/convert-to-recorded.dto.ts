import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class ConvertToRecordedDto {
  @ApiProperty({ example: 49.99, description: 'New base price for the recorded course', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiProperty({ example: 19.99, description: 'Discounted price for the recorded course', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountedPrice?: number;
}
