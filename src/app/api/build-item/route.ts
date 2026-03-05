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
    const { itemKey, itemType, count = 1 } = body;

    console.log(`🔨 Build item request: ${itemType}/${itemKey} x${count} by user: ${session.userId}`);

    // Validate required fields
    validateRequired(itemKey, 'itemKey');
    validateRequired(itemType, 'itemType');

    if (itemType !== 'weapon' && itemType !== 'defense') {
      throw new ApiError(400, 'Invalid item type. Must be "weapon" or "defense"');
    }

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new ApiError(400, 'Count must be an integer between 1 and 100');
    }

    // Validate item exists in catalog
    const spec = TechFactory.getTechSpec(itemKey, itemType);
    if (!spec) {
      throw new ApiError(400, `Unknown ${itemType}: ${itemKey}`);
    }

    const context = createLockContext();
    const techService = TechService.getInstance();

    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Check if user has enough iron for all items
      const userIron = await techService.getIron(session.userId!, userContext);

      if (userIron === null) {
        throw new ApiError(404, 'User not found');
      }

      const totalCost = spec.baseCost * count;
      if (userIron < totalCost) {
        throw new ApiError(400, `Insufficient iron. Required: ${totalCost} (${count}x${spec.baseCost}), Available: ${userIron}`);
      }

      // Add items to build queue one by one within the same lock
      for (let i = 0; i < count; i++) {
        const addResult = await techService.addTechItemToBuildQueue(session.userId!, itemKey, itemType, userContext);

        if (!addResult.success) {
          throw new ApiError(400, addResult.error || 'Failed to add item to build queue');
        }
      }

      // Calculate estimated completion time
      const estimatedCompletion = await techService.getEstimatedCompletionTime(session.userId!, userContext);

      return { estimatedCompletion };
    });

    console.log(`✅ Started building ${count}x ${itemType}/${itemKey} for user ${session.userId}. Cost: ${spec.baseCost * count} iron`);

    return NextResponse.json({
      success: true,
      itemKey,
      itemType,
      count,
      cost: spec.baseCost * count,
      buildDurationMinutes: spec.buildDurationMinutes,
      estimatedCompletion: result.estimatedCompletion,
      message: count === 1 ? `Started building ${spec.name}` : `Started building ${count}x ${spec.name}`
    });

  } catch (error) {
    console.error('Build item API error:', error);
    return handleApiError(error);
  }
}
