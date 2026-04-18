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

interface AfterburnerRequestBody {
  action?: 'activate' | 'deactivate';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as AfterburnerRequestBody;
    const action = body.action === 'deactivate' ? 'deactivate' : 'activate';

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

        return await performAfterburnerAction(worldContext, userContext, world, user, bonuses, action);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function performAfterburnerAction(
  worldContext: LockContext<LocksAtMostAndHas6>,
  userCtx: LockContext<LocksAtMostAndHas4>,
  world: World,
  user: User,
  bonuses: UserBonuses,
  action: 'activate' | 'deactivate',
): Promise<NextResponse> {
  void userCtx;

  const worldCache = WorldCache.getInstance();
  const afterburnerService = AfterburnerService.getInstance();
  const timeMultiplier = TimeMultiplierService.getInstance().getMultiplier();

  const durationMs = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerDuration) * 1000;
  const cooldownMs = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerCooldown) * 1000;
  const speedIncreasePercent = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerSpeedIncrease);
  const maxSpeed = bonuses.maxShipSpeed;
  const boostedSpeed = maxSpeed * (1 + speedIncreasePercent / 100);
  const afterburnerConfig = {
    timeMultiplier,
    fuelCapacityMs: durationMs,
    cooldownMs,
    boostedSpeed,
  };
  const status = afterburnerService.getStatus(user.id, afterburnerConfig);

  if (action === 'activate' && user.techTree.afterburnerDuration < 1) {
    throw new ApiError(400, 'Afterburner not researched');
  }

  if (action === 'activate') {
    if (status.isActive) {
      throw new ApiError(400, 'Afterburner already active');
    }
    if (!status.canActivate) {
      throw new ApiError(400, 'Afterburner requires at least 33% fuel');
    }
  }

  if (action === 'deactivate' && !status.isActive) {
    throw new ApiError(400, 'Afterburner not active');
  }

  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);

  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);

  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }

  const previousSpeed = playerShip.speed;

  if (action === 'activate') {
    playerShip.speed = boostedSpeed;
    playerShip.last_position_update_ms = currentTime;
    await worldCache.updateWorldUnsafe(worldContext, world);

    const nextStatus = afterburnerService.activate(user.id, afterburnerConfig);

    return NextResponse.json({
      success: true,
      action: 'activated',
      boostedSpeed,
      previousSpeed,
      durationMs,
      cooldownMs,
      maxSpeed,
      fuelRemainingMs: nextStatus.fuelRemainingMs,
      fuelCapacityMs: nextStatus.fuelCapacityMs,
      fuelPercent: nextStatus.fuelPercent,
    });
  }

  playerShip.speed = Math.min(playerShip.speed, maxSpeed);
  playerShip.last_position_update_ms = currentTime;
  await worldCache.updateWorldUnsafe(worldContext, world);

  const nextStatus = afterburnerService.deactivate(user.id, afterburnerConfig);

  return NextResponse.json({
    success: true,
    action: 'deactivated',
    boostedSpeed: 0,
    previousSpeed,
    durationMs,
    cooldownMs,
    maxSpeed,
    fuelRemainingMs: nextStatus?.fuelRemainingMs ?? 0,
    fuelCapacityMs: nextStatus?.fuelCapacityMs ?? durationMs,
    fuelPercent: nextStatus?.fuelPercent ?? 0,
  });
}