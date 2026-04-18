// ---
// NPC Service: Manages player-local NPCs that orbit the starbase.
// NPCs are computed dynamically per player based on their level and the current time.
// They are not stored in the database or WorldCache - they're injected into the
// world API response on each request.
// ---

import type { SpaceObject } from '@shared/types/gameTypes';
import type { TechCounts } from '../techs/TechFactory';
import { TechTree, createInitialTechTree } from '../techs/techtree';
import {
  NPC_COUNT_PER_PLAYER,
  NPC_ORBIT_RADIUS,
  NPC_ORBIT_SPEED_DEG_PER_SEC,
  NPC_ORBIT_CENTER,
  NPC_PICTURE_ID,
  getNpcUserId,
  getNpcSpaceObjectId,
} from '@/shared/npcConstants';

/** Weapon keys available for NPC random weapon assignment */
const WEAPON_KEYS = [
  'pulse_laser',
  'auto_turret',
  'plasma_lance',
  'gauss_rifle',
  'photon_torpedo',
  'rocket_launcher',
] as const;

/**
 * Track defeated NPCs per player. Map of userId → Set of npcIndex values.
 * Resets at midnight.
 */
const defeatedNpcs = new Map<number, Set<number>>();

/** Date string of the last reset (YYYY-MM-DD format) */
let lastResetDate = new Date().toISOString().split('T')[0];

/**
 * Check if we need to reset defeated NPCs (new day).
 * Called on each NPC generation to ensure midnight resets happen.
 */
function checkMidnightReset(): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== lastResetDate) {
    defeatedNpcs.clear();
    lastResetDate = today;
  }
}

/**
 * Mark an NPC as defeated for a specific player.
 */
export function markNpcDefeated(playerUserId: number, npcIndex: number): void {
  let playerDefeated = defeatedNpcs.get(playerUserId);
  if (!playerDefeated) {
    playerDefeated = new Set();
    defeatedNpcs.set(playerUserId, playerDefeated);
  }
  playerDefeated.add(npcIndex);
}

/**
 * Check if an NPC has been defeated by a specific player today.
 */
export function isNpcDefeated(playerUserId: number, npcIndex: number): boolean {
  checkMidnightReset();
  const playerDefeated = defeatedNpcs.get(playerUserId);
  return playerDefeated?.has(npcIndex) ?? false;
}

/**
 * Reset all defeated NPCs (used for testing and midnight reset).
 */
export function resetDefeatedNpcs(): void {
  defeatedNpcs.clear();
  lastResetDate = new Date().toISOString().split('T')[0];
}

/**
 * Calculate the NPC level for a given player level and NPC index.
 * NPC 0 = playerLevel, NPC 1 = playerLevel+1, etc.
 */
export function getNpcLevel(playerLevel: number, npcIndex: number): number {
  return playerLevel + npcIndex;
}

/**
 * Generate a display name for an NPC based on its level.
 */
export function generateNpcUsername(npcLevel: number): string {
  return `Pirate Lv.${npcLevel}`;
}

/**
 * Calculate the orbital angle (in radians) for an NPC at a given time.
 * NPCs orbit clockwise, evenly spaced 90° apart.
 * 
 * @param npcIndex - NPC index (0-3)
 * @param currentTimeMs - Current time in milliseconds
 * @returns Angle in radians
 */
export function calculateNpcOrbitAngle(npcIndex: number, currentTimeMs: number): number {
  const baseAngleDeg = npcIndex * (360 / NPC_COUNT_PER_PLAYER);
  // Clockwise rotation: subtract time-based angle
  const timeAngleDeg = (currentTimeMs / 1000) * NPC_ORBIT_SPEED_DEG_PER_SEC;
  const angleDeg = baseAngleDeg - timeAngleDeg;
  return (angleDeg * Math.PI) / 180;
}

/**
 * Calculate the position of an NPC on its orbit around the starbase.
 * 
 * @param npcIndex - NPC index (0-3)
 * @param currentTimeMs - Current time in milliseconds
 * @returns {x, y} position in world coordinates
 */
export function calculateNpcPosition(npcIndex: number, currentTimeMs: number): { x: number; y: number } {
  const angleRad = calculateNpcOrbitAngle(npcIndex, currentTimeMs);
  return {
    x: NPC_ORBIT_CENTER.x + NPC_ORBIT_RADIUS * Math.cos(angleRad),
    y: NPC_ORBIT_CENTER.y + NPC_ORBIT_RADIUS * Math.sin(angleRad),
  };
}

/**
 * Calculate the facing angle of an NPC (tangent to orbit, clockwise direction).
 * Returns angle in degrees (0-360).
 */
