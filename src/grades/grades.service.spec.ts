import { Test, TestingModule } from '@nestjs/testing';
import { GradesService } from './grades.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role, SubmissionStatus } from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('GradesService', () => {
  let service: GradesService;
  let prisma: PrismaService;

  const mockPrisma = {
    course: {
      findUnique: jest.fn(),
    },
    teacher: {
      findUnique: jest.fn(),
    },
    student: {
      findFirst: jest.fn(),
    },
    enrollment: {
      findUnique: jest.fn(),
    },
    module: {
      findMany: jest.fn(),
    },
    exam: {
      findMany: jest.fn(),
    },
    assignment: {
      findUnique: jest.fn(),
    },
    assignmentSubmission: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GradesService>(GradesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStudentCourseGrades', () => {
    it('should throw NotFoundException if student is not found', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.getStudentCourseGrades(1, 999, 1, Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if student tries to view another student grades', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 5,
        userId: 10,
        academicId: 'STD-1',
        user: { id: 10, name: 'Student 1', email: 's@test.com' },
      });

      await expect(
        service.getStudentCourseGrades(1, 5, 20, Role.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return lessons table and totals correctly for enrolled student', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 5,
        userId: 10,
        academicId: 'STD-1',
        user: { id: 10, name: 'Student 1', email: 's@test.com' },
      });

      mockPrisma.course.findUnique.mockResolvedValue({
        id: 1,
        title: 'Network Fundamentals',
        instructorId: 2,
        teacher: { user: { name: 'Teacher 1' } },
      });

      mockPrisma.enrollment.findUnique.mockResolvedValue({
        studentId: 5,
        courseId: 1,
        status: 'ACTIVE',
        createdAt: new Date(),
      });

      mockPrisma.module.findMany.mockResolvedValue([
        {
          id: 1,
          title: 'Module 1',
          lessons: [
            {
              id: 101,
              title: 'Lesson 1',
              order: 1,
              dayNumber: 1,
              isMandatory: true,
              lessonProgress: [{ isCompleted: true, completedAt: new Date() }],
              assignment: {
                id: 201,
                title: 'Homework 1',
                type: 'TASK',
                maxScore: 10,
                submissions: [
                  {
                    id: 301,
                    status: SubmissionStatus.GRADED,
                    score: 9,
                    feedback: 'Great job',
                  },
                ],
              },
              exam: {
                id: 401,
                title: 'Quiz 1',
                passingScore: 50,
                questions: [{ points: 10 }],
                attempts: [
                  {
                    score: 8,
                    status: 'PASSED',
                    completedAt: new Date(),
                  },
                ],
              },
            },
          ],
        },
      ]);

      mockPrisma.exam.findMany.mockResolvedValue([]);

      const result = await service.getStudentCourseGrades(1, 5, 1, Role.ADMIN);

      expect(result).toBeDefined();
      expect(result.student.name).toBe('Student 1');
      expect(result.summary.attendance.totalLessons).toBe(1);
      expect(result.summary.attendance.attendedLessons).toBe(1);
      expect(result.summary.attendance.attendancePercentage).toBe(100);

      expect(result.summary.assignments.totalCount).toBe(1);
      expect(result.summary.assignments.totalEarnedScore).toBe(9);
      expect(result.summary.assignments.totalMaxScore).toBe(10);

      expect(result.summary.exams.totalCount).toBe(1);
      expect(result.summary.exams.totalEarnedPoints).toBe(8);
      expect(result.summary.exams.totalMaxPoints).toBe(10);

      expect(result.lessons.length).toBe(1);
      expect(result.lessons[0].attendance.isAttended).toBe(true);
      expect(result.lessons[0].assignment.score).toBe(9);
      expect(result.lessons[0].exam.score).toBe(8);
    });
  });

  describe('saveBulkGrades', () => {
    it('should throw BadRequestException if grades array is empty', async () => {
      await expect(
        service.saveBulkGrades(1, 1, Role.ADMIN, { grades: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate score bounds and update submission', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({ id: 5 });
      mockPrisma.enrollment.findUnique.mockResolvedValue({ status: 'ACTIVE' });
      mockPrisma.assignment.findUnique.mockResolvedValue({
        id: 201,
        maxScore: 10,
        lesson: { module: { courseId: 1 } },
      });

      // Score > maxScore
      await expect(
        service.saveBulkGrades(1, 1, Role.ADMIN, {
          grades: [{ studentId: 5, assessmentId: 201, score: 15 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
