import nodemailer from 'nodemailer';
import type { MailClient, SendMailOptions } from './MailClient.js';
import { logger } from '../utils/logger.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export function smtpConfigFromEnv(): SmtpConfig {
  return {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  };
}

export class SmtpMailClient implements MailClient {
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async send(options: SendMailOptions): Promise<void> {
    if (!this.config.user || !this.config.pass) {
      throw new Error(
        'SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in .env',
      );
    }

    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.pass },
    });

    logger.info(`Sending email to ${options.to} via ${this.config.host}:${this.config.port}`);

    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info(`Email sent: messageId=${info.messageId}`);
  }
}
