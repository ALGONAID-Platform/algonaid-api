import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRegisterDto } from '../dtos/user-register.dto';
import { AuthService } from '../services/auth.services';
import { UserLoginDto } from '../dtos/user-login.dto';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { GoogleMobileLoginDto } from '../dtos/google-mobile-login.dto';
import { ResendVerificationDto } from '../dtos/resend-verification.dto';
import {
  SwaggerGoogleAuth,
  SwaggerGoogleCallback,
  SwaggerGoogleMobileAuth,
  SwaggerLogin,
  SwaggerRegister,
} from '../decorators/swagger.decorators';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== Signup ====================
  @SwaggerRegister()
  @Post('signup')
  async register(@Body() userDto: UserRegisterDto) {
    return await this.authService.register(userDto);
  }

  // ==================== Signin ====================
  @HttpCode(HttpStatus.OK)
  @Post('signin')
  @SwaggerLogin()
  async signin(@Body() userDto: UserLoginDto) {
    return await this.authService.login(userDto);
  }

  // ==================== Forgot Password ====================
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset token' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  // ==================== Reset Password ====================
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }

  // ==================== Verify Email ====================
  /**
   * GET /auth/verify-email?token=TOKEN
   *
   * يُستدعى عند ضغط المستخدم على رابط التحقق من البريد الإلكتروني.
   *
   * Flow:
   * 1. المستخدم يضغط الرابط في بريده
   * 2. نظام Android App Links / iOS Universal Links يفتح التطبيق مباشرةً
   * 3. إذا لم يكن التطبيق مثبتاً يذهب للمتصفح
   * 4. Flutter يستقبل الـ token ويرسله لهذا endpoint
   */
  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email address using token from email link',
    description:
      'Called by Flutter app via Deep Link or directly from browser. Validates the token and marks the email as verified.',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'The verification token sent via email',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      example: {
        message: 'تم تأكيد بريدك الإلكتروني بنجاح! يمكنك الآن تسجيل الدخول.',
        verified: true,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
  })
  async verifyEmail(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const result = await this.authService.verifyEmail(token);

    // إذا كان الطلب يأتي من متصفح (مستخدم ليس لديه التطبيق)
    // نعيد JSON فقط — Flutter سيتعامل مع هذا
    return result;
  }

  // ==================== Resend Verification Email ====================
  /**
   * POST /auth/resend-verification
   * يعيد إرسال بريد التحقق
   */
  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully',
  })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return await this.authService.resendVerificationEmail(dto);
  }

  // ==================== Google Auth ====================
  @Get('google')
  @SwaggerGoogleAuth()
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Redirection handled by Google Strategy
  }

  @Get('google/callback')
  @SwaggerGoogleCallback()
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any) {
    return this.authService.validateGoogleUser(req.user);
  }

  @Post('google/mobile')
  @SwaggerGoogleMobileAuth()
  async googleMobileAuth(@Body() googleMobileLoginDto: GoogleMobileLoginDto) {
    return await this.authService.loginWithGoogleMobile(
      googleMobileLoginDto.idToken,
    );
  }

  // ==================== Get Current User ====================
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user data by ID' })
  async getCurrentUser(@Param('id', ParseIntPipe) id: number) {
    return await this.authService.getCurrentUser(id);
  }

  // ==================== Logout ====================
  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user and invalidate token' })
  async logout(@Req() req: any) {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (token && type === 'Bearer') {
      return await this.authService.logout(token);
    }
    return { message: 'Already logged out' };
  }
}