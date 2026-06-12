import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
    // You can set a default sender or use one from .env
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5000'}/reset-password?token=${token}`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: 'إعادة تعيين كلمة المرور - منصة الجنيد',
        html: `
          <div dir="rtl" style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2>طلب إعادة تعيين كلمة المرور</h2>
            <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على منصة الجنيد التعليمية.</p>
            <p>يرجى الضغط على الرابط أدناه لإكمال العملية:</p>
            <p>
              <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">إعادة تعيين كلمة المرور</a>
            </p>
            <p>إذا لم تطلب هذا التغيير، يمكنك تجاهل هذا البريد بأمان.</p>
            <hr />
            <p style="font-size: 0.8em; color: #777;">هذا البريد مرسل بشكل آلي، يرجى عدم الرد عليه.</p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend Error:', error);
        throw new InternalServerErrorException('Failed to send email');
      }

      return data;
    } catch (err) {
      console.error('Mail Service Error:', err);
      throw new InternalServerErrorException('An error occurred while sending the email');
    }
  }
}
