// GET /api/starbase/shop - Generate 10 random commanders for sale
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { StarbaseShop } from '@/lib/server/starbase/StarbaseShop';

export const dynamic = 'force-dynamic';

/**
 * GET /api/starbase/shop
 * Generates a fresh set of offers for the user and stores it on the server (replacing earlier ones).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId!;

    const commanders = await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) =>
      StarbaseShop.getInstance().generateOffers(userContext, userId)
    );

    return NextResponse.json({ commanders });
  } catch (error) {
    return handleApiError(error);
  }
}
