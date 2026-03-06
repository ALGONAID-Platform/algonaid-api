import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { CreateEnrollmentDto } from '../dto/enrollment.dto';
import { EnrollmentService } from '../service/enrollment.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayloadType } from 'src/utils/types';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { UserRole } from 'src/auth/enums/userRole';
import { Role } from 'src/prisma/client/enums';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';

@Controller('enrollment')
export class EnrollmentController {

  constructor(
    private readonly enrollmentSevice: EnrollmentService
  ) {
  }

  @Post()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT)
  enroll(@Body() createDto: CreateEnrollmentDto, @CurrentUser() user: JwtPayloadType) {
    return this.enrollmentSevice.craete(user.id, createDto);
  }

}
