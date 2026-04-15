# Development Plan: Email System (Registration Confirmation & Password Reset)

## Vision

As a player, I want to register with an email address and receive a confirmation email, and be able to reset my password via email, so that my account is secure and recoverable.

The system reads SMTP configuration from environment variables (following the existing `process.env` pattern used for database and session config). A config template and README instructions guide operators on how to set up SMTP credentials.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively (`import`/`export` only, no CommonJS)
- **Email**: `nodemailer` (SMTP transport)
- **Tokens**: Node.js built-in `crypto.randomBytes()` for secure token generation

## Project Structure (New/Modified Files)

```
src/lib/server/email/
  emailService.ts        — SMTP transport wrapper, send helpers
  emailConfig.ts         — Read SMTP env vars, validate config
  emailTemplates.ts      — HTML email templates (registration, password reset)
src/lib/server/user/
  userRepo.ts            — Modified: new columns in INSERT/UPDATE
  user.ts                — Modified: new email field
src/lib/server/schema.ts — Modified: add email columns + password_reset columns
src/lib/server/migrations.ts — Modified: add migration v15
src/app/api/register/route.ts — Modified: accept email, send verification
src/app/api/verify-email/route.ts — New: verify email token
src/app/api/request-password-reset/route.ts — New: request password reset
src/app/api/reset-password/route.ts — New: consume token, set new password
src/components/LoginPageComponent.tsx — Modified: add email field on sign-up
src/app/login/page.tsx — Modified: add email field + forgot password link
src/components/ForgotPassword/ — New: forgot password form + reset form
README.md — Modified: add SMTP configuration section
```

## Goals

### Goal 1: SMTP Configuration Infrastructure

**Description**: Establish a pattern for reading SMTP configuration from environment variables, with a documented template and README instructions for operators.

**Quality Requirements**: Config validation at startup; graceful degradation if SMTP is not configured (log warning, skip email sending); no credentials in source code.

#### Task 1.1: Create SMTP Config Reader

**Action**: Create `src/lib/server/email/emailConfig.ts` that reads SMTP settings from `process.env`, following the existing pattern in `database.ts` → `getDatabaseConfig()`.

**Files**:

- `src/lib/server/email/emailConfig.ts` — new file

**Details**:
Environment variables to read:

- `SMTP_HOST` — SMTP server hostname (e.g., `smtp.gmail.com`)
- `SMTP_PORT` — SMTP port (default: `587`)
- `SMTP_SECURE` — Use TLS directly (default: `false`; port 465 = true)
- `SMTP_USER` — SMTP username / email address
- `SMTP_PASS` — SMTP password or app-specific password
- `SMTP_FROM` — "From" address for outgoing emails (default: `SMTP_USER`)
- `EMAIL_ENABLED` — Master toggle (default: `false`). When `false`, email functions log a warning and return without sending.

Export a `getSmtpConfig()` function returning a typed `SmtpConfig` interface. Export an `isEmailEnabled()` helper.

#### Task 1.2: Create Email Service

**Action**: Create `src/lib/server/email/emailService.ts` — a thin wrapper around `nodemailer` that creates a reusable SMTP transport and exposes `sendEmail(to, subject, html)`.

**Files**:

- `src/lib/server/email/emailService.ts` — new file

**Details**:

- Lazily create the nodemailer transport on first use (singleton pattern, stored in `globalThis` for test isolation).
- If `isEmailEnabled()` returns false, log `⚠️ Email not configured — skipping send to <address>` and return silently.
- Use `resetInstance()` static method for test isolation (consistent with UserCache, WorldCache pattern).
- All email sending is fire-and-forget from the caller's perspective — errors are logged but do not block the request. Registration and password-reset endpoints return success even if email sending fails.

#### Task 1.3: Create Email Templates

**Action**: Create `src/lib/server/email/emailTemplates.ts` with functions that return HTML strings for each email type.

**Files**:

- `src/lib/server/email/emailTemplates.ts` — new file

**Details**:
Two template functions:

- `buildVerificationEmail(username: string, verificationUrl: string): { subject: string; html: string }`
- `buildPasswordResetEmail(username: string, resetUrl: string): { subject: string; html: string }`

Templates should be simple, inline-styled HTML (no external CSS — email clients strip `<style>` tags). Include the game name "Spacewars: Ironstrike" in the header. Include token expiration info in the body.

#### Task 1.4: Update README with SMTP Configuration

**Action**: Add an "Email Configuration (Optional)" section to README.md, in the Environment Variables area.

**Files**:

- `README.md` — modified

**Details**:
Add a new subsection after the existing Environment Variables table:

