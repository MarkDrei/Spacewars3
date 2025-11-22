import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache, userCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { createLockContext, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const emptyCtx = createLockContext();
    // Get typed cache manager singleton
    const userWorldCache = await getUserWorldCache(emptyCtx);
    
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Get user data safely (we have user lock)
      const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
      
      if (!user) {
        console.log(`❌ User not found: ${session.userId}`);
        throw new ApiError(404, 'User not found');
      }
      
      // Continue with user stats logic
      return processUserStats(user, userWorldCache, userContext);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function processUserStats(user: User, userWorldCache: userCache, userCtx: LockContext<LocksAtMostAndHas4>): NextResponse {
  const now = Math.floor(Date.now() / 1000);
  user.updateStats(now);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  userWorldCache.updateUserInCache(userCtx, user);
  
  const responseData = { 
    iron: user.iron, 
    ironPerSecond: user.getIronPerSecond(),
    last_updated: user.last_updated
  };
  
  return NextResponse.json(responseData);
}
