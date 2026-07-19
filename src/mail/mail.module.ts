import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MAIL_TRANSPORTER, MailTransporter } from './mail.constants';
import { MailService } from './mail.service';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MailTransporter | null => {
        const user = configService.get<string>('MAIL_USER')?.trim();
        const pass = configService.get<string>('MAIL_APP_PASSWORD')?.trim();

        if (!user || !pass) return null;

        const secureSetting = configService.get<boolean | string>(
          'MAIL_SECURE',
          true,
        );

        return nodemailer.createTransport({
          host: configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
          port: configService.get<number>('MAIL_PORT', 465),
          secure: secureSetting === true || secureSetting === 'true',
          auth: { user, pass },
        });
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
