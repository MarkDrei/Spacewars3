// ---
// BattleService: High-level orchestration of battle lifecycle.
// Responsibilities:
//   - Initiate battles (initiateBattle)
//   - Update battles (updateBattle - process combat rounds)
//   - Resolve battles (resolveBattle - determine winner, apply consequences)
//   - Coordinate between BattleCache, BattleScheduler, and User/World caches
// Main interaction partners:
//   - BattleCache (via BattleRepo compatibility layer)
//   - BattleScheduler (for automated battle processing)
//   - getUserWorldCache (for user state updates)
//   - World cache (for ship positioning and teleportation)
// Status: ✅ Proper orchestration layer, uses cache delegation
// Note: Has helper functions (updateUserBattleState, getShipPosition, etc.)
//       These are used in battle initiation and resolution contexts.
// ---

import { BattleRepo } from './BattleCache';
import type { Battle, BattleStats, BattleEvent, WeaponCooldowns } from './battleTypes';
import type { User } from '../user/user';
import { TechFactory } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import { ApiError } from '../errors';
import { UserCache } from '../user/userCache';
import { getBattleCache } from './BattleCache';
import { HasLock2Context, IronLocks, LockContext, LocksAtMost4, LocksAtMostAndHas2, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { WORLD_LOCK, USER_LOCK, DATABASE_LOCK_USERS } from '../typedLocks';
import { getUserByIdFromDb } from '../user/userRepo';
import { WorldCache } from '../world/worldCache';

/**
 * Maximum distance to initiate battle (same as collection distance)
 */
const BATTLE_RANGE = 100;

/**
 * Minimum distance for teleportation after losing battle
 */
const MIN_TELEPORT_DISTANCE = 1000;

/**
 * World dimensions
 */
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;

/**
 * Get current defense values for a user
 */
function getUserDefenseStats(user: User): { hull: number; armor: number; shield: number } {
  return {
    hull: user.hullCurrent,
    armor: user.armorCurrent,
    shield: user.shieldCurrent
  };
}

/**
 * Get max defense values for a user based on tech counts
 * Uses TechService to calculate values including research factors
 */
function getUserMaxDefenseStats(user: User): { hull: number; armor: number; shield: number } {
  return TechService.calculateMaxDefense(user.techCounts, user.techTree);
}

/**
 * Create battle stats snapshot for a user
 */
function createBattleStats(user: User): BattleStats {
  const current = getUserDefenseStats(user);
  const max = getUserMaxDefenseStats(user);

  const weapons: BattleStats['weapons'] = {};

  // Add all weapons the user has
  const weaponTypes = ['pulse_laser', 'auto_turret', 'plasma_lance', 'gauss_rifle', 'photon_torpedo', 'rocket_launcher'] as const;

  for (const weaponType of weaponTypes) {
    const count = user.techCounts[weaponType];
    if (count > 0) {
      const spec = TechFactory.getWeaponSpec(weaponType);
      if (spec) {
        // Calculate reload time based on research effects
        const reloadTime = TechFactory.calculateReloadTime(weaponType, user.techTree);
        
        // Skip weapon if reload time calculation fails
        if (reloadTime === null) {
          console.warn(`Failed to calculate reload time for ${weaponType}`);
          continue;
        }
        
        weapons[weaponType] = {
          count,
          damage: spec.damage,
          cooldown: reloadTime // Using calculated reload time instead of spec.cooldown
        };
      }
    }
  }

  return {
    hull: { current: current.hull, max: max.hull },
    armor: { current: current.armor, max: max.armor },
    shield: { current: current.shield, max: max.shield },
    weapons
  };
}

/**
 * Calculate distance between two positions
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get ship position from World cache
 * Helper function that delegates to TypeduserWorldCache
 */
async function getShipPosition(context: LockContext<LocksAtMost4>, shipId: number): Promise<{ x: number; y: number } | null> {
  const worldCache = WorldCache.getInstance();
  return await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    return ship ? { x: ship.x, y: ship.y } : null;

  });
}

/**
 * Set ship speed via World cache
 * Delegates to TypeduserWorldCache instead of bypassing cache
 */
