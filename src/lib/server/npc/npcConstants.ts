/**
 * Constants and utility functions for the NPC ID scheme.
 *
 * ID layout:
 *   Regular space objects / users: 1 … 999 999
 *   NPC user IDs:                  1 000 000 … 1 999 999 999
 *   Starbase IDs:                  2 000 000 000+
 */

/** Base offset for NPC user IDs */
export const NPC_USER_ID_OFFSET = 1_000_000;

/** Number of NPC IDs reserved per player */
export const NPC_IDS_PER_USER = 1_000;

/** Number of NPCs spawned per player */
export const NPC_COUNT = 4;

/** Orbit radius around the starbase centre (in world units) */
export const ORBIT_RADIUS = 750;

/** Starbase centre X coordinate */
export const STARBASE_X = 4000;

/** Starbase centre Y coordinate */
export const STARBASE_Y = 4000;

/** Base angular velocity in degrees per second (full circle ≈ 12 min) */
export const BASE_ANGULAR_VELOCITY_DEG_PER_SEC = 0.5;

/** Starting angles for the 4 NPCs (one per quadrant) */
export const NPC_START_ANGLES = [0, 90, 180, 270] as const;

/** Compute the deterministic NPC user ID from owner and index. */
export function npcUserId(ownerId: number, npcIndex: number): number {
  return NPC_USER_ID_OFFSET + ownerId * NPC_IDS_PER_USER + npcIndex;
}

/** Return true when `id` falls within the NPC user-ID range. */
export function isNpcId(id: number): boolean {
  return id >= NPC_USER_ID_OFFSET && id < 2_000_000_000;
}

/** Decompose an NPC user ID into ownerId + npcIndex, or null if not an NPC ID. */
export function parseNpcId(id: number): { ownerId: number; npcIndex: number } | null {
  if (!isNpcId(id)) return null;
  const offset = id - NPC_USER_ID_OFFSET;
  const ownerId = Math.floor(offset / NPC_IDS_PER_USER);
  const npcIndex = offset % NPC_IDS_PER_USER;
  return { ownerId, npcIndex };
}
