import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { WORLD_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { UserCache } from '@/lib/server/user/userCache';
import { STARBASES } from '@/shared/starbases';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import {
  BASE_ANGULAR_VELOCITY_DEG_PER_SEC,
  npcDisplayName,
} from '@/lib/server/npc/npcConstants';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import type { SpaceObject } from '@shared/types/gameTypes';
import type { NpcShip } from '@/lib/server/npc/npcTypes';

/** Convert an NpcShip to a SpaceObject for the world response. */
function npcToSpaceObject(npc: NpcShip, timeMultiplier: number, nowMs: number): SpaceObject {
  const pos = NPCManager.positionForAngle(npc.orbitAngleDeg);
  return {
    id: npc.id,
    type: 'npc_ship',
    x: pos.x,
    y: pos.y,
    speed: 0,
    angle: npc.orbitAngleDeg + 90, // tangent direction (counter-clockwise orbit)
    last_position_update_ms: nowMs,
    picture_id: npc.npcIndex + 1, // 1-4
    username: npcDisplayName(npc.level),
    userId: npc.id,
    level: npc.level,
    orbitAngleDeg: npc.orbitAngleDeg,
    angularVelocityDegPerSec: BASE_ANGULAR_VELOCITY_DEG_PER_SEC * timeMultiplier,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const userId = session.userId!;

    // Get player level for NPC generation (USER_LOCK < WORLD_LOCK, so acquire first)
    const userCtx = createLockContext();
    const user = await UserCache.getInstance2().getUserById(userCtx, userId);
    const playerLevel = user?.getLevel() ?? 1;

    // Update NPC positions and get active NPCs (pure in-memory, no lock needed)
    const npcManager = NPCManager.getInstance();
    const nowMs = Date.now();
    npcManager.updateNpcPositions(userId, nowMs);
    const activeNpcs = npcManager.getNpcsForPlayer(userId, playerLevel);
    const timeMultiplier = TimeMultiplierService.getInstance().getMultiplier();
    const npcObjects = activeNpcs.map((npc) => npcToSpaceObject(npc, timeMultiplier, nowMs));

    const emptyCtx = createLockContext();
    // Get typed cache manager singleton
    
    const worldCache = WorldCache.getInstance();
    return await emptyCtx.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      // Get world data safely (we have world write lock)
      const world = worldCache.getWorldFromCache(worldContext);
      
      // Update physics for all objects
      const currentTime = Date.now();
      world.updatePhysics(worldContext, currentTime);
      
      // Mark world as dirty for persistence (critical fix!)
      await worldCache.updateWorldUnsafe(worldContext, world);
      
      // Return world data with starbases and NPCs appended
      const worldData = world.getWorldData(worldContext);
      return NextResponse.json({
        ...worldData,
        spaceObjects: [...worldData.spaceObjects, ...STARBASES, ...npcObjects],
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
