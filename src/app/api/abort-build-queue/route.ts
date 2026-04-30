import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { TechService } from '@/lib/server/techs/TechService';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

/**
 * POST /api/abort-build-queue
 * Abort the authenticated user's entire build queue.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    console.log(`🛑 Abort build queue requested by user: ${session.userId}`);

    const context = createLockContext();
    const techService = TechService.getInstance();

    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return techService.abortBuildQueue(session.userId!, userContext);
    });

    return NextResponse.json({
      success: true,
      abortedCount: result.abortedCount,
      message: result.abortedCount > 0 ? 'Build queue aborted' : 'Build queue already empty'
    });
  } catch (error) {
    console.error('Abort build queue API error:', error);
    return handleApiError(error);
  }
}
