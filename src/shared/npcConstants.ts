// ---
// Shared constants for the NPC (Non-Player Character) system.
// NPCs are player-local ships that orbit the starbase and can be attacked.
// ---

import { STARBASES } from './starbases';

/** Number of NPCs each player sees */
export const NPC_COUNT_PER_PLAYER = 4;

/** Distance from starbase center at which NPCs orbit */
export const NPC_ORBIT_RADIUS = 750;

/** Clockwise orbit speed in degrees per second */
export const NPC_ORBIT_SPEED_DEG_PER_SEC = 2;

/** Space object ID offset for NPC ships (8000-8999 range) */
export const NPC_ID_OFFSET = 8000;

/** 
 * NPC user IDs are negative, derived from the player's userId and NPC index.
 * Formula: -(playerUserId * NPC_COUNT_PER_PLAYER + npcIndex + 1)
 * This ensures unique NPC user IDs per player.
 */
export const NPC_USER_ID_BASE = -1;

/** Default picture ID for NPC ships */
export const NPC_PICTURE_ID = 1;

/** Starbase center position (from the first starbase) */
export const NPC_ORBIT_CENTER = {
  x: STARBASES[0].x,
  y: STARBASES[0].y,
};

/**
 * Get a deterministic NPC user ID for a given player and NPC index.
 * Returns a negative number to distinguish from real users.
 */
export function getNpcUserId(playerUserId: number, npcIndex: number): number {
  return -(playerUserId * NPC_COUNT_PER_PLAYER + npcIndex + 1);
}

/**
 * Get a deterministic NPC space object ID for a given player and NPC index.
 */
export function getNpcSpaceObjectId(playerUserId: number, npcIndex: number): number {
  return NPC_ID_OFFSET + playerUserId * NPC_COUNT_PER_PLAYER + npcIndex;
}

/**
 * Check if a user ID belongs to an NPC (negative IDs are NPCs).
 */
export function isNpcUserId(userId: number): boolean {
  return userId < 0;
}

/**
 * Check if a space object ID belongs to an NPC.
 */
export function isNpcSpaceObjectId(objectId: number): boolean {
  return objectId >= NPC_ID_OFFSET && objectId < NPC_ID_OFFSET + 1000;
}
