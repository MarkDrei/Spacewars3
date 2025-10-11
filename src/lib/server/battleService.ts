// ---
// Battle Service - High-level battle operations
// ---

import { BattleRepo } from './battleRepo';
import { BattleEngine } from './battle';
import type { Battle, BattleStats, BattleEvent } from '../../shared/battleTypes';
import type { User } from './user';
import { TechFactory } from './TechFactory';
import { getDatabase } from './database';
import { ApiError } from './errors';

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
 * Get ship position from database
 */
async function getShipPosition(shipId: number): Promise<{ x: number; y: number } | null> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    db.get<{ x: number; y: number }>(
      'SELECT x, y FROM space_objects WHERE id = ?',
      [shipId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row || null);
      }
    );
  });
}

/**
 * Set ship speed to 0
 */
async function setShipSpeed(shipId: number, speed: number): Promise<void> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE space_objects SET speed = ? WHERE id = ?',
      [speed, shipId],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

/**
 * Update user's battle state in database
 */
async function updateUserBattleState(userId: number, inBattle: boolean, battleId: number | null): Promise<void> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET in_battle = ?, current_battle_id = ? WHERE id = ?',
      [inBattle ? 1 : 0, battleId, userId],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
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
 * Teleport ship to new position
 */
async function teleportShip(shipId: number, x: number, y: number): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE space_objects SET x = ?, y = ?, speed = 0, last_position_update_ms = ? WHERE id = ?',
      [x, y, now, shipId],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

/**
 * Update user's defense values in database
 */
async function updateUserDefense(
  userId: number,
  hull: number,
  armor: number,
  shield: number
): Promise<void> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET hull_current = ?, armor_current = ?, shield_current = ?, defense_last_regen = ? WHERE id = ?',
      [hull, armor, shield, now, userId],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

/**
 * Get user's ship ID from database
 */
async function getUserShipId(userId: number): Promise<number> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    db.get<{ ship_id: number }>('SELECT ship_id FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        reject(new Error('User not found'));
        return;
      }
      resolve(row.ship_id);
    });
  });
}

/**
 * Initiate a battle between two users
 * NOTE: Caller should check battle state via user.inBattle before calling this
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
  
  console.log(`⚔️ initiateBattle: Setting ship speeds to 0...`);
  // Set both ships' speeds to 0
  await setShipSpeed(attacker.ship_id, 0);
  await setShipSpeed(attackee.ship_id, 0);
  
  console.log(`⚔️ initiateBattle: Creating battle in database...`);
  // Create battle in database
  const battle = await BattleRepo.createBattle(
    attacker.id,
    attackee.id,
    attackerStats,
    attackeeStats
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
  
  await BattleRepo.addBattleEvent(battle.id, startEvent, battle);
  
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
  const events = battleEngine.processBattleUntilNextShot(100);
  
  // Save events to database
  for (const event of events) {
    await BattleRepo.addBattleEvent(battleId, event, battle);
  }
  
  // Update weapon cooldowns
  await BattleRepo.updateWeaponCooldowns(battleId, battle.attackerId, battle);
  await BattleRepo.updateWeaponCooldowns(battleId, battle.attackeeId, battle);
  
  // Update defense values
  await BattleRepo.updateBattleDefenses(battleId, battle.attackerId, battle);
  await BattleRepo.updateBattleDefenses(battleId, battle.attackeeId, battle);
  
  // Check if battle is over
  if (battleEngine.isBattleOver()) {
    const outcome = battleEngine.getBattleOutcome();
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
  
  // Get final stats
  const attackerEndStats = battle.attackerStartStats;
  const attackeeEndStats = battle.attackeeStartStats;
  
  // End the battle in database
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
  
  // Update defense values in users table
  await updateUserDefense(
    battle.attackerId,
    attackerEndStats.hull.current,
    attackerEndStats.armor.current,
    attackerEndStats.shield.current
  );
  await updateUserDefense(
    battle.attackeeId,
    attackeeEndStats.hull.current,
    attackeeEndStats.armor.current,
    attackeeEndStats.shield.current
  );
  
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
  
  // Log battle end event
  const endEvent: BattleEvent = {
    timestamp: Math.floor(Date.now() / 1000),
    type: 'battle_ended',
    actor: winnerId === battle.attackerId ? 'attacker' : 'attackee',
    data: {
      message: `Battle ended. Winner: User ${winnerId}`
    }
  };
  
  await BattleRepo.addBattleEvent(battleId, endEvent, battle);
}
