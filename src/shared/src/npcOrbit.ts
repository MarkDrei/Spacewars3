/**
 * Shared NPC orbit constants used by both client and server.
 *
 * Keeping these in shared/ avoids hardcoding the same numbers in the renderer
 * (NPCShipRenderer) and the client World parser, and ensures they stay in sync
 * with the server's NPCManager.
 */

/** Orbit radius around the starbase centre (in world units) */
export const NPC_ORBIT_RADIUS = 750;

/** X coordinate of the starbase (orbit centre) */
export const NPC_ORBIT_CENTER_X = 4000;

/** Y coordinate of the starbase (orbit centre) */
export const NPC_ORBIT_CENTER_Y = 4000;
