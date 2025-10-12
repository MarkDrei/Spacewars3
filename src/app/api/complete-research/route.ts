import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
import { updateTechTree } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyContext, LockContext, Locked, CacheLevel, WorldLevel, UserLevel } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user';

// Type aliases for cleaner code
type UserContext = LockContext<Locked<'user'>, CacheLevel | WorldLevel | UserLevel>;

/**
 * POST /api/complete-research
 * Instantly complete the active research by fast-forwarding its completion time
 * Only works for usernames "a" or "q"
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    console.log(`🎮 Cheat: Complete research requested by user: ${session.userId}`);
    
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    const emptyCtx = createEmptyContext();
    
    return await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
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
          
          // Continue with research completion logic
          return performResearchCompletion(user, cacheManager, userCtx);
        });
      } else {
        // Continue with research completion logic directly
        return performResearchCompletion(user, cacheManager, userCtx);
      }
    });
  } catch (error) {
    console.error('Complete research API error:', error);
    return handleApiError(error);
  }
}

function performResearchCompletion(
  user: User,
  cacheManager: TypedCacheManager,
  userCtx: UserContext
): NextResponse {
  // Check if user is authorized for cheat mode
  if (user.username !== 'a' && user.username !== 'q') {
    console.log(`❌ Cheat mode denied for user: ${user.username}`);
    throw new ApiError(403, 'Cheat mode only available for developers');
  }
  
  console.log(`🔓 Cheat mode authorized for developer: ${user.username}`);
  
  const now = Math.floor(Date.now() / 1000);
  user.updateStats(now);
  
  // Check if there's an active research
  if (!user.techTree.activeResearch) {
    console.log(`📭 No active research for user: ${user.username}`);
    return NextResponse.json({
      success: false,
      message: 'No active research to complete'
    });
  }
  
  const activeResearch = user.techTree.activeResearch;
  const researchType = activeResearch.type;
  
  console.log(`⚡ Fast-forwarding time to complete research: ${researchType} for user: ${user.username}`);
  
  // Complete the research by advancing time equal to remaining duration
  // This ensures updateTechTree completes the research naturally
  const remainingDuration = activeResearch.remainingDuration;
  updateTechTree(user.techTree, remainingDuration);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  cacheManager.updateUserUnsafe(user, userCtx);
  
  console.log(`✅ Cheat completed research: ${researchType} for user: ${user.username}`);
  
  return NextResponse.json({
    success: true,
    message: `Completed research: ${researchType}`,
    completedResearch: {
      type: researchType
    }
  });
}
