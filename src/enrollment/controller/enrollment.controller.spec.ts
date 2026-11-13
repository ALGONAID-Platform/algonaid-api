import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from '../service/enrollment.service';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';

describe('EnrollmentController', () => {
  let controller: EnrollmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentController],
      providers: [
        { provide: EnrollmentService, useValue: {} },
      ],
    })
      .overrideGuard(AuthRollGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EnrollmentController>(EnrollmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
