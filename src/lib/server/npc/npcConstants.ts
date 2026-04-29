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

// Re-export shared orbit geometry so server code has a single import location
export { NPC_ORBIT_RADIUS as ORBIT_RADIUS, NPC_ORBIT_CENTER_X as STARBASE_X, NPC_ORBIT_CENTER_Y as STARBASE_Y } from '@shared/npcOrbit';

/** Base angular velocity in degrees per second (full circle ≈ 2.4 min) */
export const BASE_ANGULAR_VELOCITY_DEG_PER_SEC = 2.5;

/** Starting angles for the 4 NPCs (one per quadrant) */
export const NPC_START_ANGLES = [0, 90, 180, 270] as const;

/** Compute the deterministic NPC user ID from owner and NPC level.
 * Using level (not slot index) means the same NPC level always maps to the
 * same user-ID row, so battle history names stay correct after level-ups.
 */
export function npcUserId(ownerId: number, level: number): number {
  return NPC_USER_ID_OFFSET + ownerId * NPC_IDS_PER_USER + level;
}

/** Return the display name for an NPC of the given level. */
export function npcDisplayName(level: number): string {
  return `[L${level}-NPC]`;
}

/** Return true when `id` falls within the NPC user-ID range. */
export function isNpcId(id: number): boolean {
  return id >= NPC_USER_ID_OFFSET && id < 2_000_000_000;
}

/** Decompose an NPC user ID into ownerId + npcLevel, or null if not an NPC ID. */
export function parseNpcId(id: number): { ownerId: number; npcLevel: number } | null {
  if (!isNpcId(id)) return null;
  const offset = id - NPC_USER_ID_OFFSET;
  const ownerId = Math.floor(offset / NPC_IDS_PER_USER);
  const npcLevel = offset % NPC_IDS_PER_USER;
  return { ownerId, npcLevel };
}
