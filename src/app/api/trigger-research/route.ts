import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
import { AllResearches, getResearchUpgradeCost, ResearchType, triggerResearch, TechTree } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, validateRequired, ApiError } from '@/lib/server/errors';
import { createEmptyContext, LockContext, Locked, CacheLevel, WorldLevel, UserLevel } from '@/lib/server/ironGuard';
import { User } from '@/lib/server/user';

// Type aliases for cleaner code
type UserContext = LockContext<Locked<'user'>, any>;

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { type } = body;
    
    validateRequired(type, 'research type');
    
    if (!Object.values(ResearchType).includes(type as ResearchType)) {
      throw new ApiError(400, 'Invalid research type');
    }
    
    const researchType = type as ResearchType;
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
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
          
          // Continue with research logic
          return performResearchTrigger(user, researchType, cacheManager, userCtx);
        });
      } else {
        // Continue with research logic directly
        return performResearchTrigger(user, researchType, cacheManager, userCtx);
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function performResearchTrigger(
  user: User,
  researchType: ResearchType,
  cacheManager: TypedCacheManager,
  userCtx: UserContext
): NextResponse {
  const now = Math.floor(Date.now() / 1000);
  user.updateStats(now);
  
  if (user.techTree.activeResearch) {
    throw new ApiError(400, 'Research already in progress');
  }
  
  const research = AllResearches[researchType];
  const key = research.treeKey as keyof TechTree;
  const currentLevel = user.techTree[key];
  
  if (typeof currentLevel !== 'number') {
    throw new ApiError(500, 'Invalid tech tree state');
  }
  
  const cost = getResearchUpgradeCost(research, currentLevel + 1);
  
  if (user.iron < cost) {
    throw new ApiError(400, 'Not enough iron');
  }
  
  user.iron -= cost;
  triggerResearch(user.techTree, researchType);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  cacheManager.updateUserUnsafe(user, userCtx);
  
  return NextResponse.json({ success: true });
}
