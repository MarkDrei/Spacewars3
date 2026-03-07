// GET /api/starbase/shop - Generate 10 random commanders for sale
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { Commander } from '@/lib/server/inventory/Commander';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const commanders = Array.from({ length: 10 }, () => Commander.random().toJSON());
    const response = NextResponse.json({ commanders });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    requireAuth(session.userId);

    session.starbaseShop = commanders;
    await session.save();

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
