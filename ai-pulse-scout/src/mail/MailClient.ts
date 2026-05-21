export interface SendMailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailClient {
  send(options: SendMailOptions): Promise<void>;
}