async function setShipSpeed(context: LockContext<LocksAtMostAndHas4>, shipId: number, speed: number): Promise<void> {
  const worldCache = WorldCache.getInstance();
  return await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    if (ship) {
      ship.speed = speed;
      await worldCache.updateWorldUnsafe(worldContext, world);
    }
  });
}

/**
 * Update user battle state via User cache
 */
async function updateUserBattleState(context: LockContext<LocksAtMostAndHas4>, userId: number, inBattle: boolean, battleId: number | null): Promise<void> {
  const userWorldCache = UserCache.getInstance2();
  const user = userWorldCache.getUserByIdFromCache(context, userId);
  if (user) {
    user.inBattle = inBattle;
    user.currentBattleId = battleId;
    userWorldCache.updateUserInCache(context, user);
  }
}

/**
 * Generate random position with minimum distance from a point
 */
function generateTeleportPosition(
  fromX: number,
  fromY: number,
  minDistance: number
): { x: number; y: number } {
  let x: number, y: number, distance: number;

  // Try up to 100 times to find a valid position
  for (let i = 0; i < 100; i++) {
    x = Math.random() * WORLD_WIDTH;
    y = Math.random() * WORLD_HEIGHT;
    distance = calculateDistance(fromX, fromY, x, y);

    if (distance >= minDistance) {
      return { x, y };
    }
  }

  // Fallback: place at opposite corner
  return {
    x: fromX > WORLD_WIDTH / 2 ? 0 : WORLD_WIDTH,
    y: fromY > WORLD_HEIGHT / 2 ? 0 : WORLD_HEIGHT
  };
}

/**
 * Teleport ship to new position via World cache
 * Delegates to TypeduserWorldCache instead of bypassing cache
 * 
 * TODO: Move this to userWorldCache.ts as a method
 */
async function teleportShip(context: LockContext<LocksAtMostAndHas4>, shipId: number, x: number, y: number): Promise<void> {
  const worldCache = WorldCache.getInstance();
  await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    if (ship) {
      ship.x = x;
      ship.y = y;
      ship.speed = 0;
      ship.last_position_update_ms = Date.now();
      await worldCache.updateWorldUnsafe(worldContext, world);
    }
  });
}

/**
 * Get user's ship ID from User cache
 */
async function getUserShipId(context: LockContext<LocksAtMostAndHas4>, userId: number): Promise<number> {
  const userWorldCache = UserCache.getInstance2();

  const user = userWorldCache.getUserByIdFromCache(context, userId);
  if (!user || user.ship_id === undefined) {
    throw new Error('User not found or has no ship');
  }
  return user.ship_id;

}

/**
 * Initiate a battle between two users
 * NOTE: Caller should check battle state via user.inBattle before calling this
 * 
 * TECHNICAL DEBT: This function performs multiple direct DB writes
 * bypassing TypeduserWorldCache (setShipSpeed, updateUserBattleState).
 * Should be refactored to use cache-first architecture.
 * See TechnicalDebt.md for details.
 */
