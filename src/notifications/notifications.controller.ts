import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AuthRollGuard } from '../auth/guards/auth-roll.guard';
import { userRoles } from '../auth/decorators/user_roll.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import * as types from '../utils/types';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('broadcast-my-students')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  @ApiOperation({
    summary: 'إرسال إشعار عام لجميع الطلاب المشتركين في الكورسات الخاصة بالمعلم (بدون ربطه بدرس أو اختبار)',
  })
  @ApiResponse({
    status: 201,
    description: 'تم إرسال الإشعار بنجاح إلى جميع الطلاب',
  })
  async broadcastToMyStudents(
    @CurrentUser() user: types.JwtPayloadType,
    @Body() dto: BroadcastNotificationDto,
  ) {
    return this.notificationsService.notifyEnrolledStudentsOfMyCourses(
      user.id,
      dto.message,
      dto.courseId,
    );
  }
}
