import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EnrollmentService {
    constructor(private readonly prisma: PrismaService) { }

    async craete(userId: number, enrollmentDto: CreateEnrollmentDto) {
        const { courseId } = enrollmentDto;

        const student = await this.prisma.student.findUnique({
            where: { userId }
        });
        const course = await this.prisma.course.findUnique({
            where: { id: courseId }
        });

        if (!course) {
            throw new NotFoundException('Course not found');
        }
        if (!student) {
            throw new NotFoundException('Student profile not found');
        }

        await this.prisma.enrollment.create({
            data: {
                courseId,
                studentId: student.id
            }
        });

        return {
            message: "successfully enrolled in course"
        };
    }
}
