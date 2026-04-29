// ---
// Email service — thin nodemailer wrapper with graceful no-op when email is disabled.
// ---

import { isEmailEnabled, getSmtpConfig } from './emailConfig';

// Use module-level singleton (stored on globalThis for hot-reload safety in Next.js)
const TRANSPORT_KEY = '__spacewars_email_transport__';

declare global {
  var __spacewars_email_transport__: import('nodemailer').Transporter | null | undefined;
}

async function getTransport(): Promise<import('nodemailer').Transporter> {
  if (!globalThis[TRANSPORT_KEY]) {
    const { default: nodemailer } = await import('nodemailer');
    const cfg = getSmtpConfig();
    globalThis[TRANSPORT_KEY] = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });
  }
  return globalThis[TRANSPORT_KEY]!;
}

/**
 * Resets the singleton transport — used in tests for isolation.
 */
export function resetEmailTransport(): void {
  globalThis[TRANSPORT_KEY] = null;
}

/**
 * Sends an email. Fire-and-forget safe — errors are logged but never thrown.
 * When email is disabled, logs a warning and returns immediately.
 */
export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
  if (!isEmailEnabled()) {
    console.warn(`⚠️ Email not configured — skipping send to ${to}`);
    return;
  }

  const cfg = getSmtpConfig();
  const transport = await getTransport();

  try {
    await transport.sendMail({
      from: cfg.from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err);
    // Intentionally swallow — email failures must not block registration
  }
}
