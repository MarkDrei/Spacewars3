import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError, validateRequired, ApiError } from '@/lib/server/errors';
import { TechService } from '@/lib/server/techs/TechService';
import { TechFactory } from '@/lib/server/techs/TechFactory';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

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

    const context = createLockContext();
    const techService = TechService.getInstance();

    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Check if user has enough iron
      const userIron = await techService.getIron(session.userId!, userContext);

      if (userIron === null) {
        throw new ApiError(404, 'User not found');
      }

      if (userIron < spec.baseCost) {
        throw new ApiError(400, `Insufficient iron. Required: ${spec.baseCost}, Available: ${userIron}`);
      }

      // Add to build queue
      const addResult = await techService.addTechItemToBuildQueue(session.userId!, itemKey, itemType, userContext);

      if (!addResult.success) {
        throw new ApiError(400, addResult.error || 'Failed to add item to build queue');
      }

      // Calculate estimated completion time
      const estimatedCompletion = await techService.getEstimatedCompletionTime(session.userId!, userContext);

      return { estimatedCompletion };
    });

    console.log(`✅ Started building ${itemType}/${itemKey} for user ${session.userId}. Cost: ${spec.baseCost} iron`);

    return NextResponse.json({
      success: true,
      itemKey,
      itemType,
      cost: spec.baseCost,
      buildDurationMinutes: spec.buildDurationMinutes,
      estimatedCompletion: result.estimatedCompletion,
      message: `Started building ${spec.name}`
    });

  } catch (error) {
    console.error('Build item API error:', error);
    return handleApiError(error);
  }
}
