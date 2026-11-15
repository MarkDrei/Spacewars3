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
import { ambushPlayer, type AmbushResult } from '@/lib/server/npc/npcAmbush';
import { QuestService } from '@/lib/server/quests/QuestService';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import type { SpaceObject } from '@shared/types/gameTypes';
import type { NpcShip } from '@/lib/server/npc/npcTypes';
import {
  CONTACTS,
  HOSTILE_ARCHETYPES,
  contactAngleDeg,
  contactOrbit,
  hostileDisplayName,
  hostileOrbit,
  positionOnOrbit,
  type ContactDefinition,
  type HostileArchetypeId,
  type OrbitDefinition,
} from '@/shared/quests/npcArchetypes';
import { getWantedArchetypes } from '@/shared/quests/questEngine';

type Position = { x: number; y: number };

/** Space object of a ship that circles a location; the client continues the orbit between polls. */
function orbitingShip(
  orbit: OrbitDefinition,
  angleDeg: number,
  angularVelocityDegPerSec: number,
  nowMs: number
): Pick<
  SpaceObject,
  | 'type'
  | 'x'
  | 'y'
  | 'speed'
  | 'angle'
  | 'last_position_update_ms'
  | 'orbitAngleDeg'
  | 'angularVelocityDegPerSec'
  | 'orbitCenterX'
  | 'orbitCenterY'
  | 'orbitRadius'
> {
  const position = positionOnOrbit(orbit, angleDeg);
  return {
    type: 'npc_ship',
    x: position.x,
    y: position.y,
    speed: 0,
    // Tangent of the orbit, in the direction of travel
    angle: angleDeg + (angularVelocityDegPerSec >= 0 ? 90 : -90),
    last_position_update_ms: nowMs,
    orbitAngleDeg: angleDeg,
    angularVelocityDegPerSec,
    orbitCenterX: orbit.centerX,
    orbitCenterY: orbit.centerY,
    orbitRadius: orbit.radius,
  };
}

/** Convert a hostile NpcShip to a SpaceObject for the world response. */
function hostileToSpaceObject(
  npc: NpcShip,
  huntedArchetypes: readonly HostileArchetypeId[],
  timeMultiplier: number,
  nowMs: number
): SpaceObject {
  const archetype = HOSTILE_ARCHETYPES[npc.archetype];
  return {
    ...orbitingShip(hostileOrbit(archetype), npc.orbitAngleDeg, archetype.angularVelocityDegPerSec * timeMultiplier, nowMs),
    id: npc.id,
    picture_id: npc.spawn.pictureId,
    username: hostileDisplayName(npc.archetype, npc.level),
    userId: npc.id,
    level: npc.level,
    // Aggressive kinds attack only while a mission of the player hunts them
    npcDisposition: archetype.aggressive && huntedArchetypes.includes(npc.archetype) ? 'aggressive' : 'hostile',
    npcArchetype: npc.archetype,
  };
}

/** Space object of a friendly contact ship (mission giver). */
function contactToSpaceObject(contact: ContactDefinition, timeMultiplier: number, nowMs: number): SpaceObject {
  return {
    ...orbitingShip(
      contactOrbit(contact),
      contactAngleDeg(contact, nowMs, timeMultiplier),
      contact.angularVelocityDegPerSec * timeMultiplier,
      nowMs
    ),
    id: contact.objectId,
    picture_id: contact.pictureId,
    username: contact.shipName,
    npcDisposition: 'friendly',
    contactId: contact.id,
  };
}

/**
 * What happens to a ship at its position: locations are discovered / visited for missions, and
 * an aggressive NPC in range attacks if a mission of the player hunts its kind. Failures are
 * logged; the world is delivered regardless.
 */
async function applyShipPosition(
  userId: number,
  position: Position,
  visibleNpcs: readonly NpcShip[],
  huntedArchetypes: readonly HostileArchetypeId[],
  nowMs: number
): Promise<AmbushResult | null> {
  try {
    await QuestService.getInstance().recordVisits(createLockContext(), userId, position);
    const ambusher = NPCManager.getInstance().findAmbusher(userId, position, visibleNpcs, huntedArchetypes, nowMs);
    return ambusher ? await ambushPlayer(userId, ambusher, position) : null;
  } catch (error) {
    console.error('❌ Failed to apply ship position (visits / ambush):', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const userId = session.userId!;
    const quests = QuestService.getInstance();

    // Player level and missions decide which NPCs exist (USER_LOCK < WORLD_LOCK, so read first)
    const user = await UserCache.getInstance2().getUserById(createLockContext(), userId);
    const playerLevel = user?.getLevel() ?? 1;
    const wantedArchetypes = getWantedArchetypes(await quests.getState(createLockContext(), userId));

    // Update NPC positions and get active NPCs (pure in-memory, no lock needed)
    const npcManager = NPCManager.getInstance();
    const nowMs = Date.now();
    npcManager.updateNpcPositions(userId, nowMs);
    const activeNpcs = npcManager.getNpcsForPlayer(userId, playerLevel, wantedArchetypes);
    const timeMultiplier = TimeMultiplierService.getInstance().getMultiplier();

    const worldCache = WorldCache.getInstance();
    const shipId = user?.ship_id;
    const { worldData, shipPosition } = await createLockContext().useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      // getWorldFromCache advances physics to "now"
      const world = worldCache.getWorldFromCache(worldContext);

      // Mark the advanced positions for the next background write. A restart could recompute them
      // from an older snapshot, but only with the time multiplier of that moment, not with the one
      // that was active while the ships moved.
      await worldCache.updateWorldUnsafe(worldContext, world);

      const ship = shipId !== undefined ? world.getSpaceObject(worldContext, shipId) : undefined;
      const data = world.getWorldData(worldContext);
      return {
        // Copy: the list is extended below and must not change the cached world
        worldData: { ...data, spaceObjects: [...data.spaceObjects] },
        shipPosition: ship ? { x: ship.x, y: ship.y } : null,
      };
    });

    const ambush =
      user && !user.inBattle && shipPosition
        ? await applyShipPosition(userId, shipPosition, activeNpcs, wantedArchetypes, nowMs)
        : null;

    // The ambusher is in battle now; like an attacked NPC it is no longer shown on the map
    const visibleNpcs = ambush ? npcManager.getNpcsForPlayer(userId, playerLevel, wantedArchetypes) : activeNpcs;
    const questState = await quests.getState(createLockContext(), userId);

    return NextResponse.json({
      ...worldData,
      spaceObjects: [
        ...worldData.spaceObjects,
        ...STARBASES,
        ...visibleNpcs.map((npc) => hostileToSpaceObject(npc, wantedArchetypes, timeMultiplier, nowMs)),
        ...CONTACTS.map((contact) => contactToSpaceObject(contact, timeMultiplier, nowMs)),
      ],
      questRevision: questState.revision,
      ...(ambush ? { ambush } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
