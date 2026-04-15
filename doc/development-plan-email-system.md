# Development Plan: User Email (Optional Address Storage & Verification)

## Vision

As a player, I want to optionally provide an email address when registering, so that the game can verify I own that address and contact me if needed.

The system reads SMTP configuration from environment variables (following the existing `process.env` pattern used for database and session config). A config template and README instructions guide operators on how to set up SMTP credentials. When email is not configured the game continues to work exactly as before — email is entirely optional.

**Out of scope for this plan**: password reset, email-based login, mandatory verification gates.

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
  emailTemplates.ts      — HTML email templates (verification)
src/lib/server/user/
  userRepo.ts            — Modified: new columns in INSERT/UPDATE + token helpers
  user.ts                — Modified: new email field
src/lib/server/schema.ts — Modified: add email + verification columns
src/lib/server/migrations.ts — Modified: add migration v15
src/app/api/register/route.ts — Modified: accept email, send verification
src/app/api/verify-email/route.ts — New: verify email token
src/components/LoginPageComponent.tsx — Modified: add email field on sign-up
src/app/login/page.tsx — Modified: add email field + verified success message
src/lib/client/services/authService.ts — Modified: add email to register payload
src/lib/client/hooks/useAuth.ts — Modified: pass email param
README.md — Modified: add SMTP configuration section
docker-compose.yml — Modified: add SMTP env var placeholders
render.yaml — Modified: add SMTP env var placeholders
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
- All email sending is fire-and-forget from the caller's perspective — errors are logged but do not block the request. Registration endpoint returns success even if email sending fails.

#### Task 1.3: Create Email Templates

**Action**: Create `src/lib/server/email/emailTemplates.ts` with a function that returns an HTML string for the verification email.

**Files**:

- `src/lib/server/email/emailTemplates.ts` — new file

**Details**:
One template function:

- `buildVerificationEmail(username: string, verificationUrl: string): { subject: string; html: string }`

Templates should be simple, inline-styled HTML (no external CSS — email clients strip `<style>` tags). Include the game name "Spacewars: Ironstrike" in the header. Include token expiration info in the body.

#### Task 1.4: Update README with SMTP Configuration

**Action**: Add an "Email Configuration (Optional)" section to README.md, in the Environment Variables area.

**Files**:

- `README.md` — modified

**Details**:
Add a new subsection after the existing Environment Variables table:

```markdown
### Email Configuration (Optional)

Email is used for registration verification. If not configured, the game works without email — accounts are created immediately without verification.

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

### Goal 2: Database Schema Changes for Email Storage & Verification

**Description**: Add email address and email verification token columns to the users table.

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
email_verification_expires BIGINT DEFAULT NULL
```

- `email` is nullable — existing users and the default test user "a" don't have one.
- `email` should have a UNIQUE constraint on non-null values (PostgreSQL UNIQUE allows multiple NULLs by default, so `UNIQUE` on the column works).
- Token columns use BIGINT for Unix timestamps in milliseconds (consistent with `created_at` in messages table).

