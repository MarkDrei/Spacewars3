import type { SpaceObject, WorldData } from '@shared/types/gameTypes';
import { updateAllObjectPositions } from '@shared/physics';

/** World units per second that one unit of object speed stands for (before the time multiplier). */
const SPEED_UNIT_PER_SECOND = 50 / 60;

/**
 * Position, heading and speed of an NPC ship at `now`. NPC ships circle a fixed point: the
 * snapshot carries the orbit angle at `last_position_update_ms` and the angular velocity (which
 * already includes the time multiplier, negative = clockwise).
 *
 * The speed is the tangential speed in ship speed units, so the intercept calculation treats the
 * NPC like any other moving object. The orbit fields of the snapshot stay untouched.
 */
export function projectNpcShip(npc: SpaceObject, now: number, timeMultiplier: number): SpaceObject {
  const { orbitAngleDeg, angularVelocityDegPerSec, orbitCenterX, orbitCenterY, orbitRadius } = npc;
  if (
    orbitAngleDeg === undefined ||
    angularVelocityDegPerSec === undefined ||
    orbitCenterX === undefined ||
    orbitCenterY === undefined ||
    orbitRadius === undefined
  ) {
    return npc;
  }

  const elapsedSec = (now - npc.last_position_update_ms) / 1000;
  const angleDeg = orbitAngleDeg + angularVelocityDegPerSec * elapsedSec;
  const angleRad = (angleDeg * Math.PI) / 180;
  const unitsPerSecond = Math.abs(angularVelocityDegPerSec) * (Math.PI / 180) * orbitRadius;

  return {
    ...npc,
    x: orbitCenterX + orbitRadius * Math.cos(angleRad),
    y: orbitCenterY + orbitRadius * Math.sin(angleRad),
    // Heading = tangent of the circle in the direction of travel
    angle: angleDeg + (angularVelocityDegPerSec >= 0 ? 90 : -90),
    speed: timeMultiplier > 0 ? unitsPerSecond / (SPEED_UNIT_PER_SECOND * timeMultiplier) : 0,
  };
}

/**
 * Projects the server world snapshot to `now`: moving objects continue along their heading at
 * their speed (wrapping at the world edges), NPC ships continue along their orbit, until the
 * next server update.
 *
 * The projection always starts from the snapshot, so calling it every animation frame does not
 * accumulate error.
 */
export function projectWorldData(snapshot: WorldData, now: number, timeMultiplier: number): WorldData {
  const npcObjects = snapshot.spaceObjects.filter(obj => obj.type === 'npc_ship');
  const otherObjects = snapshot.spaceObjects.filter(obj => obj.type !== 'npc_ship');

  return {
    ...snapshot,
    spaceObjects: [
      ...updateAllObjectPositions(otherObjects, now, snapshot.worldSize, 50, timeMultiplier),
      ...npcObjects.map(npc => projectNpcShip(npc, now, timeMultiplier)),
    ],
  };
}
