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

/**
 * Base URL for links in emails (verification, password reset).
 *
 * Uses NEXT_PUBLIC_BASE_URL. Outside production it falls back to the request's Host header for
 * local development. In production the Host header is attacker-controlled (a password reset
 * requested with a forged Host would mail a valid token pointing to another domain), so without
 * NEXT_PUBLIC_BASE_URL this returns null and callers must not send the link.
 */
export function getEmailLinkBaseUrl(headers: { get(name: string): string | null }): string | null {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ NEXT_PUBLIC_BASE_URL is not set; email links are disabled in production');
    return null;
  }
  return `${headers.get('x-forwarded-proto') ?? 'http'}://${headers.get('host') ?? 'localhost:3000'}`;
}
