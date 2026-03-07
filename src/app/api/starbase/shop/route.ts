// GET /api/starbase/shop - Generate 10 random commanders for sale
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { Commander } from '@/lib/server/inventory/Commander';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json({});
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    requireAuth(session.userId);

    const commanders = Array.from({ length: 10 }, () => Commander.random().toJSON());
    session.starbaseShop = commanders;
    await session.save();

    return NextResponse.json({ commanders });
  } catch (error) {
    return handleApiError(error);
  }
}
