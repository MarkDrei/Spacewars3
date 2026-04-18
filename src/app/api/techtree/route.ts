import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { AllResearches, getResearchUpgradeCost, getResearchUpgradeDuration, getResearchEffect, ResearchType, IMPLEMENTED_RESEARCHES } from '@/lib/server/techs/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

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
      
      const bonuses = await UserBonusCache.getInstance().getBonuses(userContext, user.id);
      return processTechTree(user, bonuses.researchSpeedFactor);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function processTechTree(user: User, researchSpeedFactor: number): NextResponse {
  // Build research definitions with next upgrade cost/duration for the user
  const researches: Record<string, {
    name: string;
    description: string;
    nextUpgradeCost: number;
    nextUpgradeDuration: number;
    currentEffect: number;
    nextEffect: number;
  }> = {};
  
  (Object.values(ResearchType) as ResearchType[]).filter(type => IMPLEMENTED_RESEARCHES.has(type)).forEach(type => {
    const research = AllResearches[type];
    const key = research.treeKey as keyof typeof user.techTree;
    const currentLevel = user.techTree[key];
    const nextLevel = typeof currentLevel === 'number' ? currentLevel + 1 : 1;
    
    researches[type] = {
      ...research,
      nextUpgradeCost: getResearchUpgradeCost(research, nextLevel),
      nextUpgradeDuration: getResearchUpgradeDuration(research, nextLevel) / researchSpeedFactor,
      currentEffect: getResearchEffect(research, typeof currentLevel === 'number' ? currentLevel : 0),
      nextEffect: getResearchEffect(research, nextLevel),
    };
  });

  const techTree = user.techTree.activeResearch
    ? {
        ...user.techTree,
        activeResearch: {
          ...user.techTree.activeResearch,
          remainingDuration: user.techTree.activeResearch.remainingDuration / researchSpeedFactor,
        },
      }
    : user.techTree;
  
  return NextResponse.json({
    techTree,
    researches
  });
}
