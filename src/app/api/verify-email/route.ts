// ---
// GET /api/verify-email?token=xxx
// Validates and consumes the verification token, then redirects to login.
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/server/database';
import { consumeEmailVerificationToken } from '@/lib/server/user/userRepo';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || token.trim() === '') {
    return NextResponse.redirect(new URL('/login?error=invalid-token', request.url));
  }

  try {
    const db = await getDatabase();
    const userId = await consumeEmailVerificationToken(db, token);

    if (userId === null) {
      // Token not found or expired
      return NextResponse.redirect(new URL('/login?error=invalid-token', request.url));
    }

    console.log(`✅ Email verified for user ID ${userId}`);
    return NextResponse.redirect(new URL('/login?verified=true', request.url));
  } catch (err) {
    console.error('❌ Error during email verification:', err);
    return NextResponse.redirect(new URL('/login?error=invalid-token', request.url));
  }
}
