import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { createLockContext } from '@/lib/server/typedLocks';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // console.log(`🌍 World data request - userId: ${session.userId}`);

    // Get typed cache manager singleton
    const cacheManager = getTypedCacheManager();
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    
    // Execute with world write lock (we're modifying world state with physics)
    const worldCtx = await cacheManager.acquireWorldWrite(emptyCtx);
    try {
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
    } finally {
      worldCtx.dispose();
    }
  } catch (error) {
    return handleApiError(error);
  }
}
