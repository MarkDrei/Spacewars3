// ---
// POST /api/reset-password
// Consumes a password reset token and updates the user's password.
// ---

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getDatabase } from '@/lib/server/database';
import { consumePasswordResetToken, updateUserPassword } from '@/lib/server/user/userRepo';
import { handleApiError, ApiError } from '@/lib/server/errors';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new ApiError(400, 'Invalid or missing token');
    }
    if (!password || typeof password !== 'string' || password.length < 1) {
      throw new ApiError(400, 'Password is required');
    }

    const db = await getDatabase();
    const userId = await consumePasswordResetToken(db, token.trim());

    if (userId === null) {
      throw new ApiError(400, 'Invalid or expired reset token');
    }

    const newHash = await bcrypt.hash(password, 10);

    // Update password in DB
    await updateUserPassword(db, userId, newHash);

    // If the user is in the in-memory cache, update password_hash there too
    // to avoid stale credentials being accepted until the cache entry expires.
    try {
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const cache = UserCache.getInstance2();
        const cached = cache.getUserByIdFromCache(userCtx, userId);
        if (cached) {
          cached.password_hash = newHash;
        }
      });
    } catch {
      // Cache update is best-effort; DB is already updated
    }

    console.log(`✅ Password reset completed for user ID ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
