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

    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    const worldCache = WorldCache.getInstance();

    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        const world = worldCache.getWorldFromCache(worldContext);
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);

        if (!user) {
          console.log(`❌ User not found: ${session.userId}`);
          throw new ApiError(404, 'User not found');
        }

        return await performTeleportLogic(worldContext, userContext, world, user, x, y, preserveVelocity);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Perform the actual teleport logic with proper lock context.
 * Requires world write lock and user lock to be held.
 */
async function performTeleportLogic(
  worldContext: LockContext<LocksAtMostAndHas6>,
  userCtx: LockContext<LocksAtMostAndHas4>,
  world: World,
  user: User,
  x: unknown,
  y: unknown,
  preserveVelocity: unknown
): Promise<NextResponse> {
  const worldCache = WorldCache.getInstance();
  const userWorldCache = UserCache.getInstance2();

  // Validate coordinates
  if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) {
    throw new ApiError(400, 'x and y must be valid numbers');
  }

  const worldWidth = world.worldSize.width;
  const worldHeight = world.worldSize.height;

  if (x < 0 || x > worldWidth || y < 0 || y > worldHeight) {
    throw new ApiError(400, `Coordinates must be in range [0, ${worldWidth}] x [0, ${worldHeight}]`);
  }

  // Check if user is in battle - cannot teleport while in battle
  if (user.inBattle) {
    throw new ApiError(400, 'Cannot teleport while in battle');
  }

  // Check teleport charges
  if (Math.floor(user.teleportCharges) < 1) {
    throw new ApiError(400, 'No teleport charges available');
  }

  // Update physics for all objects
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);

  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);

  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }

  // Teleport ship to new position
  playerShip.x = x;
  playerShip.y = y;

  // Optionally zero out velocity
  if (!preserveVelocity) {
    playerShip.speed = 0;
  }

  // Deduct one teleport charge
  user.teleportCharges -= 1;

  // Update last position update timestamp
  playerShip.last_position_update_ms = currentTime;

  // Save world and user
  await worldCache.updateWorldUnsafe(worldContext, world);
  await userWorldCache.updateUserInCache(userCtx, user);

  return NextResponse.json({
    success: true,
    ship: {
      x: playerShip.x,
      y: playerShip.y,
      speed: playerShip.speed,
      angle: playerShip.angle,
    },
    remainingCharges: user.teleportCharges,
  });
}
