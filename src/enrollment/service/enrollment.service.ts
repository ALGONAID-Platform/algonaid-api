import { Injectable } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EnrollmentService {
    constructor(private readonly prisma: PrismaService
    ) {

    }

    async craete(studentId: number, enrollmentDto: CreateEnrollmentDto) {
        const { courseId } = enrollmentDto;
        await this.prisma.enrollment.create({
            data: {
                courseId,
                studentId
            }

        })
        return {
            message : " successfuly enrollment  "
        }

    }
}
