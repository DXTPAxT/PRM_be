import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import { MAIL_TRANSPORTER, MailTransporter } from './mail.constants';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(
    @Inject(MAIL_TRANSPORTER)
    private readonly transporter: MailTransporter | null,
    private readonly configService: ConfigService,
  ) {
    this.from =
      this.configService.get<string>('MAIL_FROM')?.trim() ||
      this.configService.get<string>('MAIL_USER')?.trim() ||
      'PRM Shop';
  }

  async sendOtp(
    recipient: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    if (!this.transporter) {
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(
          `SMTP chưa được cấu hình. OTP cho ${recipient}: ${code}`,
        );
        return;
      }

      throw new ServiceUnavailableException(
        'Dịch vụ gửi email tạm thời chưa được cấu hình',
      );
    }

    const isPasswordReset = purpose === OtpPurpose.password_reset;
    const action = isPasswordReset ? 'đặt lại mật khẩu' : 'xác thực tài khoản';
    const subject = isPasswordReset
      ? 'Mã OTP đặt lại mật khẩu PRM Shop'
      : 'Mã OTP xác thực tài khoản PRM Shop';

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipient,
        subject,
        text: `Mã OTP để ${action} PRM Shop của bạn là ${code}. Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.`,
        html: this.buildOtpHtml(code, action),
      });
      this.logger.log(`Đã gửi OTP đến ${this.maskEmail(recipient)}`);
    } catch (error: unknown) {
      const reason =
        error instanceof Error ? error.message : 'Lỗi SMTP không xác định';
      this.logger.error(
        `Không thể gửi OTP đến ${this.maskEmail(recipient)}: ${reason}`,
      );
      throw new ServiceUnavailableException(
        'Không thể gửi mã OTP lúc này. Vui lòng thử lại sau',
      );
    }
  }

  private buildOtpHtml(code: string, action: string): string {
    return `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
            <tr><td style="font-size:24px;font-weight:700;color:#111827">PRM Shop</td></tr>
            <tr><td style="padding-top:24px;font-size:16px;line-height:24px">Dùng mã sau để ${action}:</td></tr>
            <tr><td align="center" style="padding:24px 0"><span style="display:inline-block;padding:14px 24px;background:#111827;color:#ffffff;border-radius:8px;font-size:30px;font-weight:700;letter-spacing:8px">${code}</span></td></tr>
            <tr><td style="font-size:14px;line-height:22px;color:#4b5563">Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.</td></tr>
            <tr><td style="padding-top:20px;font-size:13px;line-height:20px;color:#6b7280">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return '***';
    const visible = localPart.slice(0, Math.min(2, localPart.length));
    return `${visible}***@${domain}`;
  }
}
