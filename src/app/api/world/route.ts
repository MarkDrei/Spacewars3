import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { WORLD_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { UserCache } from '@/lib/server/user/userCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { STARBASES } from '@/shared/starbases';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const emptyCtx = createLockContext();
    const worldCache = WorldCache.getInstance();
    const userCache = UserCache.getInstance2();

    // Acquire USER_LOCK first (level 4) to get player level, then WORLD_LOCK (level 6)
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = userCache.getUserByIdFromCache(userContext, session.userId!);
      const playerLevel = user?.getLevel() ?? 1;

      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // Get world data safely (we have world write lock)
        const world = worldCache.getWorldFromCache(worldContext);
        
        // Update physics for all objects
        const currentTime = Date.now();
        world.updatePhysics(worldContext, currentTime);
        
        // Mark world as dirty for persistence (critical fix!)
        await worldCache.updateWorldUnsafe(worldContext, world);
        
        // Get NPC space objects for this player
        const npcManager = NPCManager.getInstance();
        const npcObjects = npcManager.getNpcSpaceObjects(session.userId!, playerLevel, currentTime);

        // Return world data with hardcoded starbases and player-specific NPCs appended
        const worldData = world.getWorldData(worldContext);
        return NextResponse.json({
          ...worldData,
          spaceObjects: [...worldData.spaceObjects, ...STARBASES, ...npcObjects],
        });
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
