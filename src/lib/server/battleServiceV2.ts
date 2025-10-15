// ---
// Battle Service V2 - High-level battle operations with IronGuard V2
// Phase 5: Migrated to IronGuard V2 lock system
// ---

import { BattleRepoV2 } from './battleRepoV2';
import { BattleEngine } from './battle';
import type { Battle, BattleStats, WeaponCooldowns } from '../../shared/battleTypes';
import type { User } from './user';
import { TechFactory } from './TechFactory';
import { getDatabase } from './database';
import { ApiError } from './errors';
import { createLockContext, type LockContext, type LockLevel } from './ironGuardV2';
import { withBattleLock, withUserLock, withWorldLock, withDatabaseLock } from './lockHelpers';
import { getTypedCacheManagerV2 } from './typedCacheManagerV2';

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
 * Initialize weapon cooldowns for a user (all set to 0 = ready to fire)
 */
function initializeWeaponCooldowns(user: User): WeaponCooldowns {
  const cooldowns: WeaponCooldowns = {};
  
  const weaponTypes = ['pulse_laser', 'auto_turret', 'plasma_lance', 'gauss_rifle', 'photon_torpedo', 'rocket_launcher'] as const;
  
  for (const weaponType of weaponTypes) {
    if (user.techCounts[weaponType] > 0) {
      cooldowns[weaponType] = 0; // Ready to fire
    }
  }
  
  return cooldowns;
}

/**
 * Calculate distance between two points
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get ship position from world
 */
async function getShipPosition(shipId: number): Promise<{ x: number; y: number } | null> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  const ctx = createLockContext();
  
  return withWorldLock(ctx, async (worldCtx) => {
    const world = cacheManager.getWorldUnsafe(worldCtx);
    const ship = world.spaceObjects.find(obj => obj.id === shipId && obj.type === 'player_ship');
    return ship ? { x: ship.x, y: ship.y } : null;
  });
}

/**
 * Set ship speed
 */
async function setShipSpeed(shipId: number, speed: number): Promise<void> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  const ctx = createLockContext();
  
  return withWorldLock(ctx, async (worldCtx) => {
    cacheManager.setShipSpeedUnsafe(shipId, speed, worldCtx);
  });
}

/**
 * Teleport ship to a random location far from current position
 */
async function teleportShip(shipId: number): Promise<void> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  const ctx = createLockContext();
  
  return withWorldLock(ctx, async (worldCtx) => {
    // Get current position
    const world = cacheManager.getWorldUnsafe(worldCtx);
    const ship = world.spaceObjects.find(obj => obj.id === shipId && obj.type === 'player_ship');
    
    if (!ship) return;
    
    // Generate random position far away
    let newX, newY, distance;
    do {
      newX = Math.random() * WORLD_WIDTH;
      newY = Math.random() * WORLD_HEIGHT;
      distance = calculateDistance(ship.x, ship.y, newX, newY);
    } while (distance < MIN_TELEPORT_DISTANCE);
    
    cacheManager.teleportShipUnsafe(shipId, newX, newY, worldCtx);
  });
}

/**
 * Initiate a battle between two users
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 * Creates empty context and acquires locks as needed
 */
export async function initiateBattle(
  attacker: User,
  attackee: User
): Promise<Battle> {
  console.log(`⚔️ initiateBattle: Starting battle between ${attacker.username} and ${attackee.username}`);
  
  const ctx = createLockContext();
  
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
  
  console.log(`⚔️ initiateBattle: Distance between ships: ${distance.toFixed(2)}`);
  
  if (distance > BATTLE_RANGE) {
    throw new ApiError(400, `Target is too far away (${distance.toFixed(0)} units, max ${BATTLE_RANGE})`);
  }
  
  // Create battle stats for both users
  const attackerStats = createBattleStats(attacker);
  const attackeeStats = createBattleStats(attackee);
  
  // Initialize weapon cooldowns
  const attackerCooldowns = initializeWeaponCooldowns(attacker);
  const attackeeCooldowns = initializeWeaponCooldowns(attackee);
  
  console.log(`⚔️ initiateBattle: Creating battle in database...`);
  
  // Create battle using V2 repository (handles locks internally)
  const battle = await BattleRepoV2.createBattle(
    attacker.id,
    attackee.id,
    attackerStats,
    attackeeStats,
    attackerCooldowns,
    attackeeCooldowns
  );
  
  console.log(`⚔️ initiateBattle: Battle ${battle.id} created successfully`);
  
  // Update user battle states and stop ships using cache manager
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // Correct lock order: WORLD(20) → USER(30)
  return withWorldLock(ctx, async (worldCtx) => {
    return withUserLock(worldCtx, async (userCtx) => {
      // Update attacker
      attacker.inBattle = true;
      attacker.currentBattleId = battle.id;
      cacheManager.updateUserUnsafe(attacker, userCtx);
      
      // Update attackee
      attackee.inBattle = true;
      attackee.currentBattleId = battle.id;
      cacheManager.updateUserUnsafe(attackee, userCtx);
      
      // Stop both ships
      if (attacker.ship_id) {
        cacheManager.setShipSpeedUnsafe(attacker.ship_id, 0, worldCtx);
      }
      if (attackee.ship_id) {
        cacheManager.setShipSpeedUnsafe(attackee.ship_id, 0, worldCtx);
      }
      
      console.log(`⚔️ initiateBattle: User states updated, battle initiated!`);
      
      return battle;
    });
  });
}

