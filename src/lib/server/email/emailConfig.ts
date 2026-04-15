// ---
// SMTP configuration reader — follows the process.env pattern used in database.ts
// ---

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Returns true when email sending is enabled via environment variables.
 * Default is false — email is entirely optional.
 */
export function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === 'true';
}

/**
 * Returns the SMTP configuration read from environment variables.
 * Only call when isEmailEnabled() is true.
 */
export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST ?? '';
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER ?? '';
  const pass = process.env.SMTP_PASS ?? '';
  const from = process.env.SMTP_FROM ?? user;

  return { host, port, secure, user, pass, from };
}
