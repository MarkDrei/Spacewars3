import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError, validateRequired, ApiError } from '@/lib/server/errors';
import { TechRepo } from '@/lib/server/techs/techRepo';
import { TechFactory } from '@/lib/server/techs/TechFactory';
import { getDatabase } from '@/lib/server/database';

/**
 * POST /api/build-item
 * Start building a weapon or defense item
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { itemKey, itemType } = body;
    
    console.log(`🔨 Build item request: ${itemType}/${itemKey} by user: ${session.userId}`);
    
    // Validate required fields
    validateRequired(itemKey, 'itemKey');
    validateRequired(itemType, 'itemType');
    
    if (itemType !== 'weapon' && itemType !== 'defense') {
      throw new ApiError(400, 'Invalid item type. Must be "weapon" or "defense"');
    }
    
    // Validate item exists in catalog
    const spec = TechFactory.getTechSpec(itemKey, itemType);
    if (!spec) {
      throw new ApiError(400, `Unknown ${itemType}: ${itemKey}`);
    }
    
    const db = await getDatabase();
    const techRepo = new TechRepo(db);
    
    // Check if user has enough iron
    const userIron = await techRepo.getIron(session.userId!);
    if (userIron < spec.baseCost) {
      throw new ApiError(400, `Insufficient iron. Required: ${spec.baseCost}, Available: ${userIron}`);
    }
    
    // Calculate estimated completion time
    const estimatedCompletion = await techRepo.getEstimatedCompletionTime(session.userId!, itemKey, itemType);
    
    // Deduct iron and add to build queue
    await techRepo.updateIron(session.userId!, -spec.baseCost);
    await techRepo.addTechItemToBuildQueue(session.userId!, itemKey, itemType);
    
    console.log(`✅ Started building ${itemType}/${itemKey} for user ${session.userId}. Cost: ${spec.baseCost} iron`);
    
    return NextResponse.json({
      success: true,
      itemKey,
      itemType,
      cost: spec.baseCost,
      buildDurationMinutes: spec.buildDurationMinutes,
      estimatedCompletion,
      message: `Started building ${spec.name}`
    });
    
  } catch (error) {
    console.error('Build item API error:', error);
    return handleApiError(error);
  }
}
