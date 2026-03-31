import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';
import { STATISTICS_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

/**
 * GET /api/statistics
 * Returns per-user and global statistics aggregates.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const statisticsCache = StatisticsCache.getInstance();
    const userId = session.userId!;

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      const user = statisticsCache.getUserStats(lockCtx, userId);
      const global = statisticsCache.getGlobalStats(lockCtx);

      return NextResponse.json({
        user,
        global: {
          totalPlayers: global.totalPlayers,
          totals: global.totals,
          averages: global.averages,
          top5: global.top5,
        },
        currentUserId: userId,
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
