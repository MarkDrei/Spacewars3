import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { WORLD_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // console.log(`🌍 World data request - userId: ${session.userId}`);

    const emptyCtx = createLockContext();
    // Get typed cache manager singleton
    const userWorldCache = await getUserWorldCache(emptyCtx);
    
    const worldCache = WorldCache.getInstance();
    return await emptyCtx.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      // Get world data safely (we have world write lock)
      const world = worldCache.getWorldFromCache(worldContext);
      
      // Update physics for all objects
      const currentTime = Date.now();
      world.updatePhysics(worldContext, currentTime);
      
      // Mark world as dirty for persistence (critical fix!)
      worldCache.updateWorldUnsafe(worldContext, world);
      
      // Return world data
      const worldData = world.getWorldData(worldContext);
      return NextResponse.json(worldData);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
