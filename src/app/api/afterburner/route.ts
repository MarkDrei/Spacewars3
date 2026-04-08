import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { World, SpaceObject } from '@/lib/server/world/world';
import { createLockContext, LockContext, LocksAtMostAndHas4, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    const worldCache = WorldCache.getInstance();

    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        const world = worldCache.getWorldFromCache(worldContext);
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);

        if (!user) {
          throw new ApiError(404, 'User not found');
        }

        return await performAfterburnerLogic(worldContext, userContext, world, user);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Perform the actual afterburner activation logic with proper lock context.
 * Requires world write lock and user lock to be held.
 */
async function performAfterburnerLogic(
  worldContext: LockContext<LocksAtMostAndHas6>,
  userCtx: LockContext<LocksAtMostAndHas4>,
  world: World,
  user: User
): Promise<NextResponse> {
  const worldCache = WorldCache.getInstance();

  // Check afterburner duration research level (must be >= 1 to use afterburner)
  const durationLevel = user.techTree.afterburnerDuration ?? 0;
  if (durationLevel < 1) {
    throw new ApiError(400, 'Afterburner not researched. Research Afterburner Duration first.');
  }

  // Update physics for all objects
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);

  // Find player's ship
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship: SpaceObject) => ship.id === user.ship_id);

  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }

  // Check if user is in battle
  if (user.inBattle) {
    throw new ApiError(400, 'Cannot activate afterburner while in battle');
  }

  // Check if afterburner is already active (cooldown not expired)
  if (playerShip.afterburner_cooldown_end_ms != null && playerShip.afterburner_cooldown_end_ms > currentTime) {
    const remainingMs = playerShip.afterburner_cooldown_end_ms - currentTime;
    throw new ApiError(400, `Afterburner already active. ${Math.ceil(remainingMs / 1000)}s remaining.`);
  }

  // Calculate afterburner parameters from research
  const durationSeconds = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerDuration);
  const speedBoostPercent = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerSpeedIncrease);

  // Get current max speed from bonuses
  const bonuses = await UserBonusCache.getInstance().getBonuses(userCtx, user.id);
  const maxSpeed = user.getCurrentMaxShipSpeed(bonuses);

  // Calculate boosted speed
  const boostedSpeed = maxSpeed * (1 + speedBoostPercent / 100);

  // Activate afterburner
  playerShip.afterburner_old_max_speed = maxSpeed;
  playerShip.afterburner_boosted_speed = boostedSpeed;
  playerShip.afterburner_cooldown_end_ms = currentTime + durationSeconds * 1000;
  playerShip.speed = boostedSpeed;
  playerShip.last_position_update_ms = currentTime;

  // Save world state
  await worldCache.updateWorldUnsafe(worldContext, world);

  return NextResponse.json({
    success: true,
    afterburner: {
      isActive: true,
      boostedSpeed: boostedSpeed,
      oldMaxSpeed: maxSpeed,
      durationSeconds: durationSeconds,
      cooldownEndMs: playerShip.afterburner_cooldown_end_ms,
      speedBoostPercent: speedBoostPercent,
    },
    ship: {
      id: playerShip.id,
      x: playerShip.x,
      y: playerShip.y,
      speed: playerShip.speed,
      angle: playerShip.angle,
    },
  });
}
