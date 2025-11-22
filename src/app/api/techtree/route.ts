import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache } from '@/lib/server/world/userWorldCache';
import { AllResearches, getResearchUpgradeCost, getResearchUpgradeDuration, getResearchEffect, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/world/user';
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
      
      // Return techtree data
      return processTechTree(user);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function processTechTree(user: User): NextResponse {
  // Build research definitions with next upgrade cost/duration for the user
  const researches: Record<string, {
    name: string;
    description: string;
    nextUpgradeCost: number;
    nextUpgradeDuration: number;
    currentEffect: number;
    nextEffect: number;
  }> = {};
  
  (Object.values(ResearchType) as ResearchType[]).forEach(type => {
    const research = AllResearches[type];
    const key = research.treeKey as keyof typeof user.techTree;
    const currentLevel = user.techTree[key];
    const nextLevel = typeof currentLevel === 'number' ? currentLevel + 1 : 1;
    
    researches[type] = {
      ...research,
      nextUpgradeCost: getResearchUpgradeCost(research, nextLevel),
      nextUpgradeDuration: getResearchUpgradeDuration(research, nextLevel),
      currentEffect: getResearchEffect(research, typeof currentLevel === 'number' ? currentLevel : 0),
      nextEffect: getResearchEffect(research, nextLevel),
    };
  });
  
  return NextResponse.json({
    techTree: user.techTree,
    researches
  });
}
