import { IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
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

    @ApiProperty({ example: '2026-11-01T00:00:00.000Z', description: 'Course start date', required: false })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    startDate?: Date;

    @ApiProperty({ example: '2026-12-30T23:59:59.000Z', description: 'Course end date', required: false })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    endDate?: Date;

    @ApiProperty({ example: 8, description: 'Duration in weeks', required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    durationWeeks?: number;

    @ApiProperty({ example: ['الأحد 8:00م', 'الثلاثاء 8:00م'], description: 'Scheduled days of the week', required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    scheduleDays?: string[];

    @ApiProperty({ example: ['إتقان أساسيات فلاتر', 'بناء متجر إلكتروني متكامل'], description: 'Course learning objectives', required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    objectives?: string[];

    @ApiProperty({ example: 70, description: 'Minimum GPA percentage required for certificate (0-100)', required: false, default: 70 })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    @Type(() => Number)
    certificateMinScore?: number;

    @ApiProperty({ example: 80, description: 'Minimum attendance percentage required for certificate (0-100)', required: false, default: 80 })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    @Type(() => Number)
    certificateMinAttendance?: number;
}


 