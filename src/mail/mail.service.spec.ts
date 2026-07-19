import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import { MailTransporter } from './mail.constants';
import { MailService } from './mail.service';

interface TestMailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

describe('MailService', () => {
  const sendMail = jest.fn<Promise<{ messageId: string }>, [TestMailMessage]>();
  const configValues: Record<string, string> = {
    NODE_ENV: 'test',
    MAIL_USER: 'sender@example.com',
    MAIL_FROM: 'PRM Shop <sender@example.com>',
  };
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const transporter = { sendMail } as unknown as MailTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: 'message-1' });
  });

  it('gửi email OTP đăng ký với nội dung và thời hạn phù hợp', async () => {
    const service = new MailService(transporter, configService);

    await service.sendOtp(
      'customer@example.com',
      '123456',
      OtpPurpose.registration,
    );

    const message = sendMail.mock.calls[0][0];
    expect(message).toMatchObject({
      from: 'PRM Shop <sender@example.com>',
      to: 'customer@example.com',
      subject: 'Mã OTP xác thực tài khoản PRM Shop',
    });
    expect(message.text).toContain('123456');
    expect(message.html).toContain('123456');
  });

  it('dùng tiêu đề riêng cho OTP đặt lại mật khẩu', async () => {
    const service = new MailService(transporter, configService);

    await service.sendOtp(
      'customer@example.com',
      '654321',
      OtpPurpose.password_reset,
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Mã OTP đặt lại mật khẩu PRM Shop',
      }),
    );
  });

  it('trả lỗi dịch vụ khi SMTP gửi thất bại', async () => {
    sendMail.mockRejectedValue(new Error('SMTP rejected credentials'));
    const service = new MailService(transporter, configService);

    await expect(
      service.sendOtp(
        'customer@example.com',
        '123456',
        OtpPurpose.registration,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
