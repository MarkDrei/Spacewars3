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

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { x, y, preserveVelocity } = body;

    if (x === undefined || y === undefined) {
      throw new ApiError(400, 'Must provide x and y coordinates');
    }

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

        return await performTeleportLogic(worldContext, userContext, world, user, x, y, preserveVelocity === true);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Perform the actual teleport logic with proper lock context
 * Requires WORLD_LOCK and USER_LOCK to be held.
 */
async function performTeleportLogic(
  worldContext: LockContext<LocksAtMostAndHas6>,
  userCtx: LockContext<LocksAtMostAndHas4>,
  world: World,
  user: User,
  x: number,
  y: number,
  preserveVelocity: boolean
): Promise<NextResponse> {
  const worldCache = WorldCache.getInstance();

  // Check if user is in battle - cannot teleport while in battle
  if (user.inBattle) {
    throw new ApiError(400, 'Cannot teleport while in battle');
  }

  // Check if user has teleport charges available
  if (Math.floor(user.teleportCharges) < 1) {
    throw new ApiError(400, 'No teleport charges available');
  }

  // Validate coordinates are within world bounds
  const { width: worldWidth, height: worldHeight } = world.worldSize;
  if (x < 0 || x > worldWidth || y < 0 || y > worldHeight) {
    throw new ApiError(400, `Coordinates must be within world bounds (0-${worldWidth}, 0-${worldHeight})`);
  }

  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);

  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);

  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }

  // Teleport the ship to the new position
  playerShip.x = x;
  playerShip.y = y;
  playerShip.last_position_update_ms = currentTime;

  // Zero velocity unless preserving it
  if (!preserveVelocity) {
    playerShip.speed = 0;
  }

  // Deduct 1 charge (fractional charges preserved)
  user.teleportCharges = user.teleportCharges - 1;

  // Update world cache with new data
  await worldCache.updateWorldUnsafe(worldContext, world);

  return NextResponse.json({
    success: true,
    ship: {
      x: playerShip.x,
      y: playerShip.y,
      speed: playerShip.speed,
      angle: playerShip.angle,
    },
    remainingCharges: Math.floor(user.teleportCharges),
  });
}
