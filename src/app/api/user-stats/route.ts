import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyContext, LockContext, Locked, CacheLevel, WorldLevel, UserLevel } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user';

// Type aliases for cleaner code
type UserContext = LockContext<Locked<'user'>, CacheLevel | WorldLevel | UserLevel>;

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
        // Get typed cache manager singleton
    const cacheManager = getTypedCacheManager();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute with user lock (user-specific operation)
    return await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      // Get user data safely (we have user lock)
      let user = cacheManager.getUserUnsafe(session.userId!, userCtx);
      
      if (!user) {
        // Load user from database if not in cache
        return await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
          user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
          if (!user) {
            throw new ApiError(404, 'User not found');
          }
          
          // Cache the loaded user
          cacheManager.setUserUnsafe(user, userCtx);
          
          // Continue with user stats logic
          return processUserStats(user, cacheManager, userCtx);
        });
      } else {
        // Continue with user stats logic directly
        return processUserStats(user, cacheManager, userCtx);
      }
    });
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
