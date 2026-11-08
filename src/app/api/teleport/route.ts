import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { calculateTeleportChargeCost } from '@/lib/server/teleport/teleportCharges';

/**
 * POST /api/teleport
 * Moves the player's ship to (x, y), consuming teleport charge proportional to the jump distance.
 *
 * Locking: USER_LOCK (4) → WORLD_LOCK (6). Input validation happens before any lock, the user is
 * resolved and checked (battle, charges) before WORLD_LOCK, which only covers the ship update.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId!;

    const body = await request.json().catch(() => null);
    const { x, y, preserveVelocity } = (body ?? {}) as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new ApiError(400, 'x and y must be valid numbers');
    }

    const userCache = UserCache.getInstance2();
    const worldCache = WorldCache.getInstance();

    return await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithLock(userContext, userId);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
      if (user.inBattle) {
        throw new ApiError(400, 'Cannot teleport while in battle');
      }
      if (Math.floor(user.teleportCharges) < 1) {
        throw new ApiError(400, 'No teleport charges available');
      }

      const ship = await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // getWorldFromCache advances physics to "now"
        const world = worldCache.getWorldFromCache(worldContext);
        const { width, height } = world.worldSize;
        if (x < 0 || x > width || y < 0 || y > height) {
          throw new ApiError(400, `Coordinates must be in range [0, ${width}] x [0, ${height}]`);
        }

        const playerShip = world.getSpaceObject(worldContext, user.ship_id ?? -1);
        if (!playerShip || playerShip.type !== 'player_ship') {
          throw new ApiError(404, 'Player ship not found');
        }

        user.teleportCharges -= calculateTeleportChargeCost(playerShip, { x, y }, world.worldSize);
        playerShip.x = x;
        playerShip.y = y;
        if (!preserveVelocity) {
          playerShip.speed = 0;
        }
        playerShip.last_position_update_ms = Date.now();

        await worldCache.updateWorldUnsafe(worldContext, world);
        return { x: playerShip.x, y: playerShip.y, speed: playerShip.speed, angle: playerShip.angle };
      });

      await userCache.updateUserInCache(userContext, user);

      return NextResponse.json({ success: true, ship, remainingCharges: user.teleportCharges });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
