import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRegisterDto } from '../dtos/user-register.dto';
import { UserLoginDto } from '../dtos/user-login.dto';
import { AuthenticateV2Dto } from '../dtos/authenticate-v2.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { UserRole } from '../enums/userRole';
import { MESSAGES } from 'src/utils/messages';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { MailService } from 'src/utils/mail.service';
import { ResendVerificationDto } from '../dtos/resend-verification.dto';
import { createClient } from '@supabase/supabase-js';
import { LoginAttemptService } from './login-attempt.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  // ==================== Forgot Password ====================
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    let { email } = forgotPasswordDto;
    email = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return a generic message to prevent account enumeration.
    if (!user) {
      return { message: MESSAGES.AUTH.RESET_PASSWORD_SENT };
    }

    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedResetToken,
        resetPasswordExpires: resetPasswordExpires,
      },
    });

    // Send email with rawResetToken using Resend
    await this.mailService.sendPasswordResetEmail(email, rawResetToken).catch((err) => {
      console.error('⚠️ Failed to send password reset email:', err);
    });

    return {
      message: MESSAGES.AUTH.RESET_PASSWORD_SENT,
    };
  }

  // ==================== Reset Password ====================
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;
    
    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
      },
    });

    if (!user) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_OR_EXPIRED_TOKEN);
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_OR_EXPIRED_TOKEN);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return {
      message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS,
    };
  }

  // ==================== Validate Reset Token ====================
  async validateResetToken(token: string) {
    if (!token || token.trim() === '') {
      throw new BadRequestException(MESSAGES.AUTH.VERIFICATION_TOKEN_INVALID);
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { resetPasswordToken: hashedToken },
    });

    if (!user) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_OR_EXPIRED_TOKEN);
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_OR_EXPIRED_TOKEN);
    }

    return { valid: true };
  }

  // ==================== Register ====================
  async register(userDto: UserRegisterDto) {
    let { email, password, name } = userDto;
    email = email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (!existingUser.emailVerified && !existingUser.googleId) {
        await this.resendVerificationEmail({ email });
        throw new UnauthorizedException(MESSAGES.AUTH.EMAIL_NOT_VERIFIED_SENT_AGAIN);
      }
      throw new ConflictException(MESSAGES.AUTH.EMAIL_ALREADY_REGISTERED);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Public registration must never be able to create a privileged account.
    const prismaRole: Role = Role.STUDENT;

    // ===== توليد Verification Token آمن =====
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    // صلاحية ساعة واحدة
    const verificationTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: prismaRole,
          // حقول التحقق
          emailVerified: false,
          verificationToken: hashedVerificationToken,
          verificationTokenExpiry,

          ...(prismaRole === Role.STUDENT
            ? {
                studentProfile: {
                  create: {
                    academicId: `STU-${Date.now()}`,
                  },
                },
              }
            : prismaRole === Role.ADMIN
              ? {
                  teacherProfile: {
                    create: {
                      specialization: 'General',
                    },
                  },
                }
              : {}),
        },
        include: { studentProfile: true, teacherProfile: true },
      });

      // ===== إرسال بريد التحقق =====
