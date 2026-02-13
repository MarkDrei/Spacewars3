import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { getDatabase } from '@/lib/server/database';

// GET endpoint to retrieve the current picture_id
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    const worldCache = WorldCache.getInstance();

    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // Get user and world
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        const world = worldCache.getWorldFromCache(worldContext);

        if (!user) {
          throw new ApiError(404, 'User not found');
        }

        if (!user.ship_id) {
          throw new ApiError(404, 'User has no ship');
        }

        // Find the user's ship in the world
        const ship = world.spaceObjects.find(obj => obj.id === user.ship_id);
        if (!ship) {
          throw new ApiError(404, 'Ship not found in world');
        }

        return NextResponse.json({ 
          pictureId: ship.picture_id
        });
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST endpoint to update the picture_id
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { pictureId } = body;

    // Validate picture_id
    if (typeof pictureId !== 'number' || pictureId < 1 || pictureId > 1000) {
      throw new ApiError(400, 'Invalid picture_id. Must be a number between 1 and 1000.');
    }

    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    const worldCache = WorldCache.getInstance();
    const db = await getDatabase();

    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // Get user and world
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        const world = worldCache.getWorldFromCache(worldContext);

        if (!user) {
          throw new ApiError(404, 'User not found');
        }

        if (!user.ship_id) {
          throw new ApiError(404, 'User has no ship');
        }

        // Find the user's ship in the world
        const ship = world.spaceObjects.find(obj => obj.id === user.ship_id);
        if (!ship) {
          throw new ApiError(404, 'Ship not found in world');
        }

        // Update the picture_id in the ship object
        ship.picture_id = pictureId;

        // Update the database directly
        await db.query(
          'UPDATE space_objects SET picture_id = $1 WHERE id = $2',
          [pictureId, user.ship_id]
        );

        // Mark world as dirty to ensure persistence
        await worldCache.updateWorldUnsafe(worldContext, world);

        console.log(`✅ Updated ship picture_id for user ${user.username} (ship ${user.ship_id}) to ${pictureId}`);

        return NextResponse.json({ 
          success: true, 
          pictureId,
          message: 'Ship picture updated successfully'
        });
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
