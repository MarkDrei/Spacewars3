// ---
// POST /api/forgot-password
// Initiates password reset: if the email is registered, sends a reset link.
// Always responds with 200 to avoid leaking whether an email exists.
// ---

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getDatabase } from '@/lib/server/database';
import { getUserByEmail, setPasswordResetToken } from '@/lib/server/user/userRepo';
import { isEmailEnabled } from '@/lib/server/email/emailConfig';
import { sendEmail } from '@/lib/server/email/emailService';
import { buildPasswordResetEmail } from '@/lib/server/email/emailTemplates';
import { handleApiError } from '@/lib/server/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Token expiry: 1 hour
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const email: unknown = body?.email;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      // Still 200 — no information leakage
      return NextResponse.json({ success: true });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const db = await getDatabase();
    const user = await getUserByEmail(db, normalizedEmail);

    if (!user || !isEmailEnabled()) {
      // Silently succeed — do not reveal whether the email is registered
      return NextResponse.json({ success: true });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;

    await setPasswordResetToken(db, user.id, token, expiresAt);

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      `${request.headers.get('x-forwarded-proto') ?? 'http'}://${request.headers.get('host') ?? 'localhost:3000'}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const { subject, html, text } = await buildPasswordResetEmail(user.username, resetUrl, user.preferred_locale ?? 'en');
    // Fire-and-forget — email failure must never block this endpoint
    void sendEmail(normalizedEmail, subject, html, text);

    console.log(`🔑 Password reset token set for user ${user.username} (ID: ${user.id})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
