// ---
// HTML email templates for Spacewars: Ironstrike
// All styles must be inline — email clients strip <style> tags.
// ---

import { getServerT } from '../i18n/serverTranslations';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Builds the verification email sent after registration.
 * Token expires in 24 hours.
 *
 * @param username        - The recipient's username
 * @param verificationUrl - The verification link
 * @param locale          - BCP 47 locale code ('en' | 'de'), defaults to 'en'
 */
export async function buildVerificationEmail(
  username: string,
  verificationUrl: string,
  locale = 'en'
): Promise<EmailContent> {
  const t = await getServerT(locale, 'email');
  const subject = t('verificationSubject');

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:Arial,sans-serif;color:#e0e6ff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e1a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0f1629;border:1px solid #1e3a5f;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0d1f3c;padding:24px 32px;border-bottom:2px solid #1e4080;">
              <h1 style="margin:0;font-size:24px;color:#4a9eff;letter-spacing:1px;">⚔️ Spacewars: Ironstrike</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#e0e6ff;">${t('verificationHeading')}</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                ${t('verificationGreeting', { username: escapeHtml(username) })}
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                ${t('verificationBody')}
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:4px;background-color:#1a56db;">
                    <a href="${verificationUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:4px;">
                      ${t('verificationButton')}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                ${t('verificationFallback')}<br>
                <a href="${verificationUrl}" style="color:#4a9eff;word-break:break-all;">${verificationUrl}</a>
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                ${t('verificationIgnore')}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0d1629;padding:16px 32px;border-top:1px solid #1e3a5f;">
              <p style="margin:0;font-size:12px;color:#607a99;">
                ${t('footerTagline')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `${subject}

${t('verificationGreeting', { username })}

${t('verificationBody')}

${verificationUrl}

${t('verificationIgnore')}

-- Spacewars: Ironstrike`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Builds the password reset email.
 * Token expires in 1 hour.
 *
 * @param username  - The recipient's username
 * @param resetUrl  - The password reset link
 * @param locale    - BCP 47 locale code ('en' | 'de'), defaults to 'en'
 */
export async function buildPasswordResetEmail(
  username: string,
  resetUrl: string,
  locale = 'en'
): Promise<EmailContent> {
  const t = await getServerT(locale, 'email');
  const subject = t('resetSubject');

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:Arial,sans-serif;color:#e0e6ff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e1a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0f1629;border:1px solid #1e3a5f;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0d1f3c;padding:24px 32px;border-bottom:2px solid #1e4080;">
              <h1 style="margin:0;font-size:24px;color:#4a9eff;letter-spacing:1px;">⚔️ Spacewars: Ironstrike</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#e0e6ff;">${t('resetHeading')}</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                ${t('verificationGreeting', { username: escapeHtml(username) })}
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                ${t('resetBody')}
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:4px;background-color:#1a56db;">
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:4px;">
                      ${t('resetButton')}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                ${t('resetFallback')}<br>
                <a href="${resetUrl}" style="color:#4a9eff;word-break:break-all;">${resetUrl}</a>
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                ${t('resetIgnore')}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0d1629;padding:16px 32px;border-top:1px solid #1e3a5f;">
              <p style="margin:0;font-size:12px;color:#607a99;">
                ${t('footerTagline')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `${subject}\n\n${t('verificationGreeting', { username })}\n\n${t('resetBody')}\n\n${resetUrl}\n\n${t('resetIgnore')}\n\n-- Spacewars: Ironstrike`;

  return { subject, html, text };
}
