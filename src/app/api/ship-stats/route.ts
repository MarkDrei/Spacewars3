import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { World } from '@/lib/server/world/world';
import { TechService } from '@/lib/server/techs/TechService';
import { createLockContext, LockContext, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';
import { checkAndExpireAfterburner } from '@/lib/server/afterburner/afterburnerExpiration';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const emptyCtx = createLockContext();

    // Get typed cache manager singleton
    const userWorldCache = UserCache.getInstance2();

    const worldCache = WorldCache.getInstance();
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // Get world and user data safely (we have both locks)
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        const world = worldCache.getWorldFromCache(worldContext);

        if (!user) {
          console.log(`❌ User not found: ${session.userId}`);
          throw new ApiError(404, 'User not found');
        }

        const bonuses = await userWorldCache.getBonusesByUserIdWithLock(userContext, user.id);

        // Continue with ship stats logic
        return await getShipStats(worldContext, world, user, bonuses);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getShipStats(
  worldContext: LockContext<LocksAtMostAndHas6>,
  world: World,
  user: User,
  bonuses: UserBonuses
): Promise<NextResponse> {
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);

  // Update defense values based on elapsed time since last regen (using bonused rates)
  const now = Math.floor(Date.now() / 1000);
  user.updateDefenseValues(now, bonuses);

  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);

  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }

  // Use current max ship speed (affected by damage, modifiers, etc.)
  const maxSpeed = user.getCurrentMaxShipSpeed(bonuses);
  const timeMultiplier = TimeMultiplierService.getInstance().getMultiplier();
  const afterburnerDurationMs = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerDuration) * 1000;
  const afterburnerCooldownMs = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerCooldown) * 1000;
  const afterburnerSpeedIncreasePercent = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerSpeedIncrease);
  const afterburnerConfig = {
    timeMultiplier,
    fuelCapacityMs: afterburnerDurationMs,
    cooldownMs: afterburnerCooldownMs,
    boostedSpeed: maxSpeed * (1 + afterburnerSpeedIncreasePercent / 100),
  };

  // Check and expire afterburner if boost has ended — cap speed at normal maxSpeed
  const afterburnerService = AfterburnerService.getInstance();
  const afterburnerExpired = checkAndExpireAfterburner(user.id, playerShip, maxSpeed, afterburnerConfig);
  if (afterburnerExpired) {
    await WorldCache.getInstance().updateWorldUnsafe(worldContext, world);
  }

  // Calculate defense values using actual current values from database
  const currentValues = {
    hull: user.hullCurrent,
    armor: user.armorCurrent,
    shield: user.shieldCurrent
  };
  const regenRates = user.getDefenseRegenRates(bonuses);
  const defenseValues = TechService.getDefenseStats(
    user.techCounts,
    user.techTree,
    currentValues,
    bonuses.levelMultiplier,
    regenRates
  );

  // Build afterburner status for the client
  const afterburnerSnapshot = afterburnerService.getStatus(user.id, afterburnerConfig);
  const afterburnerStatus = {
    isActive: afterburnerSnapshot.isActive,
    boostRemainingMs: afterburnerSnapshot.boostRemainingMs,
    cooldownRemainingMs: afterburnerSnapshot.cooldownRemainingMs,
    canActivate: user.techTree.afterburnerDuration >= 1 && afterburnerSnapshot.canActivate,
    durationResearchLevel: user.techTree.afterburnerDuration,
    boostedSpeed: afterburnerSnapshot.boostedSpeed,
    fuelRemainingMs: afterburnerSnapshot.fuelRemainingMs,
    fuelCapacityMs: afterburnerSnapshot.fuelCapacityMs,
    fuelPercent: afterburnerSnapshot.fuelPercent,
    timeToActivationMs: afterburnerSnapshot.timeToActivationMs,
    activationThresholdPercent: Math.round(AfterburnerService.MIN_ACTIVATION_RATIO * 100),
  };

  const responseData = {
    x: playerShip.x,
    y: playerShip.y,
    speed: playerShip.speed,
    angle: playerShip.angle,
    maxSpeed: maxSpeed,
    last_position_update_ms: playerShip.last_position_update_ms,
    defenseValues,
    afterburner: afterburnerStatus,
    shipPictureId: playerShip.picture_id,
  };

  return NextResponse.json(responseData);
}
