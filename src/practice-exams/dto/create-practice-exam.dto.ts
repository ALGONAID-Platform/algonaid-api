import { IsNotEmpty, IsOptional, IsString, IsInt } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreatePracticeExamDto {
    @ApiProperty({ example: 'Midterm Practice Exam 2026' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'Review questions and practice exercises for midterm preparation', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'https://example.com/exams/midterm-review.pdf', required: false })
    @IsOptional()
    @IsString()
    pdfUrl?: string;

    @ApiProperty({ example: 'Grade 10', required: false })
    @IsOptional()
    @IsString()
    grade?: string;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    courseId?: number;
}
