import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { getUserById, saveUserToDb } from '@/lib/server/userRepo';
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
    
    const db = getDatabase();
    const user = await getUserById(db, session.userId, saveUserToDb(db));
    
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
    await user.save();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