export async function initiateBattle<THeld extends IronLocks>(
  contextBattle: HasLock2Context<THeld>,
  contextUser: LockContext<LocksAtMostAndHas4>,
  attacker: User,
  attackee: User
): Promise<Battle> {
  console.log(`⚔️ BattleService.initiateBattle(): Starting battle between ${attacker.username} and ${attackee.username}`);

  // Validation: Check battle state from user objects (no DB access needed)
  if (attacker.inBattle) {
    throw new ApiError(400, 'You are already in a battle');
  }

  if (attackee.inBattle) {
    throw new ApiError(400, 'Target is already in a battle');
  }

  // Validation: Check if both users have ships
  if (!attacker.ship_id || !attackee.ship_id) {
    throw new ApiError(400, 'Both users must have ships to battle');
  }

  console.log(`⚔️ initiateBattle: Getting ship positions...`);
  // Validation: Check distance
  const attackerPos = await getShipPosition(contextUser, attacker.ship_id);
  const attackeePos = await getShipPosition(contextUser, attackee.ship_id);

  if (!attackerPos || !attackeePos) {
    throw new ApiError(500, 'Could not determine ship positions');
  }

  const distance = calculateDistance(
    attackerPos.x,
    attackerPos.y,
    attackeePos.x,
    attackeePos.y
  );

  if (distance > BATTLE_RANGE) {
    throw new ApiError(400, `Target is too far away (${distance.toFixed(1)} units, max ${BATTLE_RANGE})`);
  }

  console.log(`⚔️ initiateBattle: Creating battle stats...`);
  // Create battle stats snapshots
  const attackerStats = createBattleStats(attacker);
  const attackeeStats = createBattleStats(attackee);

  // Validation: Check if attacker has weapons
  if (Object.keys(attackerStats.weapons).length === 0) {
    throw new ApiError(400, 'You need at least one weapon to attack');
  }

  console.log(`⚔️ initiateBattle: Initializing weapon cooldowns...`);
  // Initialize weapon cooldowns - all weapons start ready to fire (cooldown = 0)
  const attackerCooldowns: WeaponCooldowns = {};
  const attackeeCooldowns: WeaponCooldowns = {};

  // Set cooldown to 0 (ready to fire immediately) for all weapons
  Object.keys(attackerStats.weapons).forEach(weaponName => {
    attackerCooldowns[weaponName] = 0;
  });

  Object.keys(attackeeStats.weapons).forEach(weaponName => {
    attackeeCooldowns[weaponName] = 0;
  });

  console.log(`⚔️ initiateBattle: Setting ship speeds to 0...`);
  // Set both ships' speeds to 0
  await setShipSpeed(contextUser, attacker.ship_id, 0);
  await setShipSpeed(contextUser, attackee.ship_id, 0);

  console.log(`⚔️ initiateBattle: Creating battle in database...`);
  // Create battle in database with initial cooldowns
  const battleCache = getBattleCache();
  const battle = await battleCache!.createBattle(
    contextBattle,
    contextUser,
    attacker.id,
    attackee.id,
    attackerStats,
    attackeeStats,
    attackerCooldowns,
    attackeeCooldowns
  );

  console.log(`⚔️ initiateBattle: Updating user battle states...`);
  // Update users' battle state
  await updateUserBattleState(contextUser, attacker.id, true, battle.id);
  await updateUserBattleState(contextUser, attackee.id, true, battle.id);

  // Log battle start event
  const startEvent: BattleEvent = {
    timestamp: Math.floor(Date.now() / 1000),
    type: 'battle_started',
    actor: 'attacker',
    data: {
      message: `Battle initiated at distance ${distance.toFixed(1)} units`
    }
  };

  await BattleRepo.addBattleEvent(contextUser, battle.id, startEvent);

  console.log(`⚔️ Battle ${battle.id} started: User ${attacker.id} vs User ${attackee.id}`);

  return battle;
}

/**
 * Update an ongoing battle (process one combat round)
 * Note: In production, battles are processed automatically by battleScheduler.
 * This method is primarily for testing and manual battle progression.
 */
export async function updateBattle(context: LockContext<LocksAtMostAndHas2>, battleId: number): Promise<Battle> {
  const battle = await BattleRepo.getBattle(context, battleId);

  console.log(`⚔️ BattleService.updateBattle(): 1: Processing battle ${battleId}`); // TODO: Remove debug
  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }

  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }

  // Import processActiveBattles to avoid circular dependency
  const { processActiveBattles } = await import('./battleScheduler');
  
  // Process all active battles using the production code path
  await processActiveBattles(context);

  // Return updated battle state
  const updatedBattle = await BattleRepo.getBattle(context, battleId);
  if (!updatedBattle) {
    throw new ApiError(404, 'Battle not found after processing');
  }

  return updatedBattle;
}

/**
 * Resolve a battle (determine winner and apply consequences)
 */
