import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/errors';

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({ success: true });
    
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.destroy();
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
