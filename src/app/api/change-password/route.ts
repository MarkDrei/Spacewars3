import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { ApiError, handleApiError, requireAuth, validateRequired } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { getDatabase } from '@/lib/server/database';
import { getAuthRateLimits, assertNotRateLimited } from '@/lib/server/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json().catch(() => null);
    const { currentPassword, newPassword, confirmPassword } = (body ?? {}) as Record<string, unknown>;

    validateRequired(currentPassword, 'currentPassword');
    validateRequired(newPassword, 'newPassword');
    validateRequired(confirmPassword, 'confirmPassword');

    if (newPassword !== confirmPassword) {
      throw new ApiError(400, 'New passwords do not match');
    }

    // A stolen session must not allow guessing the current password without limit
    const userId = session.userId!;
    const failedAttempts = getAuthRateLimits().changePasswordFailuresByUser;
    assertNotRateLimited(failedAttempts, String(userId));

    const emptyCtx = createLockContext();
    const userCache = UserCache.getInstance2();
    const db = await getDatabase();

    // bcrypt is deliberately slow (~50-100 ms per call). USER_LOCK is global, so the hash
    // comparison and the new hash are computed outside the lock: read the current hash under the
    // lock, verify/hash without it, then write under the lock if the hash did not change meanwhile.
    const currentHash = await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithoutRefreshWithLock(userContext, userId);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
      return user.password_hash;
    });

    if (!(await bcrypt.compare(currentPassword, currentHash))) {
      failedAttempts.hit(String(userId));
      throw new ApiError(400, 'Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);

    return await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithoutRefreshWithLock(userContext, userId);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
      if (user.password_hash !== currentHash) {
        throw new ApiError(409, 'Password was changed concurrently, please try again');
      }

      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
      user.password_hash = passwordHash;

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully',
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
