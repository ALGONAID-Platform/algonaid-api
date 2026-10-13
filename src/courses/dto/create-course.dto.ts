import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CourseType } from "@prisma/client";
import { Type } from "class-transformer";

export class CreateCourseDto {
    @ApiProperty({ example: 'NestJS for Beginners' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'Learn how to build scalable APIs with NestJS', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'https://example.com/thumbnail.jpg', required: false })
    @IsOptional()
    @IsString()
    thumbnail?: string;

    @ApiProperty({ example: false, description: 'Whether the course is paid', required: false, default: false })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isPaid?: boolean;

    @ApiProperty({ example: 49.99, description: 'Original price of the course', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    price?: number;

    @ApiProperty({ example: 29.99, description: 'Discounted price if on offer', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    discountedPrice?: number;

    @ApiProperty({ example: 'RECORDED', enum: CourseType, description: 'Course delivery type (RECORDED or LIVE)', required: false, default: CourseType.RECORDED })
    @IsOptional()
    @IsEnum(CourseType)
    courseType?: CourseType;

    @ApiProperty({ example: 'السبت والإثنين 8:00 مساءً', description: 'Schedule days and time for live courses', required: false })
    @IsOptional()
    @IsString()
    scheduleDaysText?: string;
}


 