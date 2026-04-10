import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { ApiError, handleApiError, requireAuth, validateRequired } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { getDatabase } from '@/lib/server/database';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    validateRequired(currentPassword, 'currentPassword');
    validateRequired(newPassword, 'newPassword');
    validateRequired(confirmPassword, 'confirmPassword');

    if (newPassword !== confirmPassword) {
      throw new ApiError(400, 'New passwords do not match');
    }

    const emptyCtx = createLockContext();
    const userCache = UserCache.getInstance2();
    const db = await getDatabase();

    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithLock(userContext, session.userId!);

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new ApiError(400, 'Current password is incorrect');
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
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
