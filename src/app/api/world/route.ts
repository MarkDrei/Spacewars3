import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache } from '@/lib/server/world/userWorldCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { WORLD_LOCK } from '@/lib/server/typedLocks';
import { createLockContext, LockContext, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // console.log(`🌍 World data request - userId: ${session.userId}`);

    // Get typed cache manager singleton
    const userWorldCache = getUserWorldCache();
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    
    return await emptyCtx.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      // Get world data safely (we have world write lock)
      const world = userWorldCache.getWorldFromCache(worldContext);
      
      // Update physics for all objects
      const currentTime = Date.now();
      world.updatePhysics(worldContext, currentTime);
      
      // Mark world as dirty for persistence (critical fix!)
      userWorldCache.updateWorldUnsafe(worldContext, world);
      
      // Return world data
      const worldData = world.getWorldData(worldContext);
      return NextResponse.json(worldData);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
