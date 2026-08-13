import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'no-reply@algonaid.com';
  }

  // ==================== Password Reset Email ====================
  async sendPasswordResetEmail(email: string, token: string) {
    const baseUrl = this.configService.get<string>('APP_URL') || 'https://algonaid.com';
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    try {
      const info = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'إعادة تعيين كلمة المرور - منصة الجنيد',
        html: `
          <div dir="rtl" style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a73e8, #0d47a1); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">منصة الجنيد التعليمية</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0;">
              <h2 style="color: #1a73e8;">طلب إعادة تعيين كلمة المرور</h2>
              <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
              <p>يرجى الضغط على الزر أدناه لإكمال العملية:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #1a73e8, #0d47a1); color: #fff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                  إعادة تعيين كلمة المرور
                </a>
              </div>
              <p style="color: #777; font-size: 14px;">صالح لمدة ساعة واحدة فقط.</p>
              <p style="color: #777; font-size: 14px;">إذا لم تطلب هذا التغيير، يمكنك تجاهل هذا البريد بأمان.</p>
            </div>
            <div style="background: #f0f0f0; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="font-size: 12px; color: #999; margin: 0;">هذا البريد مرسل بشكل آلي، يرجى عدم الرد عليه.</p>
            </div>
          </div>
        `,
      });

      if (info.error) {
        console.error('Resend API Error:', info.error);
        throw new InternalServerErrorException('Failed to send email via Resend API');
      }

      return info;
    } catch (err) {
      console.error('Mail Service Error:', err);
      throw new InternalServerErrorException(
        'An error occurred while sending the email',
      );
    }
  }

  // ==================== Email Verification Email ====================
  /**
   * يرسل بريد التحقق من البريد الإلكتروني مع رابط Deep Link
   * الرابط يفتح التطبيق مباشرةً عبر Android App Links
   */
  async sendVerificationEmail(email: string, token: string) {
    const baseUrl = this.configService.get<string>('APP_URL') || 'https://algonaid.com';
    const verificationLink = `${baseUrl}/verify-email?token=${token}`;

    try {
      const info = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: '✅ تأكيد البريد الإلكتروني - منصة الجنيد',
        html: `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Arial, sans-serif;">
            <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); padding: 40px 30px; text-align: center;">
                <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 36px;">🎓</span>
                </div>
                <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700;">منصة الجنيد التعليمية</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">أهلاً بك في رحلتك التعليمية</p>
              </div>

              <!-- Body -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #1a237e; font-size: 22px; margin: 0 0 16px;">تأكيد البريد الإلكتروني</h2>
                <p style="color: #555; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                  شكراً لتسجيلك في منصة الجنيد! يرجى تأكيد عنوان بريدك الإلكتروني للبدء في استخدام المنصة والوصول إلى جميع المحتويات التعليمية.
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${verificationLink}" 
                     style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(26,115,232,0.4);">
                    ✅ تأكيد البريد الإلكتروني
                  </a>
                </div>

                <!-- Info Box -->
                <div style="background: #e8f0fe; border-right: 4px solid #1a73e8; padding: 16px 20px; border-radius: 8px; margin: 25px 0;">
                  <p style="color: #1a237e; margin: 0; font-size: 14px; line-height: 1.6;">
                    <strong>ملاحظة:</strong> إذا كان التطبيق مثبتاً على هاتفك، سيتم فتحه تلقائياً عند الضغط على الزر أعلاه. هذا الرابط صالح لمدة <strong>ساعة واحدة</strong> فقط.
                  </p>
                </div>

                <!-- Link fallback -->
                <p style="color: #888; font-size: 13px; margin: 20px 0 0;">
                  إذا لم يعمل الزر، انسخ الرابط أدناه وأدخله في متصفحك:
                </p>
                <p style="word-break: break-all; color: #1a73e8; font-size: 12px; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;">
                  ${verificationLink}
                </p>

                <p style="color: #aaa; font-size: 13px; margin: 20px 0 0;">
                  إذا لم تقم بالتسجيل في المنصة، يمكنك تجاهل هذا البريد بأمان.
                </p>
              </div>

              <!-- Footer -->
              <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="color: #aaa; font-size: 12px; margin: 0;">
                  © 2025 منصة الجنيد التعليمية • هذا البريد مرسل بشكل آلي
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (info.error) {
        console.error('Resend API Error (Verification):', info.error);
        throw new InternalServerErrorException('Failed to send verification email via Resend API');
      }

      return info;
    } catch (err) {
      console.error('Mail Service Error (Verification):', err);
      throw new InternalServerErrorException(
        'An error occurred while sending the verification email',
      );
    }
  }
}
