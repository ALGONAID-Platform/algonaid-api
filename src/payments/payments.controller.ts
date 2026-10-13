import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { PaymentStatus, Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import * as types from 'src/utils/types';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'Submit a payment receipt for a paid course' })
  @ApiResponse({ status: 201, description: 'Payment receipt submitted successfully.' })
  @Post('submit')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  submitPayment(
    @CurrentUser() user: types.JwtPayloadType,
    @Body() dto: SubmitPaymentDto,
  ) {
    return this.paymentsService.submitPayment(user.id, dto);
  }

  @ApiOperation({ summary: 'Get payment receipts submitted by the current user' })
  @Get('my')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  getMyPayments(@CurrentUser() user: types.JwtPayloadType) {
    return this.paymentsService.getMyPaymentRequests(user.id);
  }

  @ApiOperation({ summary: 'Get latest payment status for a specific course' })
  @Get('status/:courseId')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.STUDENT, Role.ADMIN, Role.OWNER)
  getCoursePaymentStatus(
    @CurrentUser() user: types.JwtPayloadType,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.paymentsService.getCoursePaymentStatus(user.id, courseId);
  }

  @ApiOperation({ summary: 'Admin/Owner: Get list of pending payments' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('pending')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  getPendingPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.paymentsService.getPendingPayments(page, limit);
  }

  @ApiOperation({ summary: 'Admin/Owner: Get all payments with optional status filter' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  getAllPayments(
    @Query('status') status?: PaymentStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.paymentsService.getAllPayments(status, page, limit);
  }

  @ApiOperation({ summary: 'Admin/Owner: Approve payment and activate course enrollment' })
  @Patch(':id/approve')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  approvePayment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
  ) {
    return this.paymentsService.approvePayment(id, user.id);
  }

  @ApiOperation({ summary: 'Admin/Owner: Reject payment receipt' })
  @Patch(':id/reject')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  rejectPayment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: types.JwtPayloadType,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.paymentsService.rejectPayment(id, user.id, dto);
  }
}