export async function resolveBattle(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  winnerId: number
): Promise<void> {
  const battle = await BattleRepo.getBattle(context, battleId);

  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }

  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }

  const loserId = winnerId === battle.attackerId ? battle.attackeeId : battle.attackerId;

  // Snapshot final defense values from User objects to create endStats
  // This is the "write once at end of battle" for endStats
  const userWorldCache = UserCache.getInstance2();
  const [attackerEndStats, attackeeEndStats] = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    let attacker = userWorldCache.getUserByIdFromCache(userContext, battle.attackerId);
    let attackee = userWorldCache.getUserByIdFromCache(userContext, battle.attackeeId);

    // Load from DB if not in cache
    if (!attacker) {
      attacker = await userContext.useLockWithAcquire(DATABASE_LOCK_USERS, async () => {
        const db = await userWorldCache.getDatabaseConnection(userContext);
        const loadedAttacker = await getUserByIdFromDb(db, battle.attackerId, async () => { });
        if (loadedAttacker) userWorldCache.setUserUnsafe(userContext, loadedAttacker);
        return loadedAttacker;
      });
    }

    if (!attackee) {
      attackee = await userContext.useLockWithAcquire(DATABASE_LOCK_USERS, async () => {
        const db = await userWorldCache.getDatabaseConnection(userContext);
        const loadedAttackee = await getUserByIdFromDb(db, battle.attackeeId, async () => { });
        if (loadedAttackee) userWorldCache.setUserUnsafe(userContext, loadedAttackee);
        return loadedAttackee;
      });
    }

    if (!attacker || !attackee) {
      throw new Error('Users not found when resolving battle');
    }

    // Create endStats from current user defense values
    const attackerStats: BattleStats = {
      hull: { current: attacker.hullCurrent, max: attacker.techCounts.ship_hull * 100 },
      armor: { current: attacker.armorCurrent, max: attacker.techCounts.kinetic_armor * 100 },
      shield: { current: attacker.shieldCurrent, max: attacker.techCounts.energy_shield * 100 },
      weapons: battle.attackerStartStats.weapons // Weapons don't change
    };

    const attackeeStats: BattleStats = {
      hull: { current: attackee.hullCurrent, max: attackee.techCounts.ship_hull * 100 },
      armor: { current: attackee.armorCurrent, max: attackee.techCounts.kinetic_armor * 100 },
      shield: { current: attackee.shieldCurrent, max: attackee.techCounts.energy_shield * 100 },
      weapons: battle.attackeeStartStats.weapons // Weapons don't change
    };

    return [attackerStats, attackeeStats] as const;
  });

  // Log battle end event BEFORE ending battle (battle must still be in cache)
  // If event logging fails, we still proceed with ending the battle to avoid inconsistent state
  try {
    const endEvent: BattleEvent = {
      timestamp: Math.floor(Date.now() / 1000),
      type: 'battle_ended',
      actor: winnerId === battle.attackerId ? 'attacker' : 'attackee',
      data: {
        message: `Battle ended. Winner: User ${winnerId}`
      }
    };

    await BattleRepo.addBattleEvent(context, battleId, endEvent);
  } catch (error) {
    console.error(`⚠️ Failed to log battle end event for battle ${battleId}:`, error);
    // Continue with battle resolution even if event logging fails
  }

  // End the battle in database (this removes it from cache)
  await BattleRepo.endBattle(
    context,
    battleId,
    winnerId,
    loserId,
    attackerEndStats,
    attackeeEndStats
  );

  await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    // Clear battle state for both users
    await updateUserBattleState(userContext, battle.attackerId, false, null);
    await updateUserBattleState(userContext, battle.attackeeId, false, null);

    // Note: Defense values are already updated in User objects during battle
    // No need to call updateUserDefense here

    // Get ship IDs for teleportation
    const winnerShipId = await getUserShipId(userContext, winnerId);
    const loserShipId = await getUserShipId(userContext, loserId);

    const winnerPos = await getShipPosition(userContext, winnerShipId);

    if (winnerPos) {
      // Teleport loser to random position (minimum distance away)
      const teleportPos = generateTeleportPosition(
        winnerPos.x,
        winnerPos.y,
        MIN_TELEPORT_DISTANCE
      );

      await teleportShip(userContext, loserShipId, teleportPos.x, teleportPos.y);

      console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId} teleported to (${teleportPos.x.toFixed(0)}, ${teleportPos.y.toFixed(0)})`);
    }
  });
}
