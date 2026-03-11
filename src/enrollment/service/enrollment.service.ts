import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MESSAGES } from 'src/utils/messages';

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
            throw new NotFoundException(MESSAGES.COURSES.COURSE_NOT_FOUND_DEFAULT);
        }
        if (!student) {
            throw new NotFoundException(MESSAGES.ENROLLMENT.STUDENT_PROFILE_NOT_FOUND);
        }

        await this.prisma.enrollment.create({
            data: {
                courseId,
                studentId: student.id
            }
        });

        return {
            message: MESSAGES.ENROLLMENT.ENROLLED_SUCCESSFULLY
        };
    }
}
