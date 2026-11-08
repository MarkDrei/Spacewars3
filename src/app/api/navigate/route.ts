import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validates the optional speed/angle body fields; null counts as "not provided". */
function parseNavigationBody(body: unknown): { speed?: number; angle?: number } {
  const { speed, angle } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const hasSpeed = speed !== undefined && speed !== null;
  const hasAngle = angle !== undefined && angle !== null;

  if (!hasSpeed && !hasAngle) {
    throw new ApiError(400, 'Must provide speed and/or angle');
  }
  if (hasSpeed && !isFiniteNumber(speed)) {
    throw new ApiError(400, 'Speed must be a finite number');
  }
  if (hasAngle && !isFiniteNumber(angle)) {
    throw new ApiError(400, 'Angle must be a finite number');
  }
  return { speed: hasSpeed ? (speed as number) : undefined, angle: hasAngle ? (angle as number) : undefined };
}

/** Max speed the ship may currently fly: base max speed, or the boosted speed while the afterburner burns. */
function getEffectiveMaxSpeed(user: User, bonuses: UserBonuses): number {
  const maxSpeed = user.getCurrentMaxShipSpeed(bonuses);
  const afterburnerService = AfterburnerService.getInstance();
  const afterburnerConfig = {
    timeMultiplier: TimeMultiplierService.getInstance().getMultiplier(),
    fuelCapacityMs: getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerDuration) * 1000,
    cooldownMs: getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerCooldown) * 1000,
    boostedSpeed: maxSpeed * (1 + getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerSpeedIncrease) / 100),
  };
  const afterburnerState = afterburnerService.getState(user.id);
  return afterburnerService.isActive(user.id, afterburnerConfig) &&
    afterburnerState &&
    afterburnerState.boostedSpeed > maxSpeed
    ? afterburnerState.boostedSpeed
    : maxSpeed;
}

/** Normalizes an angle in degrees to the range [0, 360). */
function normalizeAngle(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * POST /api/navigate
 * Sets speed and/or angle of the player's ship.
 *
 * Locking: USER_LOCK (4) → WORLD_LOCK (6). User, bonuses and validation are resolved before
 * WORLD_LOCK is acquired, so the world lock is only held for the synchronous ship update.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId!;

    const body = await request.json().catch(() => {
      throw new ApiError(400, 'Invalid JSON body');
    });
    const { speed, angle } = parseNavigationBody(body);

    const userCache = UserCache.getInstance2();
    const worldCache = WorldCache.getInstance();

    return await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithLock(userContext, userId);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
      if (user.inBattle) {
        throw new ApiError(400, 'Cannot navigate while in battle');
      }

      if (speed !== undefined) {
        const bonuses = await userCache.getBonusesByUserIdWithLock(userContext, user.id);
        const effectiveMaxSpeed = getEffectiveMaxSpeed(user, bonuses);
        if (speed < 0 || speed > effectiveMaxSpeed) {
          throw new ApiError(400, `Speed must be between 0 and ${effectiveMaxSpeed}`);
        }
      }

      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // getWorldFromCache already advances physics to "now"
        const world = worldCache.getWorldFromCache(worldContext);
        const playerShip = world
          .getSpaceObjectsByType(worldContext, 'player_ship')
          .find((ship) => ship.id === user.ship_id);
        if (!playerShip) {
          throw new ApiError(404, 'Player ship not found');
        }

        const initialSpeed = playerShip.speed;
        const initialAngle = playerShip.angle;
        if (speed !== undefined) playerShip.speed = speed;
        if (angle !== undefined) playerShip.angle = normalizeAngle(angle);
        playerShip.last_position_update_ms = Date.now();

        await worldCache.updateWorldUnsafe(worldContext, world);

        return NextResponse.json({
          success: true,
          ship: {
            id: playerShip.id,
            x: playerShip.x,
            y: playerShip.y,
            speed: playerShip.speed,
            angle: playerShip.angle,
            lastUpdate: playerShip.last_position_update_ms,
          },
          changes: {
            speed: speed !== undefined ? { from: initialSpeed, to: playerShip.speed } : null,
            angle: angle !== undefined ? { from: initialAngle, to: playerShip.angle } : null,
          },
          message: 'Navigation completed successfully',
        });
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