```markdown
### Email Configuration (Optional)

Email is used for registration verification and password reset. If not configured, the game works without email — accounts are created immediately without verification.

| Variable        | Description                            | Default             |
| --------------- | -------------------------------------- | ------------------- |
| `EMAIL_ENABLED` | Enable email sending                   | `false`             |
| `SMTP_HOST`     | SMTP server hostname                   | —                   |
| `SMTP_PORT`     | SMTP server port                       | `587`               |
| `SMTP_SECURE`   | Use direct TLS (port 465)              | `false`             |
| `SMTP_USER`     | SMTP username / email address          | —                   |
| `SMTP_PASS`     | SMTP password or app-specific password | —                   |
| `SMTP_FROM`     | "From" address for outgoing emails     | Same as `SMTP_USER` |

**Gmail Example:**

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password at https://myaccount.google.com/apppasswords
3. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app-password>`
```

#### Task 1.5: Update docker-compose.yml and render.yaml

**Action**: Add SMTP environment variables (with empty/disabled defaults) to docker-compose.yml `dev` and `prod` services. Add placeholders to render.yaml.

**Files**:

- `docker-compose.yml` — modified
- `render.yaml` — modified

#### Task 1.6: Write Unit Tests for Email Config and Service

**Action**: Test `getSmtpConfig()` parsing, `isEmailEnabled()` toggle, and that `EmailService` gracefully skips when disabled.

**Files**:

- `src/__tests__/unit/email/emailConfig.test.ts` — new file
- `src/__tests__/unit/email/emailService.test.ts` — new file
- `src/__tests__/unit/email/emailTemplates.test.ts` — new file

**Quality Requirements**: No real SMTP connection in tests. Mock `nodemailer.createTransport`. Test that `sendEmail()` does nothing when `EMAIL_ENABLED=false`.

---

### Goal 2: Database Schema Changes for Email & Password Reset

**Description**: Add email address, email verification, and password reset token columns to the users table.

**Quality Requirements**: Migration must be idempotent (`ADD COLUMN IF NOT EXISTS`). Existing users without email continue to work (columns are nullable or have defaults).

#### Task 2.1: Add Columns to Schema and Migration

**Action**: Add new columns to `CREATE_USERS_TABLE` in schema.ts. Add migration v15 in migrations.ts. Bump `SCHEMA_VERSION` to 15.

**Files**:

- `src/lib/server/schema.ts` — modified
- `src/lib/server/migrations.ts` — modified

**Details**:
New columns:

```sql
email TEXT DEFAULT NULL,
email_verified BOOLEAN NOT NULL DEFAULT FALSE,
email_verification_token TEXT DEFAULT NULL,
email_verification_expires BIGINT DEFAULT NULL,
password_reset_token TEXT DEFAULT NULL,
password_reset_expires BIGINT DEFAULT NULL
```

- `email` is nullable — existing users and the default test user "a" don't have one.
- `email` should have a UNIQUE constraint, but only on non-null values (PostgreSQL UNIQUE allows multiple NULLs by default, so `UNIQUE` on the column works).
- Token columns use BIGINT for Unix timestamps in milliseconds (consistent with `created_at` in messages table).

Migration v15:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires BIGINT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires BIGINT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
```

#### Task 2.2: Update User Model and Repository

**Action**: Add new fields to `User` class, `UserRow` interface, `userFromRow()`, `saveUserToDb()`, and `createUser()`.

**Files**:

- `src/lib/server/user/user.ts` — modified (add fields: `email`, `emailVerified`)
- `src/lib/server/user/userRepo.ts` — modified (UserRow, userFromRow, saveUserToDb, createUser)

**Details**:

- `User` class gets: `email: string | null`, `emailVerified: boolean`
- Password reset tokens are NOT stored on the User object — they are read/written directly via repository functions (they are transient, not part of the cached user state).
- `saveUserToDb()` UPDATE adds `email = $27, email_verified = $28` — WHERE id shifts to `$29`.
- `createUser()` INSERT adds `email` parameter.
- New standalone repo functions (not on User class):
  - `setEmailVerificationToken(db, userId, token, expiresAt)`
  - `consumeEmailVerificationToken(db, token)` → returns `userId` or null
  - `setPasswordResetToken(db, userId, token, expiresAt)`
  - `consumePasswordResetToken(db, token)` → returns `userId` or null
  - `getUserByEmail(db, email)` → returns `UserRow | null`

**Quality Requirements**: Token consumption must be atomic — use `UPDATE ... SET token=NULL, expires=NULL WHERE token=$1 AND expires > $2 RETURNING id` to prevent race conditions.

#### Task 2.3: Write Tests for New Repo Functions

**Action**: Integration tests for token set/consume functions and email lookup.

**Files**:

- `src/__tests__/integration/api/email-tokens.test.ts` — new file

