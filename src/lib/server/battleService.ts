// ---
// BattleScheduler: Automates periodic processing of active battles.
// Responsibilities:
//   - Triggers battle rounds at regular intervals via BattleService.
//   - Orchestrates battle lifecycle events (start, resolve, end).
//   - Sends notifications/messages to users.
// Main interaction partners:
//   - BattleService (for orchestration)
//   - BattleRepository/BattleCacheManager (for battle state)
//   - User/World managers (for state updates)
// Responsibilities to move:
//   - Any direct battle mechanics or persistence logic should move to BattleService or repository/cache managers.
// ---

import { BattleRepo } from './battleRepo';
import { BattleEngine } from './battle';
import type { Battle, BattleStats, BattleEvent, WeaponCooldowns } from '../../shared/battleTypes';
import type { User } from './user';
import { TechFactory } from './TechFactory';
import { ApiError } from './errors';
import { getTypedCacheManager } from './typedCacheManager';
import { createLockContext } from './typedLocks';
import { getBattleCache } from './BattleCache';

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
 * Max value = 100 * tech_count
 */
function getUserMaxDefenseStats(user: User): { hull: number; armor: number; shield: number} {
  return {
    hull: 100 * user.techCounts.ship_hull,
    armor: 100 * user.techCounts.kinetic_armor,
    shield: 100 * user.techCounts.energy_shield
  };
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
        weapons[weaponType] = {
          count,
          damage: spec.damage,
          cooldown: spec.cooldown
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
 * Helper function that delegates to TypedCacheManager
 */
async function getShipPosition(shipId: number): Promise<{ x: number; y: number } | null> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const worldCtx = await cacheManager.acquireWorldRead(ctx);
  try {
    const world = cacheManager.getWorldUnsafe(worldCtx);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    return ship ? { x: ship.x, y: ship.y } : null;
  } finally {
    worldCtx.dispose();
  }
}

/**
 * Set ship speed via World cache
 * Delegates to TypedCacheManager instead of bypassing cache
 */
async function setShipSpeed(shipId: number, speed: number): Promise<void> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const worldCtx = await cacheManager.acquireWorldWrite(ctx);
  try {
    const world = cacheManager.getWorldUnsafe(worldCtx);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    if (ship) {
      ship.speed = speed;
      cacheManager.updateWorldUnsafe(world, worldCtx);
    }
  } finally {
    worldCtx.dispose();
  }
}

/**
 * Update user battle state via User cache
 * Delegates to TypedCacheManager instead of bypassing cache
 */
async function updateUserBattleState(userId: number, inBattle: boolean, battleId: number | null): Promise<void> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const userCtx = await cacheManager.acquireUserLock(ctx);
  try {
    const user = cacheManager.getUserUnsafe(userId, userCtx);
    if (user) {
      user.inBattle = inBattle;
      user.currentBattleId = battleId;
      cacheManager.updateUserUnsafe(user, userCtx);
    }
  } finally {
    userCtx.dispose();
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
 * Delegates to TypedCacheManager instead of bypassing cache
 */
async function teleportShip(shipId: number, x: number, y: number): Promise<void> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const worldCtx = await cacheManager.acquireWorldWrite(ctx);
  try {
    const world = cacheManager.getWorldUnsafe(worldCtx);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    if (ship) {
      ship.x = x;
      ship.y = y;
      ship.speed = 0;
      ship.last_position_update_ms = Date.now();
      cacheManager.updateWorldUnsafe(world, worldCtx);
    }
  } finally {
    worldCtx.dispose();
  }
}

/**
 * Update user defense values via User cache
 * Delegates to TypedCacheManager with proper cache loading
 */