try {
  await this.mailService.sendVerificationEmail(
    email,
    rawVerificationToken,
  );
} catch (error) {
  console.error('❌ Verification email failed:', error);
}

      // عدم توليد توكن وإلزام المستخدم بتأكيد البريد الإلكتروني أولاً
      return {
        message: MESSAGES.AUTH.USER_REGISTERED,
        user: this.formatUserResponse(user),
        requiresEmailVerification: true,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(MESSAGES.AUTH.EMAIL_ALREADY_REGISTERED);
      }
      throw error;
    }
  }

  // ==================== Authenticate V2 (Unified Login/Register) ====================
  async authenticateV2(dto: AuthenticateV2Dto) {
    let { email, password, name } = dto;
    email = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { studentProfile: true, teacherProfile: true },
    });

    if (user) {
      // User exists -> Login Flow
      if (!user.password) {
        throw new UnauthorizedException(MESSAGES.AUTH.GOOGLE_ACCOUNT_LOGIN_REQUIRED);
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
      }

      const token = await this.generateToken(user.id, user.email, user.role);

      return {
        message: MESSAGES.AUTH.LOGGED_IN,
        user: this.formatUserResponse(user),
        access_token: token,
        isNewUser: false,
      };
    } else {
      // User doesn't exist -> Register Flow
      if (!name) {
        throw new BadRequestException({
          statusCode: 400,
          action: 'NAME_REQUIRED',
          message: 'يجب إدخال الاسم لإنشاء حساب جديد',
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const rawVerificationToken = crypto.randomBytes(32).toString('hex');
      const hashedVerificationToken = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
      const verificationTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const newUser = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: Role.STUDENT,
          verificationToken: hashedVerificationToken,
          verificationTokenExpiry,
          studentProfile: {
            create: {
              academicId: `STU-${Date.now()}`,
            },
          },
        },
        include: { studentProfile: true, teacherProfile: true },
      });

      // Send email asynchronously without blocking
      this.mailService.sendVerificationEmail(email, rawVerificationToken).catch(err => {
        console.error('❌ Verification email failed:', err);
      });

      const token = await this.generateToken(newUser.id, newUser.email, newUser.role);

      return {
        message: MESSAGES.AUTH.USER_REGISTERED,
        user: this.formatUserResponse(newUser),
        access_token: token,
        isNewUser: true,
      };
    }
  }

  // ==================== Login ====================
  async login(userDto: UserLoginDto) {
    let { email, password } = userDto;
    email = email.toLowerCase().trim();

    // ===== Account Lockout Check =====
    const lockStatus = this.loginAttemptService.checkLockout(email);
    if (lockStatus.locked) {
      throw new UnauthorizedException(
        `حسابك موقوف مؤقتاً بسبب محاولات دخول متعددة. حاول مرة أخرى بعد ${lockStatus.remainingSeconds} ثانية.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { studentProfile: true, teacherProfile: true },
    });

    // Use a single generic error for both "user not found" and "wrong password"
    // to prevent account enumeration attacks.
    if (!user || !user.password) {
      // Still run bcrypt to prevent timing attacks that reveal account existence.
      await bcrypt.compare(password, '$2b$10$invalidhashfortimingprotection000000000000000000000');
      if (user && !user.password) {
        throw new UnauthorizedException(MESSAGES.AUTH.GOOGLE_ACCOUNT_LOGIN_REQUIRED);
      }
      this.loginAttemptService.recordFailure(email);
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.loginAttemptService.recordFailure(email);
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // ===== التحقق من تأكيد البريد الإلكتروني =====
    if (!user.emailVerified) {
      await this.resendVerificationEmail({ email });
      throw new UnauthorizedException(MESSAGES.AUTH.EMAIL_NOT_VERIFIED_SENT_AGAIN);
    }

    // Clear failure counter on successful login
    this.loginAttemptService.recordSuccess(email);

    const token = await this.generateToken(user.id, user.email, user.role);

    return {
      message: MESSAGES.AUTH.LOGGED_IN,
      user: this.formatUserResponse(user),
      access_token: token,
    };
  }

  // ==================== Verify Email ====================
  /**
   * يتحقق من صحة الـ Token ويفعّل البريد الإلكتروني
   * يُستخدم عند ضغط المستخدم على رابط التحقق
   */
  async verifyEmail(token: string) {
    if (!token || token.trim() === '') {
      throw new BadRequestException(MESSAGES.AUTH.VERIFICATION_TOKEN_INVALID);
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // البحث عن المستخدم بالـ Token
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: hashedToken },
    });

    // إذا لم يوجد مستخدم بهذا الـ Token
    if (!user) {
      throw new BadRequestException(MESSAGES.AUTH.VERIFICATION_TOKEN_USED);
    }

    // 1. التحقق من انتهاء الصلاحية أولاً
    if (
      !user.verificationTokenExpiry ||
      user.verificationTokenExpiry < new Date()
    ) {
      throw new BadRequestException(MESSAGES.AUTH.VERIFICATION_TOKEN_EXPIRED);
    }

    // 2. إذا كان البريد مؤكداً بالفعل (والرابط ما زال صالحاً لفترة السماح)
    if (user.emailVerified) {
      const jwtToken = await this.generateToken(user.id, user.email, user.role);
      return {
        message: MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED,
        verified: true,
        user: this.formatUserResponse(user),
        access_token: jwtToken,
      };
    }

    // 3. تحديث المستخدم: تفعيل البريد وإعطاء فترة سماح 15 ثانية للتطبيق لاستلام الجلسة
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationTokenExpiry: new Date(Date.now() + 15000), // 15 ثانية فقط
      },
      include: { studentProfile: true, teacherProfile: true },
    });

    const jwtToken = await this.generateToken(updatedUser.id, updatedUser.email, updatedUser.role);

    return {
      message: MESSAGES.AUTH.EMAIL_VERIFIED_SUCCESS,
      verified: true,
      user: this.formatUserResponse(updatedUser),
      access_token: jwtToken,
    };
  }

  // ==================== Resend Verification Email ====================
  /**
   * يعيد إرسال بريد التحقق
   * يُستخدم عند انتهاء صلاحية الرابط أو طلب إعادة الإرسال
   */
  async resendVerificationEmail(dto: ResendVerificationDto) {
    let { email } = dto;
    email = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return the same response to avoid revealing account existence.
    if (!user || user.emailVerified) {
      return { message: MESSAGES.AUTH.VERIFICATION_EMAIL_SENT };
    }

    // توليد token جديد
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // ساعة

    // حفظ الـ Token الجديد
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashedVerificationToken,
        verificationTokenExpiry,
      },
    });

    // إرسال البريد
    await this.mailService.sendVerificationEmail(email, rawVerificationToken);

    return {
      message: MESSAGES.AUTH.VERIFICATION_EMAIL_SENT,
    };
  }

  // ==================== Google Auth ====================
  async validateGoogleUser(googleUser: any) {
    const { email, name, googleId, avatar } = googleUser;

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { studentProfile: true, teacherProfile: true },
    });

    if (user) {
      // Update user with googleId if they signed up with email before
      if (!user.googleId || (avatar && !user.avatar)) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            ...(avatar && !user.avatar ? { avatar } : {}),
            // المستخدمون عبر Google تعتبر بريداتهم محققة تلقائياً
            emailVerified: true,
          },
          include: { studentProfile: true, teacherProfile: true },
        });
      }
    } else {
      // Create new user (default role is STUDENT)
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          googleId,
          avatar,
          role: Role.STUDENT,
          // Google users are automatically verified
          emailVerified: true,
          studentProfile: {
            create: {
              academicId: `STU-G-${Date.now()}`,
            },
          },
        },
        include: { studentProfile: true, teacherProfile: true },
      });
    }

    const token = await this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Google login successful',
      user: this.formatUserResponse(user),
      access_token: token,
    };
  }

  async getCurrentUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, teacherProfile: true },
    });
    if (!user) {
      throw new NotFoundException(MESSAGES.AUTH.USER_NOT_EXIST(id));
    } else {
      return {
        user: this.formatUserResponse(user),
      };
    }
  }

  // ==================== Get Verification Status ====================
  async getVerificationStatus(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(MESSAGES.AUTH.USER_NOT_EXIST(userId));
    }

    const GRACE_PERIOD_DAYS = 3;
    const createdAtTime = new Date(user.createdAt).getTime();
    const now = Date.now();
    const diffMs = now - createdAtTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const remainingDays = Math.max(0, GRACE_PERIOD_DAYS - diffDays);
    const isExpired = !user.emailVerified && diffDays >= GRACE_PERIOD_DAYS;

    return {
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified ?? false,
      createdAt: user.createdAt,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      remainingDays,
      isExpired,
    };
  }

  async logout(token: string) {
    const decoded = this.jwtService.decode(token) as any;
    const expiresAt = new Date(decoded.exp * 1000);

    await this.prisma.tokenBlacklist.create({
      data: {
        token,
        expiresAt,
      },
    });

    return { message: 'Logged out successfully' };
  }

  async loginWithGoogleMobile(idToken: string) {
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || process.env.SUPABASE_URL;
      const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY') || process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration is missing (SUPABASE_URL or SUPABASE_ANON_KEY)');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify the Supabase JWT Token
      const { data, error } = await supabase.auth.getUser(idToken);
      
      if (error || !data.user) {
        throw new UnauthorizedException(error?.message || 'Invalid Supabase Token');
      }
      
      // Verify the authentication was done via Google, not email/password.
      const provider = data.user.app_metadata?.provider;
      if (provider !== 'google') {
        throw new UnauthorizedException('Only Google authentication is accepted for this endpoint');
      }

      const email = data.user.email;
      if (!email) {
         throw new UnauthorizedException('No email found in Supabase Token');
      }
      
      const userMetadata = data.user.user_metadata || {};
      const name = userMetadata.name || userMetadata.full_name || email.split('@')[0];
      const avatar = userMetadata.avatar_url || userMetadata.picture || null;
      const googleId = data.user.id;

      const googleUser = {
        email,
        name,
        googleId,
        avatar,
      };

      return this.validateGoogleUser(googleUser);
    } catch (error: any) {
      console.error('❌ Google Mobile Login Error Details:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        error.message || 'Failed to verify Supabase ID Token',
      );
    }
  }

  // ==================== Private Helpers ====================
  private async generateToken(userId: number, email: string, role: Role) {
    let userRole: UserRole = UserRole.STUDENT;
    if (role === Role.ADMIN) userRole = UserRole.ADMIN;
    if (role === Role.OWNER) userRole = UserRole.OWNER;

    const payload = { id: userId, email, role: userRole };
    return await this.jwtService.signAsync(payload);
  }

  private formatUserResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      avatarUrl: user.avatar,
      background: user.background,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      emailVerified: user.emailVerified ?? false,
      ...(user.studentProfile
        ? {
            academicId: user.studentProfile.academicId,
            grade: user.studentProfile.grade,
            birthDate: user.studentProfile.birthDate,
            address: user.studentProfile.address,
          }
        : {}),
      ...(user.teacherProfile
        ? {
            specialization: user.teacherProfile.specialization,
            bio: user.teacherProfile.bio,
            experience: user.teacherProfile.experience,
          }
        : {}),
    };
  }
}
