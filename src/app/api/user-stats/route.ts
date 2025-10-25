import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createLockContext, type LockContext as IronGuardLockContext, USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user';

// Type alias for user context
type UserContext = IronGuardLockContext<readonly [typeof USER_LOCK]>;

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
        // Get typed cache manager singleton
    const cacheManager = getTypedCacheManager();
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    
    // Execute with user lock (user-specific operation)
    const userCtx = await cacheManager.acquireUserLock(emptyCtx);
    try {
      // Get user data safely (we have user lock)
      let user = cacheManager.getUserUnsafe(session.userId!, userCtx);
      
      if (!user) {
        // Load user from database if not in cache
        const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
        try {
          user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
          if (!user) {
            throw new ApiError(404, 'User not found');
          }
          
          // Cache the loaded user
          cacheManager.setUserUnsafe(user, userCtx);
        } finally {
          dbCtx.dispose();
        }
      }
      
      // Continue with user stats logic
      return processUserStats(user, cacheManager, userCtx);
    } finally {
      userCtx.dispose();
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function processUserStats(user: User, cacheManager: TypedCacheManager, userCtx: UserContext): NextResponse {
  const now = Math.floor(Date.now() / 1000);
  user.updateStats(now);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  cacheManager.updateUserUnsafe(user, userCtx);
  
  const responseData = { 
    iron: user.iron, 
    ironPerSecond: user.getIronPerSecond(),
    last_updated: user.last_updated
  };
  
  return NextResponse.json(responseData);
}