async function updateUserDefense(
  userId: number,
  hull: number,
  armor: number,
  shield: number
): Promise<void> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const userCtx = await cacheManager.acquireUserLock(ctx);
  try {
    // Load user from cache/DB if needed
    let user = cacheManager.getUserUnsafe(userId, userCtx);
    if (!user) {
      // Load from database
      const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
      try {
        user = await cacheManager.loadUserFromDbUnsafe(userId, dbCtx);
        if (user) {
          cacheManager.setUserUnsafe(user, userCtx);
        }
      } finally {
        dbCtx.dispose();
      }
    }
    
    if (user) {
      user.hullCurrent = hull;
      user.armorCurrent = armor;
      user.shieldCurrent = shield;
      user.defenseLastRegen = Math.floor(Date.now() / 1000);
      cacheManager.updateUserUnsafe(user, userCtx);
    }
    
  } finally {
    userCtx.dispose();
  }
}

/**
 * Get user's ship ID from User cache
 * Delegates to TypedCacheManager instead of bypassing cache
 */
async function getUserShipId(userId: number): Promise<number> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const userCtx = await cacheManager.acquireUserLock(ctx);
  try {
    const user = cacheManager.getUserUnsafe(userId, userCtx);
    if (!user || user.ship_id === undefined) {
      throw new Error('User not found or has no ship');
    }
    return user.ship_id;
  } finally {
    userCtx.dispose();
  }
}

/**
 * Initiate a battle between two users
 * NOTE: Caller should check battle state via user.inBattle before calling this
 * 
 * TECHNICAL DEBT: This function performs multiple direct DB writes
 * bypassing TypedCacheManager (setShipSpeed, updateUserBattleState).
 * Should be refactored to use cache-first architecture.
 * See TechnicalDebt.md for details.
 */
export async function initiateBattle(
  attacker: User,
  attackee: User
): Promise<Battle> {
  console.log(`⚔️ initiateBattle: Starting battle between ${attacker.username} and ${attackee.username}`);
  
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
  const attackerPos = await getShipPosition(attacker.ship_id);
  const attackeePos = await getShipPosition(attackee.ship_id);
  
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
  await setShipSpeed(attacker.ship_id, 0);
  await setShipSpeed(attackee.ship_id, 0);
  
  console.log(`⚔️ initiateBattle: Creating battle in database...`);
  // Create battle in database with initial cooldowns
  const battle = await BattleRepo.createBattle(
    attacker.id,
    attackee.id,
    attackerStats,
    attackeeStats,
    attackerCooldowns,
    attackeeCooldowns
  );
  
  console.log(`⚔️ initiateBattle: Updating user battle states...`);
  // Update users' battle state
  await updateUserBattleState(attacker.id, true, battle.id);
  await updateUserBattleState(attackee.id, true, battle.id);
  
  // Log battle start event
  const startEvent: BattleEvent = {
    timestamp: Math.floor(Date.now() / 1000),
    type: 'battle_started',
    actor: 'attacker',
    data: {
      message: `Battle initiated at distance ${distance.toFixed(1)} units`
    }
  };
  
  await BattleRepo.addBattleEvent(battle.id, startEvent);
  
  console.log(`⚔️ Battle ${battle.id} started: User ${attacker.id} vs User ${attackee.id}`);
  
  return battle;
}

/**
 * Update an ongoing battle (process one combat round)
 */
export async function updateBattle(battleId: number): Promise<Battle> {
  const battle = await BattleRepo.getBattle(battleId);
  
  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }
  
  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }
  
  // Create battle engine instance
  const battleEngine = new BattleEngine(battle);
  
  // Process combat until next shot (max 100 turns)
  const now = Math.floor(Date.now() / 1000);
  const events = await battleEngine.processBattleUntilNextShot(100);
  
  // Save events to database
  for (const event of events) {
    await BattleRepo.addBattleEvent(battleId, event);
  }
  
  // Update weapon cooldowns
  await BattleRepo.updateWeaponCooldowns(battleId, battle.attackerId, battle.attackerWeaponCooldowns);
  await BattleRepo.updateWeaponCooldowns(battleId, battle.attackeeId, battle.attackeeWeaponCooldowns);
  
  // Note: Defense values are updated directly in User objects during combat
  // We don't need to call updateBattleDefenses here anymore
  
  // Check if battle is over
  if (await battleEngine.isBattleOver()) {
    const outcome = await battleEngine.getBattleOutcome();
    if (outcome) {
      await resolveBattle(battleId, outcome.winnerId);
    }
  }
  
  // Return updated battle
  return BattleRepo.getBattle(battleId) as Promise<Battle>;
}

