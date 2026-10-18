import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import { VerifyCheckoutDto } from './dto/verify-checkout.dto';
import { PaymentApiKeyGuard } from './guards/payment-api-key.guard';
import { AuthRollGuard } from 'src/auth/guards/auth-roll.guard';
import { VerifiedOnlyGuard } from 'src/auth/guards/verified-only.guard';
import { userRoles } from 'src/auth/decorators/user_roll.decorator';
import { Currency, PaymentStatus, Role } from '@prisma/client';
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
  @UseGuards(AuthRollGuard, VerifiedOnlyGuard)
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

  // ==========================================
  // PAYMENT ACCOUNTS (BANKS / WALLETS)
  // ==========================================

  @ApiOperation({ summary: 'جلب حسابات ومحافظ الاستقبال النشطة (للطلاب وللتطبيق عند الاشتراك)' })
  @ApiQuery({ name: 'currency', enum: Currency, required: false, description: 'فلترة الحسابات حسب نوع العملة' })
  @Get('accounts')
  @SkipThrottle()
  getActiveAccounts(@Query('currency') currency?: Currency) {
    return this.paymentsService.getActivePaymentAccounts(currency);
  }

  @ApiOperation({ summary: 'Admin/Owner: جلب كافة حسابات ومحافظ الاستقبال (بما فيها المعطلة) للإدارة' })
  @Get('accounts/all')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  getAllAccounts() {
    return this.paymentsService.getAllPaymentAccounts();
  }

  @ApiOperation({ summary: 'Admin/Owner: إضافة حساب استقبال بنكي أو محفظة جديدة' })
  @Post('accounts')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  createAccount(
    @Body() dto: CreatePaymentAccountDto,
  ) {
    return this.paymentsService.createPaymentAccount(dto);
  }

  @ApiOperation({ summary: 'Admin/Owner: تعديل بيانات حساب بنكي أو تفعيله/تعطيله' })
  @ApiParam({ name: 'id', description: 'معرّف الحساب البنكي' })
  @Patch('accounts/:id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentAccountDto,
  ) {
    return this.paymentsService.updatePaymentAccount(id, dto);
  }

  @ApiOperation({ summary: 'Admin/Owner: حذف حساب بنكي نهائياً أو تعطيله إذا كان مرتبطاً بحوالات' })
  @ApiParam({ name: 'id', description: 'معرّف الحساب البنكي' })
  @Delete('accounts/:id')
  @UseGuards(AuthRollGuard)
  @userRoles(Role.ADMIN, Role.OWNER)
  deleteAccount(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.paymentsService.deletePaymentAccount(id);
  }

  // ==========================================
  // EXTERNAL PAYMENT SERVICE CHECKOUT VERIFICATION
  // ==========================================

  @ApiOperation({
    summary: 'فحص الحساب والتحقق من المستخدم وصلاحيته للدفع من تطبيق خارجي (Server-to-Server)',
    description: 'يتطلب تمرير X-API-KEY في الـ Headers للأمان والتحقق من هوية التطبيق المستدعي',
  })
  @ApiHeader({
    name: 'X-API-KEY',
    description: 'مفتاح الـ API السري الخاص ببوابة وتطبيقات الدفع الخارجية المعتمدة',
    required: true,
  })
  @Post('external/verify-checkout')
  @SkipThrottle()
  @UseGuards(PaymentApiKeyGuard)
  verifyCheckout(@Body() dto: VerifyCheckoutDto) {
    return this.paymentsService.verifyCheckout(dto);
  }
}