export function calculateNpcFacingAngle(npcIndex: number, currentTimeMs: number): number {
  const orbitAngleRad = calculateNpcOrbitAngle(npcIndex, currentTimeMs);
  // Tangent for clockwise motion: perpendicular to radius, pointing clockwise
  // Clockwise tangent = orbit angle - 90°
  const facingRad = orbitAngleRad - Math.PI / 2;
  let facingDeg = (facingRad * 180) / Math.PI;
  // Normalize to 0-360
  facingDeg = ((facingDeg % 360) + 360) % 360;
  return facingDeg;
}

/**
 * Calculate the linear speed of an NPC along its orbit.
 * speed = angular_velocity * radius (in units per second)
 */
export function calculateNpcSpeed(): number {
  const angularVelocityRad = (NPC_ORBIT_SPEED_DEG_PER_SEC * Math.PI) / 180;
  return angularVelocityRad * NPC_ORBIT_RADIUS;
}

/**
 * Generate NPC space objects for a specific player.
 * Returns up to NPC_COUNT_PER_PLAYER NPCs, excluding any that were defeated today.
 * 
 * @param playerUserId - The player's user ID
 * @param playerLevel - The player's current level
 * @param currentTimeMs - Current time in milliseconds
 * @returns Array of SpaceObject representing NPCs
 */
export function generateNpcsForPlayer(
  playerUserId: number,
  playerLevel: number,
  currentTimeMs: number
): SpaceObject[] {
  checkMidnightReset();

  const npcs: SpaceObject[] = [];

  for (let i = 0; i < NPC_COUNT_PER_PLAYER; i++) {
    if (isNpcDefeated(playerUserId, i)) {
      continue;
    }

    const npcLevel = getNpcLevel(playerLevel, i);
    const position = calculateNpcPosition(i, currentTimeMs);
    const facingAngle = calculateNpcFacingAngle(i, currentTimeMs);
    const speed = calculateNpcSpeed();

    const npc: SpaceObject = {
      id: getNpcSpaceObjectId(playerUserId, i),
      type: 'player_ship',
      x: position.x,
      y: position.y,
      speed,
      angle: facingAngle,
      last_position_update_ms: currentTimeMs,
      picture_id: NPC_PICTURE_ID,
      username: generateNpcUsername(npcLevel),
      userId: getNpcUserId(playerUserId, i),
      level: npcLevel,
    };

    npcs.push(npc);
  }

  return npcs;
}

/**
 * Create NPC tech counts based on level.
 * Defense: 100 * 5^(level-1) of each defense type
 * Weapon: 10 * 5^(level-1) of one random weapon type
 */
export function createNpcTechCounts(npcLevel: number, randomWeaponIndex?: number): TechCounts {
  const scaleFactor = Math.pow(5, npcLevel - 1);
  const defenseCount = Math.round(100 * scaleFactor);
  const weaponCount = Math.round(10 * scaleFactor);

  // Pick a random weapon (or use provided index for testing)
  const weaponIdx = randomWeaponIndex ?? Math.floor(Math.random() * WEAPON_KEYS.length);
  const selectedWeapon = WEAPON_KEYS[weaponIdx % WEAPON_KEYS.length];

  const techCounts: TechCounts = {
    pulse_laser: 0,
    auto_turret: 0,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: defenseCount,
    kinetic_armor: defenseCount,
    energy_shield: defenseCount,
    missile_jammer: 0,
  };

  // Assign weapon count to the selected weapon
  techCounts[selectedWeapon] = weaponCount;

  return techCounts;
}

/**
 * Create NPC tech tree with all researches at the given level.
 */
export function createNpcTechTree(npcLevel: number): TechTree {
  const techTree = createInitialTechTree();

  // Set all research levels to npcLevel
  for (const key of Object.keys(techTree) as (keyof TechTree)[]) {
    if (key === 'activeResearch') continue;
    if (typeof techTree[key] === 'number') {
      (techTree[key] as number) = npcLevel;
    }
  }

  return techTree;
}

/**
 * Resolve an NPC user ID back to the player's userId and npcIndex.
 * Returns null if the userId is not a valid NPC user ID.
 */
export function resolveNpcUserId(npcUserId: number): { playerUserId: number; npcIndex: number } | null {
  if (npcUserId >= 0) return null;

  const positiveId = -npcUserId - 1;
  const playerUserId = Math.floor(positiveId / NPC_COUNT_PER_PLAYER);
  const npcIndex = positiveId % NPC_COUNT_PER_PLAYER;

  return { playerUserId, npcIndex };
}
