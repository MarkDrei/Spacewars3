import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getCacheManager } from '@/lib/server/cacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get user data from cache manager (much faster than DB)
    const cacheManager = getCacheManager();
    await cacheManager.initialize();
    
    const user = await cacheManager.getUser(session.userId);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    const now = Math.floor(Date.now() / 1000);
    user.updateStats(now);
    
    // Save updated user via cache manager (will persist periodically)
    await cacheManager.updateUser(user);
    
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
