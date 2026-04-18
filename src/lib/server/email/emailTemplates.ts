// ---
// HTML email templates for Spacewars: Ironstrike
// All styles must be inline — email clients strip <style> tags.
// ---

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Builds the verification email sent after registration.
 * Token expires in 24 hours.
 */
export function buildVerificationEmail(
  username: string,
  verificationUrl: string
): EmailContent {
  const subject = 'Verify your Spacewars: Ironstrike email address';

  const html = `
<!DOCTYPE html>
<html lang="en">
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
              <h2 style="margin:0 0 16px;font-size:20px;color:#e0e6ff;">Verify your email address</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                Hello <strong style="color:#e0e6ff;">${escapeHtml(username)}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                Click the button below to verify your email address. This link expires in <strong style="color:#e0e6ff;">24 hours</strong>.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:4px;background-color:#1a56db;">
                    <a href="${verificationUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:4px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                If the button does not work, copy and paste the following URL into your browser:<br>
                <a href="${verificationUrl}" style="color:#4a9eff;word-break:break-all;">${verificationUrl}</a>
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                If you did not create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0d1629;padding:16px 32px;border-top:1px solid #1e3a5f;">
              <p style="margin:0;font-size:12px;color:#607a99;">
                Spacewars: Ironstrike — Space exploration game
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

  const text = `Spacewars: Ironstrike — Verify your email address

Hello ${username},

Click the link below to verify your email address. This link expires in 24 hours.

${verificationUrl}

If you did not create an account, you can safely ignore this email.

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
 */
export function buildPasswordResetEmail(
  username: string,
  resetUrl: string
): EmailContent {
  const subject = 'Reset your Spacewars: Ironstrike password';

  const html = `
<!DOCTYPE html>
<html lang="en">
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
              <h2 style="margin:0 0 16px;font-size:20px;color:#e0e6ff;">Reset your password</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                Hello <strong style="color:#e0e6ff;">${escapeHtml(username)}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#a0b4cc;line-height:1.6;">
                We received a request to reset your password. Click the button below to set a new password.
                This link expires in <strong style="color:#e0e6ff;">1 hour</strong>.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:4px;background-color:#1a56db;">
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:4px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                If the button does not work, copy and paste the following URL into your browser:<br>
                <a href="${resetUrl}" style="color:#4a9eff;word-break:break-all;">${resetUrl}</a>
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#607a99;line-height:1.6;">
                If you did not request a password reset, you can safely ignore this email. Your password will not change.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0d1629;padding:16px 32px;border-top:1px solid #1e3a5f;">
              <p style="margin:0;font-size:12px;color:#607a99;">
                Spacewars: Ironstrike — Space exploration game
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

  const text = `Spacewars: Ironstrike — Reset your password\n\nHello ${username},\n\nWe received a request to reset your password. Use the link below to set a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request a password reset, you can safely ignore this email. Your password will not change.\n\n-- Spacewars: Ironstrike`;

  return { subject, html, text };
}
