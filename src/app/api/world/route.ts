import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { createEmptyContext } from '@/lib/server/typedLocks';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // console.log(`🌍 World data request - userId: ${session.userId}`);

    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute with world write lock (we're modifying world state with physics)
    return await cacheManager.withWorldWrite(emptyCtx, async (worldCtx) => {
      // Get world data safely (we have world write lock)
      const world = cacheManager.getWorldUnsafe(worldCtx);
      
      // Update physics for all objects
      const currentTime = Date.now();
      world.updatePhysics(currentTime);
      
      // Mark world as dirty for persistence (critical fix!)
      cacheManager.updateWorldUnsafe(world, worldCtx);
      
      // Return world data
      const worldData = world.getWorldData();
      return NextResponse.json(worldData);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
