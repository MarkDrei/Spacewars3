import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { cookies } from 'next/headers';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';

/**
 * POST /api/messages/summarize
 * Summarize all messages for the authenticated user
 */
export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Look up user's preferred locale
    const userCache = UserCache.getInstance2();
    const ctx = createLockContext();
    let locale = 'en';
    await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
      const user = await userCache.getUserByIdWithLock(userCtx, session.userId!);
      if (user) {
        locale = user.preferredLocale ?? 'en';
      }
    });

    const messageCache = MessageCache.getInstance();
    const summary = await messageCache.summarizeMessages(ctx, session.userId, locale);

    return NextResponse.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error summarizing messages:', error);
    return NextResponse.json(
      { error: 'Failed to summarize messages' },
      { status: 500 }
    );
  }
}
