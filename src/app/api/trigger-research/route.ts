import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache, UserWorldCache } from '@/lib/server/world/userWorldCache';
import { AllResearches, getResearchUpgradeCost, ResearchType, triggerResearch, TechTree } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, validateRequired, ApiError } from '@/lib/server/errors';
import { createLockContext, type LockContext as IronGuardLockContext, USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/world/user';

// Type alias for user context
type UserContext = IronGuardLockContext<readonly [typeof USER_LOCK]>;

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
    
    // Get typed cache manager singleton
    const cacheManager = getUserWorldCache();
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    
    // Execute with user lock (user-specific operation)
    const userCtx = await cacheManager.acquireUserLock(emptyCtx);
    try {
      // Get user data safely (we have user lock)
      let user = cacheManager.getUserByIdFromCache(session.userId!, userCtx);
      
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
      
      // Continue with research logic
      return performResearchTrigger(user, researchType, cacheManager, userCtx);
    } finally {
      userCtx.dispose();
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function performResearchTrigger(
  user: User,
  researchType: ResearchType,
  cacheManager: UserWorldCache,
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
  cacheManager.updateUserInCache(user, userCtx);
  
  return NextResponse.json({ success: true });
}
