import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { World } from '@/lib/server/world/world';
import { createLockContext, LockContext, LocksAtMostAndHas4, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    const worldCache = WorldCache.getInstance();

    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        const world = worldCache.getWorldFromCache(worldContext);

        if (!user) {
          throw new ApiError(404, 'User not found');
        }

        const bonuses = await userWorldCache.getBonusesByUserIdWithLock(userContext, user.id);

        return await performAfterburnerActivation(worldContext, userContext, world, user, bonuses);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Perform the afterburner activation with proper lock context.
 * Requires WORLD_LOCK and USER_LOCK to be held.
 */
async function performAfterburnerActivation(
  worldContext: LockContext<LocksAtMostAndHas6>,
  userCtx: LockContext<LocksAtMostAndHas4>,
  world: World,
  user: User,
  bonuses: UserBonuses,
): Promise<NextResponse> {
  const worldCache = WorldCache.getInstance();
  const afterburnerService = AfterburnerService.getInstance();
  const timeMultiplier = TimeMultiplierService.getInstance().getMultiplier();

  // Validate: must have researched AfterburnerDuration (level >= 1)
  if (user.techTree.afterburnerDuration < 1) {
    throw new ApiError(400, 'Afterburner not researched');
  }

  // Validate: not already active and not on cooldown
  if (!afterburnerService.canActivate(user.id, timeMultiplier)) {
    if (afterburnerService.isActive(user.id, timeMultiplier)) {
      throw new ApiError(400, 'Afterburner already active');
    }
    throw new ApiError(400, 'Afterburner on cooldown');
  }

  // Compute boost parameters from research
  const durationMs = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerDuration) * 1000;
  const cooldownMs = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerCooldown) * 1000;
  const speedIncreasePercent = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerSpeedIncrease);
  const maxSpeed = bonuses.maxShipSpeed;
  const boostedSpeed = maxSpeed * (1 + speedIncreasePercent / 100);

  // Update physics before finding ship — updatePhysics replaces spaceObjects
  // with new cloned objects, so ship references must be obtained after this call.
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);

  // Find player's ship in the world (after physics update)
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);

  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }

  // Apply boost
  const previousSpeed = playerShip.speed;
  playerShip.speed = boostedSpeed;
  playerShip.last_position_update_ms = currentTime;

  // Persist world changes
  await worldCache.updateWorldUnsafe(worldContext, world);

  // Activate afterburner state tracking
  afterburnerService.activate(user.id, durationMs, cooldownMs, boostedSpeed);

  return NextResponse.json({
    success: true,
    boostedSpeed,
    previousSpeed,
    durationMs,
    cooldownMs,
    maxSpeed,
  });
}
