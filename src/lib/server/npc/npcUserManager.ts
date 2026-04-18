// ---
// NPC User Manager: Creates and manages NPC User objects for the battle system.
// NPC users are created lazily when attacked and cleaned up after battle resolution.
// ---

import { LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { User } from '../user/user';
import { UserCache } from '../user/userCache';
import { WorldCache } from '../world/worldCache';
import { WORLD_LOCK } from '../typedLocks';
import { TechService } from '../techs/TechService';
import {
  createNpcTechCounts,
  createNpcTechTree,
  generateNpcUsername,
  calculateNpcPosition,
  calculateNpcFacingAngle,
  calculateNpcSpeed,
  resolveNpcUserId,
  markNpcDefeated,
} from './npcService';
import {
  isNpcUserId,
  getNpcSpaceObjectId,
  NPC_PICTURE_ID,
} from '@/shared/npcConstants';

/**
 * Ensure an NPC user exists in UserCache and its ship exists in WorldCache.
 * Creates them if they don't exist yet. This is called when a player attacks an NPC.
 * 
 * @param userContext - Lock context with USER_LOCK held
 * @param npcUserId - The NPC's user ID (negative)
 * @param playerUserId - The attacking player's user ID
 * @returns The NPC User object
 */
export async function ensureNpcUserExists(
  userContext: LockContext<LocksAtMostAndHas4>,
  npcUserId: number,
): Promise<User | null> {
  if (!isNpcUserId(npcUserId)) return null;

  const userCache = UserCache.getInstance2();
  
  // Check if already in cache
  const existing = userCache.getUserByIdFromCache(userContext, npcUserId);
  if (existing) return existing;

  // Resolve player ID and NPC index
  const resolved = resolveNpcUserId(npcUserId);
  if (!resolved) return null;

  const { playerUserId, npcIndex } = resolved;

  // Get the player to determine NPC level
  const player = userCache.getUserByIdFromCache(userContext, playerUserId);
  if (!player) return null;

  const playerLevel = player.getLevel();
  const npcLevel = playerLevel + npcIndex;

  // Create NPC tech counts and tree
  const techCounts = createNpcTechCounts(npcLevel);
  const techTree = createNpcTechTree(npcLevel);

  // Calculate max defense values for the NPC (fully repaired)
  const maxDefense = TechService.calculateMaxDefense(techCounts, techTree);

  // Create the NPC's ship space object ID
  const shipId = getNpcSpaceObjectId(playerUserId, npcIndex);

  // Create NPC User object
  const npcUser = User.create(
    npcUserId,                    // id (negative)
    generateNpcUsername(npcLevel), // username
    'npc-no-login',               // password_hash (dummy)
    0,                             // iron
    0,                             // xp (not used for NPCs)
    Math.floor(Date.now() / 1000), // last_updated
    techTree,
    async () => { },               // saveCallback (no-op, NPCs don't persist)
    techCounts,
    maxDefense.hull,               // hullCurrent (fully repaired)
    maxDefense.armor,              // armorCurrent (fully repaired)
    maxDefense.shield,             // shieldCurrent (fully repaired)
    Math.floor(Date.now() / 1000), // defenseLastRegen
    false,                         // inBattle
    null,                          // currentBattleId
    [],                            // buildQueue
    null,                          // buildStartSec
    0,                             // teleportCharges
    0,                             // teleportLastRegen
    shipId,                        // ship_id
  );

  // Add NPC user to cache (not persisted to DB)
  userCache.setUserUnsafe(userContext, npcUser);

  // Also ensure the NPC ship exists in WorldCache
  await ensureNpcShipInWorld(userContext, playerUserId, npcIndex, shipId);

  return npcUser;
}

/**
 * Ensure an NPC ship exists in WorldCache.
 * This is needed for the battle system's distance checks and speed setting.
 */
async function ensureNpcShipInWorld(
  userContext: LockContext<LocksAtMostAndHas4>,
  playerUserId: number,
  npcIndex: number,
  shipId: number,
): Promise<void> {
  const worldCache = WorldCache.getInstance();

  await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);

    // Check if ship already exists
    const existingShip = world.spaceObjects.find(obj => obj.id === shipId);
    if (existingShip) return;

    // Create the ship at the NPC's current orbital position
    const currentTime = Date.now();
    const pos = calculateNpcPosition(npcIndex, currentTime);
    const angle = calculateNpcFacingAngle(npcIndex, currentTime);

    world.spaceObjects.push({
      id: shipId,
      type: 'player_ship',
      x: pos.x,
      y: pos.y,
      speed: calculateNpcSpeed(),
      angle,
      last_position_update_ms: currentTime,
      picture_id: NPC_PICTURE_ID,
    });

    await worldCache.updateWorldUnsafe(worldContext, world);
  });
}

/**
 * Clean up NPC user and ship after battle resolution.
 * Removes the NPC from UserCache and WorldCache.
 */
export async function cleanupNpcAfterBattle(
  userContext: LockContext<LocksAtMostAndHas4>,
  npcUserId: number,
): Promise<void> {
  if (!isNpcUserId(npcUserId)) return;

  const resolved = resolveNpcUserId(npcUserId);
  if (!resolved) return;

  const { playerUserId, npcIndex } = resolved;
  const shipId = getNpcSpaceObjectId(playerUserId, npcIndex);

  // Remove NPC user from UserCache
  const userCache = UserCache.getInstance2();
  userCache.removeUserFromCache(userContext, npcUserId);

  // Remove NPC ship from WorldCache
  const worldCache = WorldCache.getInstance();
  await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const idx = world.spaceObjects.findIndex(obj => obj.id === shipId);
    if (idx !== -1) {
      world.spaceObjects.splice(idx, 1);
      await worldCache.updateWorldUnsafe(worldContext, world);
    }
  });
}

/**
 * Handle NPC defeat: mark as defeated and clean up.
 * Called when an NPC loses a battle.
 */
export async function handleNpcDefeat(
  userContext: LockContext<LocksAtMostAndHas4>,
  npcUserId: number,
): Promise<void> {
  const resolved = resolveNpcUserId(npcUserId);
  if (!resolved) return;

  markNpcDefeated(resolved.playerUserId, resolved.npcIndex);
  await cleanupNpcAfterBattle(userContext, npcUserId);
}

/**
 * Check if a user ID belongs to an NPC.
 * Re-exported from npcConstants for convenience.
 */
export { isNpcUserId };
