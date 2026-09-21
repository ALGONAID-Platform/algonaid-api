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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRegisterDto } from '../dtos/user-register.dto';
import { AuthService } from '../services/auth.services';
import { UserLoginDto } from '../dtos/user-login.dto';
import { AuthenticateV2Dto } from '../dtos/authenticate-v2.dto';
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
import { AuthGuard as JwtAuthGuard } from '../guards/auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtPayloadType } from 'src/utils/types';
import { ForbiddenException } from '@nestjs/common';
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

  // ==================== Authenticate V2 (Unified) ====================
  @Post('v2/authenticate')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute per IP
  @HttpCode(HttpStatus.OK)
  async authenticateV2(@Body() dto: AuthenticateV2Dto) {
    return await this.authService.authenticateV2(dto);
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

  // ==================== Validate Reset Token ====================
  @Get('validate-reset-token')
  @ApiOperation({ summary: 'Validate if reset token is still valid and not used' })
  async validateResetToken(@Query('token') token: string) {
    return await this.authService.validateResetToken(token);
  }

  @Get('reset-password')
  @ApiOperation({
    summary: 'Redirect to app for resetting password',
    description: 'Handles GET requests from browser when deep links fail to open the app',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'The reset password token',
  })
  resetPasswordRedirect(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    const safeToken = encodeURIComponent(token);
    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>استعادة كلمة المرور</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f9; }
          .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
          h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
          p { color: #666; margin-bottom: 30px; font-size: 16px; line-height: 1.5; }
          .btn { background: #4caf50; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block; transition: background 0.3s; }
          .btn:hover { background: #43a047; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>إعادة تعيين كلمة المرور</h1>
          <p>إذا لم يفتح التطبيق تلقائياً، يرجى الضغط على الزر أدناه لإكمال العملية داخل تطبيق منصة الجنيد.</p>
          <a href="intent://api.exchangesmangement.online/reset-password?token=${safeToken}#Intent;scheme=https;package=com.algonaid.app;end" class="btn">فتح في التطبيق</a>
        </div>
        <script>
          setTimeout(function() {
            window.location.href = "intent://api.exchangesmangement.online/reset-password?token=${safeToken}#Intent;scheme=https;package=com.algonaid.app;end";
          }, 500);
        </script>
      </body>
      </html>
    `;
    res.type('text/html').send(html);
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
    @Req() req: any,
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    try {
      const result = await this.authService.verifyEmail(token);

      const accept = req.headers.accept || '';
      if (accept.includes('text/html')) {
    const safeToken = encodeURIComponent(token);
        const html = `
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>تأكيد البريد الإلكتروني</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f9; }
              .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
              h1 { color: #4A9F8A; font-size: 24px; margin-bottom: 10px; }
              p { color: #666; margin-bottom: 30px; font-size: 16px; line-height: 1.5; }
              .btn { background: #4A9F8A; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block; transition: background 0.3s; }
              .btn:hover { background: #3d8a77; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>تم تأكيد الحساب بنجاح</h1>
              <p>تم تأكيد بريدك الإلكتروني بنجاح. يتم الآن تحويلك إلى التطبيق، أو يمكنك الضغط على الزر أدناه.</p>
              <a href="intent://api.exchangesmangement.online/verify-email?token=${safeToken}#Intent;scheme=https;package=com.algonaid.app;end" class="btn">فتح في التطبيق</a>
            </div>
            <script>
              setTimeout(function() {
                window.location.href = "intent://api.exchangesmangement.online/verify-email?token=${safeToken}#Intent;scheme=https;package=com.algonaid.app;end";
              }, 500);
            </script>
          </body>
          </html>
        `;
        res.type('text/html');
        return html;
      }

      return result;
    } catch (error: any) {
      const accept = req.headers.accept || '';
      if (accept.includes('text/html')) {
    const safeToken = encodeURIComponent(token);
        const html = `
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>خطأ في التأكيد</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f9; }
              .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
              h1 { color: #e53935; font-size: 24px; margin-bottom: 10px; }
              p { color: #666; margin-bottom: 30px; font-size: 16px; line-height: 1.5; }
              .btn { background: #4A9F8A; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block; transition: background 0.3s; }
              .btn:hover { background: #3d8a77; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>حدث خطأ</h1>
              <p>\${error.message || 'الرابط غير صالح أو منتهي الصلاحية. يتم الآن تحويلك للتطبيق.'}</p>
              <a href="intent://api.exchangesmangement.online/verify-email?token=${safeToken}#Intent;scheme=https;package=com.algonaid.app;end" class="btn">فتح في التطبيق</a>
            </div>
            <script>
              setTimeout(function() {
                window.location.href = "intent://api.exchangesmangement.online/verify-email?token=${safeToken}#Intent;scheme=https;package=com.algonaid.app;end";
              }, 500);
            </script>
          </body>
          </html>
        `;
        res.type('text/html');
        return html;
      }
      throw error;
    }
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user data by ID' })
  async getCurrentUser(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayloadType) {
    if (id !== user.id) throw new ForbiddenException();
    return await this.authService.getCurrentUser(id);
  }

  // ==================== Logout ====================
  @Post('logout')
  @UseGuards(JwtAuthGuard)
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