/**
 * Update battle state (process combat)
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 */
export async function updateBattle(battleId: number): Promise<Battle> {
  // Get battle using V2 repository (handles locks internally)
  const battle = await BattleRepoV2.getBattle(battleId);
  
  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }
  
  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }
  
  // Create battle engine instance
  const battleEngine = new BattleEngine(battle);
  
  // Process combat until next shot (max 100 turns)
  battleEngine.processBattleUntilNextShot(100);
  
  // Update battle in database using V2 repository
  await BattleRepoV2.updateBattle(battle);
  
  // Check if battle is over
  if (battleEngine.isBattleOver()) {
    const outcome = battleEngine.getBattleOutcome();
    if (outcome) {
      await resolveBattle(battleId, outcome.winnerId);
    }
  }
  
  // Return updated battle
  const updatedBattle = await BattleRepoV2.getBattle(battleId);
  if (!updatedBattle) {
    throw new ApiError(500, 'Failed to retrieve updated battle');
  }
  
  return updatedBattle;
}

/**
 * Resolve a battle (determine winner and apply consequences)
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 */
export async function resolveBattle(
  battleId: number,
  winnerId: number
): Promise<void> {
  console.log(`🏆 resolveBattle: Resolving battle ${battleId}, winner: ${winnerId}`);
  
  const ctx = createLockContext();
  
  // Get battle
  const battle = await BattleRepoV2.getBattle(battleId);
  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }
  
  const loserId = battle.attackerId === winnerId ? battle.attackeeId : battle.attackerId;
  
  console.log(`🏆 resolveBattle: Winner: ${winnerId}, Loser: ${loserId}`);
  
  // Get users
  const [winner, loser] = await Promise.all([
    BattleRepoV2.getBattle(winnerId).then(() => null), // Placeholder - need actual user fetch
    BattleRepoV2.getBattle(loserId).then(() => null)
  ]);
  
  // Update battle end state
  battle.battleEndTime = Math.floor(Date.now() / 1000);
  battle.winnerId = winnerId;
  battle.loserId = loserId;
  
  await BattleRepoV2.updateBattle(battle);
  
  // Update user states using cache manager
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // Correct lock order: WORLD(20) → USER(30)
  return withWorldLock(ctx, async (worldCtx) => {
    return withUserLock(worldCtx, async (userCtx) => {
      // Load users
      const winnerUser = await cacheManager.loadUserIfNeeded(winnerId);
      const loserUser = await cacheManager.loadUserIfNeeded(loserId);
      
      if (!winnerUser || !loserUser) {
        throw new ApiError(500, 'Failed to load user data');
      }
      
      // Update winner
      winnerUser.inBattle = false;
      winnerUser.currentBattleId = null;
      cacheManager.updateUserUnsafe(winnerUser, userCtx);
      
      // Update loser - teleport their ship
      loserUser.inBattle = false;
      loserUser.currentBattleId = null;
      cacheManager.updateUserUnsafe(loserUser, userCtx);
      
      if (loserUser.ship_id) {
        // Teleport loser's ship
        const world = cacheManager.getWorldUnsafe(worldCtx);
        const ship = world.spaceObjects.find(obj => obj.id === loserUser.ship_id && obj.type === 'player_ship');
        
        if (ship) {
          // Generate random position far away
          let newX, newY;
          do {
            newX = Math.random() * WORLD_WIDTH;
            newY = Math.random() * WORLD_HEIGHT;
            const distance = calculateDistance(ship.x, ship.y, newX, newY);
            if (distance >= MIN_TELEPORT_DISTANCE) break;
          } while (true);
          
          cacheManager.teleportShipUnsafe(loserUser.ship_id, newX, newY, worldCtx);
          console.log(`🏆 resolveBattle: Loser's ship teleported to (${newX.toFixed(0)}, ${newY.toFixed(0)})`);
        }
      }
      
      console.log(`🏆 resolveBattle: Battle ${battleId} resolved successfully`);
    });
  });
}
