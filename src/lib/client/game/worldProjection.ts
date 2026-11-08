import type { WorldData } from '@shared/types/gameTypes';
import { updateAllObjectPositions } from '@shared/physics';

/**
 * Projects the server world snapshot to `now`: moving objects continue along their heading at
 * their speed (wrapping at the world edges) until the next server update.
 *
 * The projection always starts from the snapshot, so calling it every animation frame does not
 * accumulate error. NPC ships are returned unchanged: their renderer interpolates the orbit from
 * `last_position_update_ms`, which the physics update would reset.
 */
export function projectWorldData(snapshot: WorldData, now: number, timeMultiplier: number): WorldData {
  const npcObjects = snapshot.spaceObjects.filter(obj => obj.type === 'npc_ship');
  const otherObjects = snapshot.spaceObjects.filter(obj => obj.type !== 'npc_ship');

  return {
    ...snapshot,
    spaceObjects: [
      ...updateAllObjectPositions(otherObjects, now, snapshot.worldSize, 50, timeMultiplier),
      ...npcObjects,
    ],
  };
}