**Quality Requirements**: Use `withTransaction()` for isolation. Test token expiration, double-consumption prevention, and email uniqueness constraint.

---

### Goal 3: Registration with Email Verification

**Description**: Modify the registration flow to accept an optional email address. When email is enabled and provided, send a verification email with a token link.

#### Task 3.1: Modify Registration API Route

**Action**: Update `POST /api/register` to accept optional `email` field. When `EMAIL_ENABLED=true` and email is provided: generate verification token, store it, send verification email. When email is disabled: skip verification entirely (current behavior preserved).

**Files**:

- `src/app/api/register/route.ts` — modified

**Details**:

- Validate email format if provided (simple regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Check email uniqueness before creating user
- Generate token: `crypto.randomBytes(32).toString('hex')`
- Token expiration: 24 hours from now
- Store token via `setEmailVerificationToken()`
- Build verification URL: `${BASE_URL}/api/verify-email?token=${token}`
- `BASE_URL` read from `process.env.NEXT_PUBLIC_BASE_URL` or inferred from request headers
- Send email fire-and-forget (don't await, don't fail registration if email fails)
- Return `{ success: true, emailSent: true }` or `{ success: true, emailSent: false }`

#### Task 3.2: Create Email Verification API Route

**Action**: Create `GET /api/verify-email?token=xxx` that validates and consumes the verification token.

**Files**:

- `src/app/api/verify-email/route.ts` — new file

**Details**:

- Read `token` from query params
- Call `consumeEmailVerificationToken(db, token)` — atomically validates and consumes
- If valid: set `email_verified = true` on user, redirect to `/login?verified=true`
- If invalid/expired: redirect to `/login?error=invalid-token`
- No authentication required (user clicks link from email before logging in)

#### Task 3.3: Update Registration UI

**Action**: Add optional email field to the sign-up form in `LoginPageComponent.tsx` and `src/app/login/page.tsx`.

**Files**:

- `src/components/LoginPageComponent.tsx` — modified
- `src/app/login/page.tsx` — modified
- `src/lib/client/services/authService.ts` — modified (add email to register payload)
- `src/lib/client/hooks/useAuth.ts` — modified (pass email param)

**Details**:

- Add email input field (type="email") shown only in Sign Up mode, below username
- Placeholder: "Email (optional — for password recovery)"
- Update `LoginCredentials` or create `RegisterCredentials` interface with optional `email`
- Show success message after registration if `emailSent: true`: "Check your email to verify your account"
- Show `?verified=true` query param message on login page: "Email verified! You can now sign in."

#### Task 3.4: Write Tests for Registration with Email

**Action**: Unit tests for email validation, integration tests for the full registration + verification flow.

**Files**:

- `src/__tests__/unit/api/register-email-validation.test.ts` — new file
- `src/__tests__/integration/api/register-email-flow.test.ts` — new file

---

### Goal 4: Password Reset Flow

**Description**: Allow users to request a password reset via email. A token is sent to their registered email, which lets them set a new password.

#### Task 4.1: Create Password Reset Request API Route

**Action**: Create `POST /api/request-password-reset` that accepts `{ email }`, generates a reset token, and sends a password reset email.

**Files**:

- `src/app/api/request-password-reset/route.ts` — new file

**Details**:

- Accept `{ email }` in request body
- Look up user by email via `getUserByEmail(db, email)`
- **Security**: Always return success even if email not found (prevent email enumeration)
- If user found and email is verified: generate token (`crypto.randomBytes(32).toString('hex')`), 1-hour expiration
- Store via `setPasswordResetToken(db, userId, token, expiresAt)`
- Build reset URL: `${BASE_URL}/login?reset-token=${token}`
- Send email fire-and-forget
- Rate limiting consideration: documented in Architecture Notes (not implemented in v1, but token expiration prevents abuse)
- No authentication required

#### Task 4.2: Create Password Reset Execution API Route

**Action**: Create `POST /api/reset-password` that accepts `{ token, newPassword }`, validates the token, and updates the password.

**Files**:

- `src/app/api/reset-password/route.ts` — new file

**Details**:

- Accept `{ token, newPassword }` in request body
- Validate `newPassword` is non-empty
- Call `consumePasswordResetToken(db, token)` — atomic validation + consumption
- If valid: hash new password with bcrypt, update user's `password_hash` in DB
- Invalidate UserCache entry for this user (force re-read from DB)
- Return `{ success: true }`
- If invalid/expired: return `{ error: 'Invalid or expired reset link' }` (400)

#### Task 4.3: Create Password Reset UI Components

**Action**: Add "Forgot Password?" link to login form. Create forgot-password and reset-password form components.

**Files**:

- `src/components/LoginPageComponent.tsx` — modified (add "Forgot Password?" link)
- `src/app/login/page.tsx` — modified (handle `?reset-token=` query param)
- `src/components/ForgotPassword/ForgotPasswordForm.tsx` — new file
- `src/components/ForgotPassword/ResetPasswordForm.tsx` — new file
- `src/app/login/LoginPage.css` — modified (styles for new forms)

**Details**:

- "Forgot Password?" link below sign-in form toggles to a "forgot password" view
- Forgot password view: email input + submit button → calls `POST /api/request-password-reset`
- Shows "If that email is registered, a reset link has been sent" (always, for security)
- When login page loads with `?reset-token=xxx` query param: show reset form instead
- Reset form: new password + confirm password → calls `POST /api/reset-password`
- On success: redirect to login with `?password-reset=true` message

#### Task 4.4: Write Tests for Password Reset

**Action**: Unit tests for token validation, integration tests for the full reset flow.

**Files**:

- `src/__tests__/unit/api/password-reset-validation.test.ts` — new file
- `src/__tests__/integration/api/password-reset-flow.test.ts` — new file

**Quality Requirements**: Test expired token rejection, double-use prevention, email enumeration protection (same response for existing/non-existing emails).

---

## Dependencies

- `nodemailer` (npm package) — SMTP email transport
- `@types/nodemailer` (devDependency) — TypeScript types for nodemailer

No other new dependencies needed — `crypto` is built into Node.js.

## Arc42 Documentation Updates

**Proposed Changes**:

- **Section 3 (Context and Scope)**: Add SMTP server as external system in context diagram
- **Section 5 (Building Block View)**: Add email service building block under server-side components
- **Section 8 (Crosscutting Concepts)**: Document email configuration pattern and graceful degradation

## Architecture Notes

### Design Decisions

1. **Environment variables over config file**: The project already uses `process.env` exclusively for all configuration (database, session, etc.). Introducing a separate config file would be inconsistent. Instead, SMTP config follows the same `process.env` pattern. Docker Compose, Render, and devcontainer all support env vars natively.

2. **Graceful degradation**: Email is optional. When `EMAIL_ENABLED=false` (default), the game works exactly as before — no email required for registration or login. This ensures zero friction for local development and testing.

3. **Fire-and-forget email sending**: Email delivery failures must not block user registration or password reset requests. Errors are logged but requests succeed regardless.

4. **Token-based verification**: Using `crypto.randomBytes(32)` (256 bits of entropy) for tokens. Tokens are single-use (consumed atomically via SQL `UPDATE ... RETURNING`) and time-limited.

5. **No separate token table**: Verification and reset tokens are stored directly on the users table. This avoids a separate table + cleanup job. Tokens are nullable and cleared on consumption.

6. **Email is optional on registration**: Existing users without email continue to work. New users can register without email — they just can't use password reset. This maintains backward compatibility with the test user "a".

7. **Nodemailer over API-based services**: The user requested SMTP specifically. Nodemailer is the standard Node.js SMTP library, lightweight, and works with any SMTP provider (Gmail, Mailgun, self-hosted, etc.).

8. **Password reset token stored in DB, not in User cache**: Reset tokens are transient security artifacts. They should NOT be cached in UserCache (which is for game state). They're read/written directly via SQL to avoid cache invalidation complexity.

## Agent Decisions

1. **Chose `process.env` over a JSON/YAML config file**: The entire project uses `process.env` for configuration. A separate config file would be inconsistent and require new file-reading infrastructure. The README documents which env vars to set, and a `.env.example` section shows the format.

2. **Made email nullable on users table**: Rather than requiring all existing users to have an email (breaking migration), `email` is nullable. This means password reset is only available to users who provided an email at registration.

3. **Decided against email-based login**: The game uses username-based login. Adding email as a login method would be a larger scope change. Password reset uses email to deliver the token, but login remains username + password.

4. **Placed token operations in userRepo.ts, not on User class**: Tokens are consumed by unauthenticated endpoints (verify-email, reset-password) where we don't have a full User object loaded via cache. Direct DB operations are simpler and avoid cache coherency issues.

5. **Chose 24h for email verification, 1h for password reset**: Standard security practice. Verification is less time-sensitive (user may not check email immediately). Password reset should be short-lived to minimize exposure.

6. **No rate limiting in v1**: Token expiration provides basic abuse protection. Rate limiting for password reset requests is noted as a future enhancement in Technical Debt.

## Resolved Questions

1. **Email optional on registration** — even when `EMAIL_ENABLED=true`, email stays optional. Users who skip email can't use password reset but can register and play normally.
2. **No login blocking** — unverified users play immediately. Verification only gates password reset functionality.
3. **`NEXT_PUBLIC_BASE_URL` env var** — explicit env var for building email links (e.g., `https://spacewars-nextjs.onrender.com`). Added to README env var table.
