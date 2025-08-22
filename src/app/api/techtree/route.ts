import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getCacheManager } from '@/lib/server/cacheManager';
import { AllResearches, getResearchUpgradeCost, getResearchUpgradeDuration, getResearchEffect, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get user data from cache manager
    const cacheManager = getCacheManager();
    await cacheManager.initialize();
    
    const user = await cacheManager.getUser(session.userId!);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
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
  } catch (error) {
    return handleApiError(error);
  }
}
