import { Test, TestingModule } from '@nestjs/testing';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
import { Role } from '@prisma/client';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';

describe('GradesController', () => {
  let controller: GradesController;
  let service: GradesService;

  const mockGradesService = {
    getStudentCourseGrades: jest.fn(),
    getCourseGradesOverview: jest.fn(),
    saveBulkGrades: jest.fn(),
    updateSingleGrade: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradesController],
      providers: [
        {
          provide: GradesService,
          useValue: mockGradesService,
        },
      ],
    })
      .overrideGuard(AuthRollGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GradesController>(GradesController);
    service = module.get<GradesService>(GradesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getStudentCourseGrades', async () => {
    const mockUser: any = { id: 1, role: Role.ADMIN };
    mockGradesService.getStudentCourseGrades.mockResolvedValue({ studentId: 5 });

    const result = await controller.getStudentCourseGrades(10, 5, mockUser);
    expect(mockGradesService.getStudentCourseGrades).toHaveBeenCalledWith(
      10,
      5,
      1,
      Role.ADMIN,
    );
    expect(result).toEqual({ studentId: 5 });
  });

  it('should call getCourseGradesOverview', async () => {
    const mockUser: any = { id: 1, role: Role.ADMIN };
    mockGradesService.getCourseGradesOverview.mockResolvedValue({ courseId: 10 });

    const result = await controller.getCourseGradesOverview(10, mockUser);
    expect(mockGradesService.getCourseGradesOverview).toHaveBeenCalledWith(
      10,
      1,
      Role.ADMIN,
    );
    expect(result).toEqual({ courseId: 10 });
  });

  it('should call saveBulkGrades', async () => {
    const mockUser: any = { id: 1, role: Role.ADMIN };
    const dto = { grades: [{ studentId: 5, assessmentId: 1, score: 10 }] };
    mockGradesService.saveBulkGrades.mockResolvedValue({ savedCount: 1 });

    const result = await controller.saveBulkGrades(10, dto, mockUser);
    expect(mockGradesService.saveBulkGrades).toHaveBeenCalledWith(
      10,
      1,
      Role.ADMIN,
      dto,
    );
    expect(result).toEqual({ savedCount: 1 });
  });
});
