import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';

/**
 * POST /api/messages/summarize
 * Summarize all unread messages for the authenticated user in the user's preferred locale.
 *
 * Locking: USER_LOCK (4) is released before MessageCache acquires MESSAGE_LOCK (8).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId!;

    // Only the locale is needed, so no stats refresh of the user
    const locale = await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await UserCache.getInstance2().getUserByIdWithoutRefreshWithLock(userContext, userId);
      return user?.preferredLocale ?? 'en';
    });

    const summary = await MessageCache.getInstance().summarizeMessages(createLockContext(), userId, locale);

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
