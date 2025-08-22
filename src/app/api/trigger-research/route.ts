import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getCacheManager } from '@/lib/server/cacheManager';
import { AllResearches, getResearchUpgradeCost, ResearchType, triggerResearch, TechTree } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, validateRequired, ApiError } from '@/lib/server/errors';

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
    
    // Get cache manager and user data
    const cacheManager = getCacheManager();
    await cacheManager.initialize();
    
    // Use user mutex to prevent concurrent research operations
    const userMutex = await cacheManager.getUserMutex(session.userId!);
    
    return await userMutex.acquire(async () => {
      const user = await cacheManager.getUser(session.userId!);
      
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
      
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
      
      // Save user via cache manager (will persist periodically)
      await cacheManager.updateUser(user);
      
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
