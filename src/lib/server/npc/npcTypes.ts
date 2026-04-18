// ---
// NPC type definitions for player-local NPC ships
// ---

/**
 * NPC ID offset to avoid collision with space objects (1-8999) and starbases (9000-9999).
 * NPC IDs: 20_000 + userId*10 + index
 */
export const NPC_ID_OFFSET = 20_000;

/**
 * Maximum number of NPCs per player
 */
export const NPCS_PER_PLAYER = 4;

/**
 * Orbit radius from starbase center (in world units)
 */
export const NPC_ORBIT_RADIUS = 750;

/**
 * Angular velocity in degrees per second (0.5 deg/s → full circle ≈ 12 min)
 * Clockwise = decreasing angle
 */
export const NPC_ANGULAR_VELOCITY_DEG_PER_SEC = 0.5;

/**
 * Starting angle offsets for NPCs (spread across quadrants)
 */
export const NPC_START_ANGLES = [0, 90, 180, 270];

/**
 * Starbase center position (hardcoded for now)
 */
export const STARBASE_CENTER_X = 4000;
export const STARBASE_CENTER_Y = 4000;

/**
 * Represents an NPC ship orbiting a starbase
 */
export interface NpcShip {
  /** Unique NPC ID: NPC_ID_OFFSET + ownerId*10 + index */
  id: number;
  /** Player who sees this NPC */
  ownerId: number;
  /** NPC's combat level */
  level: number;
  /** Current orbit angle in degrees */
  orbitAngleDeg: number;
  /** Angular velocity in degrees per second (negative = clockwise) */
  angularVelocityDegPerSec: number;
  /** Whether this NPC has been defeated */
  defeated: boolean;
  /** Timestamp when defeated (ms since epoch), null if not defeated */
  defeatTime: number | null;
  /** Whether this NPC is currently in battle */
  inBattle: boolean;
  /** Index of this NPC in the player's NPC array (0-3) */
  index: number;
}

/**
 * Per-player NPC state
 */
export interface PlayerNpcState {
  /** The NPCs for this player */
  npcs: NpcShip[];
  /** The player level when these NPCs were generated */
  lastGeneratedAtLevel: number;
  /** Last time positions were updated (ms since epoch) */
  lastUpdateMs: number;
  /** Mapping of npcId → userId for NPCs that have been attacked (DB user created) */
  npcUserIds: Map<number, number>;
}

/**
 * Calculate NPC ID from owner ID and index
 */
export function calculateNpcId(ownerId: number, index: number): number {
  return NPC_ID_OFFSET + (ownerId * 10) + index;
}

/**
 * Check if a given ID is in the NPC range
 */
export function isNpcId(id: number): boolean {
  return id >= NPC_ID_OFFSET;
}

/**
 * Extract owner ID and index from an NPC ID
 */
export function parseNpcId(npcId: number): { ownerId: number; index: number } | null {
  if (!isNpcId(npcId)) return null;
  const offset = npcId - NPC_ID_OFFSET;
  const ownerId = Math.floor(offset / 10);
  const index = offset % 10;
  return { ownerId, index };
}

/**
 * Calculate NPC position on its circular orbit
 */
export function calculateNpcPosition(orbitAngleDeg: number): { x: number; y: number } {
  const angleRad = orbitAngleDeg * Math.PI / 180;
  return {
    x: STARBASE_CENTER_X + NPC_ORBIT_RADIUS * Math.cos(angleRad),
    y: STARBASE_CENTER_Y + NPC_ORBIT_RADIUS * Math.sin(angleRad),
  };
}

/**
 * Calculate NPC facing direction (tangent to circle, clockwise)
 * For clockwise movement, the facing direction is angleDeg - 90
 */
export function calculateNpcFacingAngle(orbitAngleDeg: number): number {
  return orbitAngleDeg - 90;
}
