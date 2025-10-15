import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { AllResearches, getResearchUpgradeCost, getResearchUpgradeDuration, getResearchEffect, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyContext } from '@/lib/server/ironGuard';
import { User } from '@/lib/server/user';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute with user read lock (read-only user operation)
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
          
          // Return techtree data
          return processTechTree(user);
        });
      } else {
        // Return techtree data directly
        return processTechTree(user);
      }
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