/**
 * Resolve a battle (determine winner and apply consequences)
 */
export async function resolveBattle(
  battleId: number,
  winnerId: number
): Promise<void> {
  const battle = await BattleRepo.getBattle(battleId);
  
  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }
  
  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }
  
  const loserId = winnerId === battle.attackerId ? battle.attackeeId : battle.attackerId;
  
  // Snapshot final defense values from User objects to create endStats
  // This is the "write once at end of battle" for endStats
  const cacheManager = getTypedCacheManager();
  let attackerEndStats: BattleStats;
  let attackeeEndStats: BattleStats;
  
  {
    const ctx = createLockContext();
    const userCtx = await cacheManager.acquireUserLock(ctx);
    try {
      let attacker = cacheManager.getUserUnsafe(battle.attackerId, userCtx);
      let attackee = cacheManager.getUserUnsafe(battle.attackeeId, userCtx);
      
      // Load from DB if not in cache
      if (!attacker) {
        const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
        try {
          attacker = await cacheManager.loadUserFromDbUnsafe(battle.attackerId, dbCtx);
          if (attacker) cacheManager.setUserUnsafe(attacker, userCtx);
        } finally {
          dbCtx.dispose();
        }
      }
      
      if (!attackee) {
        const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
        try {
          attackee = await cacheManager.loadUserFromDbUnsafe(battle.attackeeId, dbCtx);
          if (attackee) cacheManager.setUserUnsafe(attackee, userCtx);
        } finally {
          dbCtx.dispose();
        }
      }
      
      if (!attacker || !attackee) {
        throw new Error('Users not found when resolving battle');
      }
      
      // Create endStats from current user defense values
      attackerEndStats = {
        hull: { current: attacker.hullCurrent, max: attacker.techCounts.ship_hull * 100 },
        armor: { current: attacker.armorCurrent, max: attacker.techCounts.kinetic_armor * 100 },
        shield: { current: attacker.shieldCurrent, max: attacker.techCounts.energy_shield * 100 },
        weapons: battle.attackerStartStats.weapons // Weapons don't change
      };
      
      attackeeEndStats = {
        hull: { current: attackee.hullCurrent, max: attackee.techCounts.ship_hull * 100 },
        armor: { current: attackee.armorCurrent, max: attackee.techCounts.kinetic_armor * 100 },
        shield: { current: attackee.shieldCurrent, max: attackee.techCounts.energy_shield * 100 },
        weapons: battle.attackeeStartStats.weapons // Weapons don't change
      };
    } finally {
      userCtx.dispose();
    }
  }
  
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
    
    await BattleRepo.addBattleEvent(battleId, endEvent);
  } catch (error) {
    console.error(`⚠️ Failed to log battle end event for battle ${battleId}:`, error);
    // Continue with battle resolution even if event logging fails
  }
  
  // End the battle in database (this removes it from cache)
  await BattleRepo.endBattle(
    battleId,
    winnerId,
    loserId,
    attackerEndStats,
    attackeeEndStats
  );
  
  // Clear battle state for both users
  await updateUserBattleState(battle.attackerId, false, null);
  await updateUserBattleState(battle.attackeeId, false, null);
  
  // Note: Defense values are already updated in User objects during battle
  // No need to call updateUserDefense here
  
  // Get ship IDs for teleportation
  const winnerShipId = await getUserShipId(winnerId);
  const loserShipId = await getUserShipId(loserId);
  
  const winnerPos = await getShipPosition(winnerShipId);
  
  if (winnerPos) {
    // Teleport loser to random position (minimum distance away)
    const teleportPos = generateTeleportPosition(
      winnerPos.x,
      winnerPos.y,
      MIN_TELEPORT_DISTANCE
    );
    
    await teleportShip(loserShipId, teleportPos.x, teleportPos.y);
    
    console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId} teleported to (${teleportPos.x.toFixed(0)}, ${teleportPos.y.toFixed(0)})`);
  }
}
