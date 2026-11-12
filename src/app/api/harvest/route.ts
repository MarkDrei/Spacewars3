import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { UserCache } from '@/lib/server/user/userCache';
import { sendMessageToUser } from '@/lib/server/messages/MessageCache';
import { getServerT } from '@/lib/server/i18n/serverTranslations';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_INVENTORY_LOCK, USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { Commander } from '@/lib/server/inventory/Commander';
import { InventoryService, InventoryFullError } from '@/lib/server/inventory/InventoryService';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';

/** Maximum toroidal distance (world units) between ship and object for a harvest. */
const HARVEST_RANGE = 125;

type CollectibleType = 'asteroid' | 'shipwreck' | 'escape_pod';

interface CollectionResult {
  objectType: CollectibleType;
  distance: number;
  ironReward: number;
  totalIron: number;
  locale: string;
  maxInventorySlots: number;
}

async function parseObjectId(request: NextRequest): Promise<number> {
  const rawBody = await request.text();
  if (!rawBody || rawBody.trim() === '') {
    throw new ApiError(400, 'Invalid JSON in request body');
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, 'Invalid JSON in request body');
  }
  const objectId = (body as { objectId?: unknown } | null)?.objectId;
  if (!objectId || typeof objectId !== 'number') {
    throw new ApiError(400, 'Missing or invalid object ID');
  }
  return objectId;
}

/**
 * Collects the object: USER_LOCK (4) → WORLD_LOCK (6).
 * User and bonuses are resolved before WORLD_LOCK, so the world lock only covers the
 * range check, the collection and the respawn of a replacement object.
 */
async function collectObject(userId: number, objectId: number): Promise<CollectionResult> {
  const userCache = UserCache.getInstance2();
  const worldCache = WorldCache.getInstance();

  return createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
    const user = await userCache.getUserByIdWithLock(userContext, userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    if (user.inBattle) {
      throw new ApiError(400, 'Cannot collect while in battle');
    }
    const bonuses = await userCache.getBonusesByUserIdWithLock(userContext, user.id);

    const collected = await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      // getWorldFromCache advances physics to "now"
      const world = worldCache.getWorldFromCache(worldContext);

      const targetObject = world.getSpaceObject(worldContext, objectId);
      if (!targetObject) {
        throw new ApiError(404, 'Object not found');
      }
      if (targetObject.type === 'player_ship') {
        throw new ApiError(400, 'Cannot collect player ships');
      }

      const playerShip = world.getSpaceObject(worldContext, user.ship_id ?? -1);
      if (!playerShip || playerShip.type !== 'player_ship') {
        throw new ApiError(404, 'Player ship not found');
      }

      const distance = calculateToroidalDistance(playerShip, targetObject, world.worldSize);
      if (distance > HARVEST_RANGE) {
        throw new ApiError(400, 'Object too far away');
      }

      const ironBefore = user.iron;
      user.collected(targetObject.type, bonuses.ironStorageCapacity);
      await world.collected(worldContext, objectId);
      await worldCache.updateWorldUnsafe(worldContext, world);

      return { objectType: targetObject.type, distance, ironReward: user.iron - ironBefore };
    });

    await userCache.updateUserInCache(userContext, user);

    return {
      ...collected,
      totalIron: user.iron,
      locale: user.preferredLocale ?? 'en',
      maxInventorySlots: Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.InventorySlots)),
    };
  });
}

/**
 * Escape pod reward: a random commander in the first free inventory slot.
 * Runs after USER_LOCK/WORLD_LOCK are released; only USER_INVENTORY_LOCK (5) is held.
 */
async function rescueCommander(userId: number, result: CollectionResult): Promise<string> {
  const commander = Commander.random();
  const bonusDesc = commander.statBonuses.map(b => `${b.stat} +${b.value}%`).join(', ');
  const tMsg = await getServerT(result.locale, 'messages');

  return createLockContext().useLockWithAcquire(USER_INVENTORY_LOCK, async (inventoryContext) => {
    try {
      await new InventoryService().addItemToFirstFreeSlotWithLock(
        inventoryContext, userId, commander.toJSON(), result.maxInventorySlots
      );
      return tMsg('escapePodRescued', { commander: commander.name, bonuses: bonusDesc });
    } catch (err) {
      if (err instanceof InventoryFullError) {
        return tMsg('escapePodFull', { commander: commander.name, bonuses: bonusDesc });
      }
      throw err;
    }
  });
}

async function collectionMessage(result: CollectionResult): Promise<string> {
  const tMsg = await getServerT(result.locale, 'messages');
  const objectLabel = result.objectType.replace('_', ' ');
  return result.ironReward > 0
    ? tMsg('harvestCollected', { type: objectLabel, iron: result.ironReward })
    : tMsg('harvestCollectedNoIron', { type: objectLabel });
}

/**
 * POST /api/harvest
 * Collects an asteroid, shipwreck or escape pod within range of the player's ship.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId!;

    const objectId = await parseObjectId(request);
    const result = await collectObject(userId, objectId);

    const notification = result.objectType === 'escape_pod'
      ? await rescueCommander(userId, result)
      : await collectionMessage(result);
    sendMessageToUser(createLockContext(), userId, notification).catch((error: Error) => {
      console.error('❌ Failed to send collection notification:', error);
    });

    try {
      void StatisticsCache.getInstance().recordEvent(userId, 'item_collected', {
        objectType: result.objectType,
        ironAwarded: result.ironReward,
      });
    } catch (statsErr) {
      console.error('⚠️ Failed to emit collection statistics event:', statsErr);
    }

    return NextResponse.json({
      success: true,
      distance: result.distance,
      ironReward: result.ironReward,
      totalIron: result.totalIron,
      objectType: result.objectType,
      message: 'Collection completed successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
