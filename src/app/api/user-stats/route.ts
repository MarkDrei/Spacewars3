import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { getUserById, saveUserToDb } from '@/lib/server/userRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const db = getDatabase();
    const user = await getUserById(db, session.userId, saveUserToDb(db));
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    const now = Math.floor(Date.now() / 1000);
    user.updateStats(now);
    await user.save();
    
    const responseData = { 
      iron: user.iron, 
      last_updated: user.last_updated, 
      ironPerSecond: user.getIronPerSecond() 
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    return handleApiError(error);
  }
}
