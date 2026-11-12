import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { createLockContext, type LockContext, type LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { getDatabase } from '@/lib/server/database';

const MIN_PICTURE_ID = 1;
const MAX_PICTURE_ID = 1000;

/** Loads the user (USER_LOCK must be held) and returns the ship id, or throws 404. */
async function getShipId(userContext: LockContext<LocksAtMostAndHas4>, userId: number): Promise<number> {
  const user = await UserCache.getInstance2().getUserByIdWithoutRefreshWithLock(userContext, userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  if (!user.ship_id) {
    throw new ApiError(404, 'User has no ship');
  }
  return user.ship_id;
}

/**
 * GET /api/update-ship-picture
 * Returns the picture id of the player's ship.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    return await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      const shipId = await getShipId(userContext, session.userId!);

      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        const ship = WorldCache.getInstance().getWorldFromCache(worldContext).getSpaceObject(worldContext, shipId);
        if (!ship) {
          throw new ApiError(404, 'Ship not found in world');
        }
        return NextResponse.json({ pictureId: ship.picture_id });
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/update-ship-picture
 * Changes the picture id of the player's ship.
 *
 * picture_id is not part of the periodic world persistence (positions only), so it is written to
 * the database directly. Locking: USER_LOCK (4) → WORLD_LOCK (6) for the in-memory change only;
 * the database write happens after WORLD_LOCK is released but still under USER_LOCK.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json().catch(() => null);
    const pictureId: unknown = body?.pictureId;
    if (!Number.isInteger(pictureId) || (pictureId as number) < MIN_PICTURE_ID || (pictureId as number) > MAX_PICTURE_ID) {
      throw new ApiError(400, `Invalid picture_id. Must be an integer between ${MIN_PICTURE_ID} and ${MAX_PICTURE_ID}.`);
    }

    const db = await getDatabase();

    return await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      const shipId = await getShipId(userContext, session.userId!);

      await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        const ship = WorldCache.getInstance().getWorldFromCache(worldContext).getSpaceObject(worldContext, shipId);
        if (!ship) {
          throw new ApiError(404, 'Ship not found in world');
        }
        ship.picture_id = pictureId as number;
      });

      await db.query('UPDATE space_objects SET picture_id = $1 WHERE id = $2', [pictureId, shipId]);

      return NextResponse.json({
        success: true,
        pictureId,
        message: 'Ship picture updated successfully',
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
