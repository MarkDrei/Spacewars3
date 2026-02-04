import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { AllResearches, getResearchUpgradeCost, ResearchType, triggerResearch, TechTree } from '@/lib/server/techs/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, validateRequired, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { createLockContext, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';

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
      
      // Continue with research logic
      return performResearchTrigger(user, researchType, userWorldCache, userContext);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function performResearchTrigger(
  user: User,
  researchType: ResearchType,
  userWorldCache: UserCache,
  userCtx: LockContext<LocksAtMostAndHas4>
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
  
  if (!user.subtractIron(cost)) {
    throw new ApiError(400, 'Not enough iron');
  }
  triggerResearch(user.techTree, researchType);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  userWorldCache.updateUserInCache(userCtx, user);
  
  return NextResponse.json({ success: true });
}
