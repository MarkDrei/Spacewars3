import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { AllResearches, getResearchUpgradeCost, getResearchUpgradeDuration, getResearchEffect, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createLockContext } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get typed cache manager singleton
    const cacheManager = getTypedCacheManager();
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    
    // Execute with user lock (read-only user operation)
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
      
      // Return techtree data
      return processTechTree(user);
    } finally {
      userCtx.dispose();
    }
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
