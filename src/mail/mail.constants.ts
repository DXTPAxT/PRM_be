import type { Transporter } from 'nodemailer';

export const MAIL_TRANSPORTER = Symbol('MAIL_TRANSPORTER');

export type MailTransporter = Pick<Transporter, 'sendMail'>;
