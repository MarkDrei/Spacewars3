# Mail Server Configuration Guide

## Overview

The Spacewars: Ironstrike game includes a complete email system for:

- **Email verification** during registration
- **Password reset** via email tokens

Email is **optional** and gracefully disabled by default. When not configured, the game works exactly as before.

## Email Features

### 1. Registration Email Verification

- User registers with optional email address
- Verification email sent with token link
- Token expires after **24 hours**
- User clicks link to verify ownership
- Verification is fire-and-forget (failures don't block registration)

### 2. Password Reset

- User requests password reset at `/reset-password`
- System sends reset email with token link
- Token expires after **1 hour**
- User clicks link to reset password
- Email sent only if account exists (no email leakage)

## Environment Variables

All SMTP configuration uses environment variables (no config files needed).

| Variable               | Description                                | Default       | Example               |
| ---------------------- | ------------------------------------------ | ------------- | --------------------- |
| `EMAIL_ENABLED`        | Master toggle to enable email              | `false`       | `true`                |
| `SMTP_HOST`            | SMTP server hostname                       | —             | `smtp.gmail.com`      |
| `SMTP_PORT`            | SMTP server port                           | `587`         | `587` or `465`        |
| `SMTP_SECURE`          | Use TLS directly (set `true` for port 465) | `false`       | `true` or `false`     |
| `SMTP_USER`            | SMTP username/email                        | —             | `you@gmail.com`       |
| `SMTP_PASS`            | SMTP password or app password              | —             | `your-app-password`   |
| `SMTP_FROM`            | "From" address in emails                   | `SMTP_USER`   | `noreply@example.com` |
| `NEXT_PUBLIC_BASE_URL` | Base URL for links in emails               | Auto-detected | `https://yourapp.com` |

## Configuration Methods

### Quick Start: Gmail (Recommended for Testing)

**Gmail setup** (no server needed — uses your Gmail account):

1. **Enable 2-Factor Authentication**
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Left menu: "Security"
   - Enable "2-Step Verification"

2. **Generate App Password**
   - Return to Security settings
   - Find "App passwords" (only appears if 2FA enabled)
   - Select "Mail" and "Other (custom name)"
   - Enter "Spacewars" as the app name
   - Google will generate a 16-character password

3. **Set Environment Variables**

   ```bash
   EMAIL_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=you@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=you@gmail.com
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

4. **Test the Setup**
   - Register with an email address
   - Check your Gmail inbox for verification email
   - Click the link to verify

### Local Development

#### Option 1: Docker Compose

Create `.env` file in workspace root:

```bash
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Then run:

```bash
npm run dev
```

#### Option 2: Devcontainer

Add to `.devcontainer/docker-compose.yml` environment section:

```yaml
services:
  dev:
    environment:
      - EMAIL_ENABLED=true
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_SECURE=false
      - SMTP_USER=your-email@gmail.com
      - SMTP_PASS=your-app-password
```

### Production Deployment

#### Render.yaml

Variables are already in `render.yaml`. Set them in Render dashboard:

1. Go to your Render service
2. Settings → Environment
3. Add/update:
   - `EMAIL_ENABLED`: `true`
   - `SMTP_HOST`: `smtp.gmail.com` (or your provider)
   - `SMTP_PORT`: `587`
   - `SMTP_SECURE`: `false`
   - `SMTP_USER`: `your-email@gmail.com`
   - `SMTP_PASS`: `your-app-password`
   - `NEXT_PUBLIC_BASE_URL`: `https://your-domain.com`

#### Docker Production

```bash
docker run -p 3000:3000 \
  -e EMAIL_ENABLED=true \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_SECURE=false \
  -e SMTP_USER=your-email@gmail.com \
  -e SMTP_PASS=your-app-password \
  -e NEXT_PUBLIC_BASE_URL=https://your-domain.com \
  -e SESSION_SECRET=your-secret-here \
  -e NODE_ENV=production \
  -e POSTGRES_HOST=your-postgres-host \
  spacewars3:latest
```

## SMTP Provider Guide

### Gmail (Recommended)

- **Host**: `smtp.gmail.com`
- **Port**: `587` (STARTTLS) or `465` (SSL/TLS)
- **Secure**: `false` (for 587) or `true` (for 465)
- **Setup**: Follow "Gmail (Quick Start)" above

### Microsoft Outlook / Office 365

- **Host**: `smtp.office365.com`
- **Port**: `587`
- **Secure**: `false`
- **User**: Your full email (e.g., `name@company.onmicrosoft.com`)
- **Pass**: Your Microsoft password

### SendGrid

- **Host**: `smtp.sendgrid.net`
- **Port**: `587`
- **Secure**: `false`
- **User**: `apikey`
- **Pass**: Your SendGrid API key
- **From**: Must be a verified sender in SendGrid

### AWS SES (Simple Email Service)

- **Host**: `email-smtp.{region}.amazonaws.com` (e.g., `email-smtp.us-east-1.amazonaws.com`)
- **Port**: `587`
- **Secure**: `false`
- **User**: Your SMTP username (from AWS SES console)
- **Pass**: Your SMTP password
- **Note**: Must verify sender email in SES

### MailerSend

- **Host**: `smtp.mailersend.net`
- **Port**: `587`
- **Secure**: `false`
- **User**: `MS_ACCOUNT_MAILER_EMAIL`
- **Pass**: Your API key

## Testing Email

### Manual Testing

1. **Start dev server**

   ```bash
   npm run dev
   ```

2. **Register with email**
   - Go to http://localhost:3000/login
   - Click "Sign Up"
   - Enter username, password, and email
   - Submit

3. **Check email**
   - Check your inbox (Gmail, Outlook, etc.)
   - Verify email arrives within 30 seconds
   - Click the verification link

4. **Test password reset**
   - Go to reset-password page
   - Enter your email
   - Check inbox for reset link
   - Click link to reset

### Debug Logging

When `EMAIL_ENABLED=false` (default), the system logs:

```
⚠️ Email not configured — skipping send to example@gmail.com
```

When `EMAIL_ENABLED=true`, successful sends log:

```
📧 Email sent to example@gmail.com: Verify your Spacewars: Ironcore email address
```

Failures log errors but never block the request:

```
❌ Failed to send email to example@gmail.com: Error message
```

## Implementation Details

### Code Structure

- **Config**: [src/lib/server/email/emailConfig.ts](src/lib/server/email/emailConfig.ts)
  - `isEmailEnabled()` — checks `EMAIL_ENABLED` env var
  - `getSmtpConfig()` — reads SMTP settings from env vars

- **Service**: [src/lib/server/email/emailService.ts](src/lib/server/email/emailService.ts)
  - `sendEmail(to, subject, html)` — sends email via nodemailer
  - Fire-and-forget: errors logged but don't block requests
  - Singleton pattern for SMTP transport

- **Templates**: [src/lib/server/email/emailTemplates.ts](src/lib/server/email/emailTemplates.ts)
  - `buildVerificationEmail()` — HTML verification email
  - `buildPasswordResetEmail()` — HTML reset email
  - Inline-styled HTML (email client compatible)

- **API Routes**:
  - [src/app/api/register/route.ts](src/app/api/register/route.ts) — sends verification on registration
  - [src/app/api/verify-email/route.ts](src/app/api/verify-email/route.ts) — verifies token and marks email as verified
  - [src/app/api/forgot-password/route.ts](src/app/api/forgot-password/route.ts) — initiates password reset
  - [src/app/api/reset-password/route.ts](src/app/api/reset-password/route.ts) — validates token and resets password

### Database

Email verification tokens stored in `users` table:

- `email` — user's email address (optional)
- `email_verified` — `true` if verified, `false` otherwise
- `verification_token` — one-time token for verification
- `verification_token_expires` — token expiration timestamp
- `password_reset_token` — one-time token for password reset
- `password_reset_token_expires` — token expiration timestamp

### Security

- **Token Entropy**: 256 bits (32 random bytes)
- **Token Expiry**: 24 hours for verification, 1 hour for reset
- **Single-Use**: Tokens consumed atomically (SQL `UPDATE ... RETURNING`)
- **No Email Leakage**: Password reset endpoint returns success regardless of whether email exists
- **Fire-and-Forget**: Email failures never block user registration
- **SSL/TLS**: Supports both STARTTLS (port 587) and direct TLS (port 465)

## Disabling Email

Email is disabled by default. To disable at any time:

```bash
EMAIL_ENABLED=false
```

Or simply don't set any SMTP variables. The system will log warnings when email is attempted without being configured, but the game continues to work normally.

## Troubleshooting

### "Email not configured" warning but I set variables

- Ensure `EMAIL_ENABLED=true` (case-sensitive, must be exact string)
- Verify variables are in `.env` file or environment
- Restart dev server after changing `.env`
- Check terminal output for the warning message

### Gmail: "Invalid credentials"

- Verify you generated an **App Password**, not a regular password
- App password must be from Google: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- Check 2-Factor Authentication is **enabled**
- Gmail app passwords are 16 characters with spaces — use exactly as provided

### Emails not arriving

1. Check spam/junk folder
2. Verify sender email (`SMTP_FROM`) is correct
3. Check server logs for send errors (run `npm run dev` and watch terminal)
4. For Outlook/Office365: verify account isn't in restricted mode
5. For SendGrid: ensure sender email is verified in SendGrid dashboard
6. Test with a different provider (Gmail is most reliable for testing)

### Port 465 vs 587

- **Port 587** (STARTTLS): Starts unencrypted, then upgrades to TLS → `SMTP_SECURE=false`
- **Port 465** (Implicit TLS): Encrypted from the start → `SMTP_SECURE=true`
- Most providers support both; 587 is more common

### "Too many login attempts"

- Gmail rate-limits failed login attempts
- Wait 24 hours or use a different Google account
- Verify your password and app-password are correct

## Testing with Tests

The email system includes comprehensive unit tests:

```bash
npm test -- src/__tests__/unit/email/
```

Tests verify:

- Config parsing from environment variables
- Email service gracefully skips when disabled
- Email templates generate valid HTML
- Nodemailer mock integration

## Next Steps

1. **Choose a provider** (Gmail recommended for testing)
2. **Generate credentials** (app password, API key, etc.)
3. **Set environment variables** in `.env` or deployment platform
4. **Enable** `EMAIL_ENABLED=true`
5. **Test** by registering and verifying email
6. **Deploy** with the same environment variables

## Support

For issues:

1. Check this guide's Troubleshooting section
2. Run tests: `npm test -- src/__tests__/unit/email/`
3. Check server logs for error messages
4. Verify SMTP provider credentials work in their web interface
