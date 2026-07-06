import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRegisterDto } from '../dtos/user-register.dto';
import { UserLoginDto } from '../dtos/user-login.dto';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  // ==================== Forgot Password ====================
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    let { email } = forgotPasswordDto;
    email = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(MESSAGES.AUTH.EMAIL_NOT_FOUND);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetPasswordExpires,
      },
    });

    // Send email with resetToken using Resend
    await this.mailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: MESSAGES.AUTH.RESET_PASSWORD_SENT,
    };
  }

  // ==================== Reset Password ====================
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
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

  // ==================== Register ====================
  async register(userDto: UserRegisterDto) {
    let { email, password, name, role } = userDto;
    email = email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(MESSAGES.AUTH.EMAIL_ALREADY_REGISTERED);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let prismaRole: Role = Role.STUDENT;
    if (role === UserRole.ADMIN) prismaRole = Role.ADMIN;
    if (role === UserRole.OWNER) prismaRole = Role.OWNER;

    // ===== توليد Verification Token آمن =====
    const verificationToken = crypto.randomBytes(32).toString('hex');
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
          verificationToken,
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
      // نرسل في الخلفية ولا نوقف عملية التسجيل إذا فشل الإرسال
      this.mailService
        .sendVerificationEmail(email, verificationToken)
        .catch((err) => {
          console.error('⚠️ Failed to send verification email:', err);
        });

      // نُعيد بيانات المستخدم بدون access_token
      // لأن المستخدم يجب أن يؤكد بريده أولاً قبل تسجيل الدخول
      return {
        message: MESSAGES.AUTH.USER_REGISTERED,
        user: this.formatUserResponse(user),
        // لا نُعيد access_token حتى يتم التحقق من البريد
        requiresEmailVerification: true,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(MESSAGES.AUTH.EMAIL_ALREADY_REGISTERED);
      }
      throw error;
    }
  }

  // ==================== Login ====================
  async login(userDto: UserLoginDto) {
    let { email, password } = userDto;
    email = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { studentProfile: true, teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException(MESSAGES.AUTH.ACCOUNT_NOT_FOUND);
    }

    if (!user.password) {
      throw new UnauthorizedException(MESSAGES.AUTH.GOOGLE_ACCOUNT_LOGIN_REQUIRED);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // ===== التحقق من تأكيد البريد الإلكتروني =====
    if (!user.emailVerified) {
      throw new UnauthorizedException(MESSAGES.AUTH.EMAIL_NOT_VERIFIED);
    }

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

    // البحث عن المستخدم بالـ Token
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    // إذا لم يوجد مستخدم بهذا الـ Token
    if (!user) {
      throw new BadRequestException(MESSAGES.AUTH.VERIFICATION_TOKEN_USED);
    }

    // إذا كان البريد مؤكداً بالفعل
    if (user.emailVerified) {
      throw new BadRequestException(MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED);
    }

    // التحقق من انتهاء الصلاحية
    if (
      !user.verificationTokenExpiry ||
      user.verificationTokenExpiry < new Date()
    ) {
      throw new BadRequestException(MESSAGES.AUTH.VERIFICATION_TOKEN_EXPIRED);
    }

    // تحديث المستخدم: تفعيل البريد وحذف الـ Token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return {
      message: MESSAGES.AUTH.EMAIL_VERIFIED_SUCCESS,
      verified: true,
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

    if (!user) {
      throw new NotFoundException(MESSAGES.AUTH.EMAIL_NOT_FOUND);
    }

    // إذا كان البريد مؤكداً بالفعل لا نحتاج لإعادة الإرسال
    if (user.emailVerified) {
      throw new BadRequestException(MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED);
    }

    // توليد token جديد
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // ساعة

    // حفظ الـ Token الجديد
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // إرسال البريد
    await this.mailService.sendVerificationEmail(email, verificationToken);

    return {
      message: MESSAGES.AUTH.VERIFICATION_EMAIL_SENT,
    };
  }

  // ==================== Google Auth ====================
  async validateGoogleUser(googleUser: any) {
    console.log('============');
    const { email, name, googleId } = googleUser;

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { studentProfile: true, teacherProfile: true },
    });

    if (user) {
      // Update user with googleId if they signed up with email before
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
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
      console.log('======login======');

      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UnauthorizedException(
          errorData.error_description || 'Invalid Google ID Token',
        );
      }

      const payload = await response.json();

      // Verify audience matches one of our allowed Client IDs
      const webClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const androidClientIds =
        this.configService
          .get<string>('GOOGLE_ANDROID_CLIENT_IDS')
          ?.split(',') || [];
      const allowedClientIds = [webClientId, ...androidClientIds].filter(
        Boolean,
      );

      if (!allowedClientIds.includes(payload.aud)) {
        console.error(
          `❌ Token audience mismatch. Received aud: ${payload.aud}`,
        );
        console.error(`   Allowed client IDs: ${allowedClientIds.join(', ')}`);
        throw new UnauthorizedException('Invalid Google ID Token audience');
      }

      // Verify token expiration
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (Number(payload.exp) < currentTimestamp) {
        throw new UnauthorizedException('Google ID Token has expired');
      }

      const googleUser = {
        email: payload.email,
        name:
          payload.name ||
          `${payload.given_name || ''} ${payload.family_name || ''}`.trim() ||
          payload.email.split('@')[0],
        googleId: payload.sub,
      };

      return this.validateGoogleUser(googleUser);
    } catch (error: any) {
      console.error('❌ Google Mobile Login Error Details:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        error.message || 'Failed to verify Google ID Token',
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
