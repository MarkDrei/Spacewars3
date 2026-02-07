import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { createLockContext, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { MessageCache } from '@/lib/server/messages/MessageCache';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const emptyCtx = createLockContext();
    // Get typed cache manager singleton
    const userWorldCache = UserCache.getInstance2();
    
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

function processUserStats(user: User, userWorldCache: UserCache, userCtx: LockContext<LocksAtMostAndHas4>): NextResponse {
  const now = Math.floor(Date.now() / 1000);
  const result = user.updateStats(now);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  userWorldCache.updateUserInCache(userCtx, user);
  
  // Send level-up notification if user leveled up from research
  if (result.levelUp) {
    const messageCache = MessageCache.getInstance();
    // Send notification asynchronously (fire and forget)
    messageCache.createMessage(
      userCtx,
      user.id,
      `P: 🎉 Level Up! You reached level ${result.levelUp.newLevel}! (+${result.levelUp.xpReward} XP from research completion)`
    ).catch(error => {
      console.error('Failed to send level-up notification:', error);
    });
  }
  
  const responseData = { 
    iron: user.iron, 
    ironPerSecond: user.getIronPerSecond(),
    last_updated: user.last_updated,
    maxIronCapacity: user.getMaxIronCapacity(),
    xp: user.xp,
    level: user.getLevel(),
    xpForNextLevel: user.getXpForNextLevel()
  };
  
  return NextResponse.json(responseData);
}
