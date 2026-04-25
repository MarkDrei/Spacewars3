declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string;
    to?: string | string[];
    subject?: string;
    html?: string;
    text?: string;
  }

  export interface SendMailResult {
    // Minimal result shape for this project; callers do not inspect returned fields.
    accepted?: string[];
    rejected?: string[];
    envelope?: Record<string, unknown>;
    messageId?: string;
  }

  export interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SendMailResult>;
  }

  export interface TransportOptions {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  }

  export interface Nodemailer {
    createTransport(options: TransportOptions): Transporter;
  }

  const nodemailer: Nodemailer;
  export default nodemailer;
}