Migration v15:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires BIGINT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
```

#### Task 2.2: Update User Model and Repository

**Action**: Add new fields to `User` class, `UserRow` interface, `userFromRow()`, `saveUserToDb()`, and `createUser()`. Add standalone token helper functions.

**Files**:

- `src/lib/server/user/user.ts` — modified (add fields: `email`, `emailVerified`)
- `src/lib/server/user/userRepo.ts` — modified (UserRow, userFromRow, saveUserToDb, createUser, token helpers)

**Details**:

- `User` class gets: `email: string | null`, `emailVerified: boolean`
- Email verification tokens are NOT stored on the User object — they are read/written directly via repository functions (they are transient, not part of the cached user state).
- `saveUserToDb()` UPDATE adds `email = $N, email_verified = $N+1` — adjust parameter numbering accordingly.
- `createUser()` INSERT adds optional `email` parameter (default null).
- New standalone repo functions (not on User class):
  - `setEmailVerificationToken(db, userId, token, expiresAt)`
  - `consumeEmailVerificationToken(db, token)` → returns `userId` or null
  - `getUserByEmail(db, email)` → returns `UserRow | null`

**Quality Requirements**: Token consumption must be atomic — use `UPDATE ... SET token=NULL, expires=NULL WHERE token=$1 AND expires > $2 RETURNING id` to prevent race conditions.

#### Task 2.3: Write Tests for New Repo Functions

**Action**: Integration tests for token set/consume functions and email lookup.

**Files**:

- `src/__tests__/integration/api/email-tokens.test.ts` — new file

**Quality Requirements**: Use `withTransaction()` for isolation. Test token expiration, double-consumption prevention, and email uniqueness constraint.

---

### Goal 3: Registration with Optional Email and Verification

**Description**: Modify the registration flow to accept an optional email address. When email is enabled and provided, send a verification email with a token link. Users who skip email can register and play immediately — no verification gate.

#### Task 3.1: Modify Registration API Route

**Action**: Update `POST /api/register` to accept optional `email` field. When `EMAIL_ENABLED=true` and email is provided: generate verification token, store it, send verification email. When email is disabled or not provided: skip verification entirely (current behavior preserved).

**Files**:

- `src/app/api/register/route.ts` — modified

**Details**:

- Validate email format if provided (simple regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Check email uniqueness before creating user; return 400 if already taken
- Generate token: `crypto.randomBytes(32).toString('hex')`
- Token expiration: 24 hours from now
- Store token via `setEmailVerificationToken()`
- Build verification URL: `${BASE_URL}/api/verify-email?token=${token}`
- `BASE_URL` read from `process.env.NEXT_PUBLIC_BASE_URL` or inferred from request headers
- Send email fire-and-forget (don't await, don't fail registration if email fails)
- Return `{ success: true, emailSent: true }` or `{ success: true, emailSent: false }`

#### Task 3.2: Create Email Verification API Route

**Action**: Create `GET /api/verify-email?token=xxx` that validates and consumes the verification token, then sets `email_verified = true`.

**Files**:

- `src/app/api/verify-email/route.ts` — new file

**Details**:

- Read `token` from query params
- Call `consumeEmailVerificationToken(db, token)` — atomically validates and consumes
- If valid: set `email_verified = true` on user row directly (SQL UPDATE), redirect to `/login?verified=true`
- If invalid/expired: redirect to `/login?error=invalid-token`
- No authentication required (user clicks link from email before logging in)

#### Task 3.3: Update Registration UI

**Action**: Add optional email field to the sign-up form in `LoginPageComponent.tsx`. Show a success message when email was sent. Show a "verified" message when returning from the verification link.

**Files**:

- `src/components/LoginPageComponent.tsx` — modified
- `src/app/login/page.tsx` — modified
- `src/lib/client/services/authService.ts` — modified (add email to register payload)
- `src/lib/client/hooks/useAuth.ts` — modified (pass email param)

**Details**:

- Add email input field (type="email") shown only in Sign Up mode, below username
- Placeholder: "Email (optional — for account notifications)"
- Update `LoginCredentials` or create `RegisterCredentials` interface with optional `email?: string`
- Show success message after registration if `emailSent: true`: "Check your email to verify your account"
- Show `?verified=true` query param message on login page: "Email verified! You can now sign in."
- Show `?error=invalid-token` query param message on login page: "Email verification link is invalid or has expired."

#### Task 3.4: Write Tests for Registration with Email

**Action**: Unit tests for email validation, integration tests for the full registration + verification flow.

**Files**:

- `src/__tests__/unit/api/register-email-validation.test.ts` — new file
- `src/__tests__/integration/api/register-email-flow.test.ts` — new file

**Quality Requirements**: Test email format validation, email uniqueness rejection, token generation, token consumption, and `email_verified` flag set to true after verification.

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

3. **Fire-and-forget email sending**: Email delivery failures must not block user registration. Errors are logged but requests succeed regardless.

4. **Token-based verification**: Using `crypto.randomBytes(32)` (256 bits of entropy) for tokens. Tokens are single-use (consumed atomically via SQL `UPDATE ... RETURNING`) and time-limited to 24 hours.

5. **No separate token table**: Verification tokens are stored directly on the users table. This avoids a separate table + cleanup job. Token columns are nullable and cleared on consumption.

6. **Email is optional on registration**: Existing users without email continue to work. New users can register without email. This maintains backward compatibility with the test user "a".

7. **Nodemailer over API-based services**: Nodemailer is the standard Node.js SMTP library, lightweight, and works with any SMTP provider (Gmail, Mailgun, self-hosted, etc.).

8. **Verification tokens stored in DB, not in User cache**: Verification tokens are transient security artifacts. They must NOT be cached in UserCache (which is for game state). They're read/written directly via SQL.

9. **No verification gate**: Unverified users play immediately. `email_verified` is stored but not enforced as a login requirement. It is available for future use (e.g., notifications).

## Agent Decisions

1. **Chose `process.env` over a JSON/YAML config file**: Consistent with the entire project. README documents which env vars to set.

2. **Made email nullable on users table**: Rather than requiring all existing users to have an email (breaking migration), `email` is nullable.

3. **Decided against email-based login**: The game uses username-based login. Email is stored for contact/verification only.

4. **Placed token operations in userRepo.ts, not on User class**: Tokens are consumed by unauthenticated endpoints (verify-email) where we don't have a full User object loaded via cache. Direct DB operations are simpler and avoid cache coherency issues.

5. **Chose 24h for email verification token**: Standard security practice. Users may not check email immediately, so a longer window reduces friction.

6. **Password reset is out of scope**: The problem statement asks to "implement the user email possibility", which is satisfied by storing and verifying an email address. Password reset can be added in a follow-up plan as a separate feature.

---

## Implementation Status

**Status**: ✅ COMPLETED

**Implementation Summary**: Full optional email support implemented — users can provide an email at registration; when email is configured (EMAIL_ENABLED=true), a verification token is generated and a verification email is sent fire-and-forget. The verify-email endpoint atomically consumes the token and marks the user as verified. When email is disabled (default), registration behaves exactly as before.

**Files Modified/Created**:
- `src/lib/server/email/emailConfig.ts` — New: SMTP env var reader with isEmailEnabled() helper
- `src/lib/server/email/emailService.ts` — New: nodemailer wrapper with fire-and-forget sendEmail()
- `src/lib/server/email/emailTemplates.ts` — New: HTML verification email template
- `src/lib/server/schema.ts` — Added email columns to CREATE_USERS_TABLE; added MIGRATE_ADD_EMAIL; bumped SCHEMA_VERSION to 15
- `src/lib/server/migrations.ts` — Added applyEmailColumnsMigration() and wired it into applyAllMigrations()
- `src/lib/server/user/user.ts` — Added email: string|null and emailVerified: boolean fields
- `src/lib/server/user/userRepo.ts` — Updated UserRow interface, userFromRow, createUser, createUserWithoutShip, createUserWithShip, saveUserToDb; added setEmailVerificationToken, consumeEmailVerificationToken, getUserByEmail
- `src/app/api/register/route.ts` — Updated: email validation, uniqueness check, token generation, fire-and-forget send
- `src/app/api/verify-email/route.ts` — New: GET endpoint that consumes token and redirects
- `src/components/LoginPageComponent.tsx` — Updated: email field in sign-up, success message, query param banners, verifiedParam/errorParam props
- `src/app/login/page.tsx` — Converted to server component wrapper that reads searchParams and passes to LoginPageComponent
- `src/lib/client/services/authService.ts` — Added RegisterCredentials interface with optional email; updated register()
- `src/lib/client/hooks/useAuth.ts` — Updated register() to accept optional email
- `docker-compose.yml` — Added SMTP env var placeholders
- `render.yaml` — Added SMTP env var placeholders
- `README.md` — Added Email Configuration section
- `src/__tests__/unit/email/emailConfig.test.ts` — New: unit tests for config parsing
- `src/__tests__/unit/email/emailService.test.ts` — New: unit tests for service (nodemailer mocked)
- `src/__tests__/unit/email/emailTemplates.test.ts` — New: unit tests for template generation
- `src/__tests__/integration/api/email-tokens.test.ts` — New: integration tests for token helpers
- `src/__tests__/integration/api/register-email-flow.test.ts` — New: integration tests for register+verify flow

**Deviations from Plan**:
- `src/app/login/page.tsx` was converted from a client component (with duplicated logic) to a thin server component wrapper that delegates to LoginPageComponent. This is a better design: avoids duplicating all the form logic and avoids the useSearchParams/Suspense issue in Next.js 15.
- `LoginPageComponent` props changed to accept `verifiedParam` and `errorParam` directly (from server-side props) instead of reading useSearchParams internally. This is more testable and avoids the Suspense boundary requirement.

**Arc42 Updates**: None required (infra/config changes are self-documenting via README and env var names)

**Test Results**: ✅ 1526 tests passing, no linting errors, no typecheck errors, build succeeds

---

**Review Status**: ⚠️ NEEDS REVISION
**Reviewer**: Medicus

**Issues Found**:

1. **Dead UI code — `successMessage` never rendered (Plan requirement not met)**
   In `src/components/LoginPageComponent.tsx` lines 78–81:
   ```javascript
   if (result.emailSent) {
     setSuccessMessage('Account created! Check your email to verify your address.');
   }
   router.push('/game');
   ```
   `setSuccessMessage` schedules a React state update (async), but `router.push('/game')` is called immediately after — the component navigates away before the state update is applied and re-rendered. The message is **never visible**. Users who provide an email and receive a verification email are never told to check it.
   The plan explicitly requires: *"Show success message after registration if emailSent: true"*. This requirement is not met.

2. **Race condition produces misleading error message (Minor)**
   The email uniqueness pre-check (`getUserByEmail` → throw 400 "Email already in use") is a TOCTOU pattern. In the extremely rare case of two concurrent registrations with the same email, both pass the pre-check, one INSERT succeeds, and the second triggers the `idx_users_email` unique constraint violation. `handleApiError` catches `'duplicate key value violates unique constraint'` and returns `{ error: 'Username taken', status: 400 }` — a misleading message. The DB constraint prevents duplicate data (safe), but the error is confusing.

**Required Changes**:

1. **Fix `successMessage` visibility** in `LoginPageComponent.tsx`:
   When `emailSent` is true, do **not** call `router.push('/game')` immediately. The user is already authenticated (session cookie is set), so they can still access the game — but they need to see the message first.
   Recommended fix:
   ```javascript
   if (result.success) {
     if (result.emailSent) {
       setSuccessMessage('Account created! Check your email to verify your address.');
       // Do NOT navigate — let the user read the message.
       // They are already logged in; the game link will work when they choose to proceed.
     } else {
       router.push('/game');
     }
   }
   ```
   Then ensure the form area shows a "Go to game" button or auto-navigates after a brief delay (a `setTimeout` of 3–5 seconds is acceptable).

2. **Fix misleading error on email constraint race** in `handleApiError` in `src/lib/server/errors.ts` (or catch it in the register route):
   Add a specific check for the email index violation before the generic duplicate-key handler:
   ```javascript
   if (error.message.includes('idx_users_email') || error.message.includes('email')) {
     return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
   }
   ```
   Alternatively, catch the DB error inside the `createUserWithShip` call in the register route and re-throw a typed `ApiError(400, 'Email already in use')`.
