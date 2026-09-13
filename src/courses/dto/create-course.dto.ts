import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCourseDto {
    @ApiProperty({ example: 'NestJS for Beginners' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'Learn how to build scalable APIs with NestJS' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'https://example.com/thumbnail.jpg' })
    @IsOptional()
    @IsString()
    thumbnail?: string;

    // @ApiProperty({ example: true, description: 'Marks the course as completed' })
    // @IsOptional()
    // @IsBoolean()
    // isCompleted?: boolean;
}

 