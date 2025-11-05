// ---
// BattleRepository: Handles CRUD and persistence for battle objects.
// Responsibilities:
//   - Provides cache-first access to battle objects.
//   - Handles database synchronization and querying.
//   - Delegates mechanics and orchestration to BattleEngine and BattleService.
// Main interaction partners:
//   - BattleService (for orchestration)
//   - BattleCacheManager (for cache)
// Responsibilities to move:
//   - Any business logic or orchestration should move to BattleService; only persistence should remain here.
// ---

import type { Battle, BattleStats, BattleEvent, WeaponCooldowns } from './battleTypes';
import { getBattleCache } from './BattleCache';
import { getDatabase } from '../database';

/**
 * Get a battle by ID
 * Uses BattleCache first, falls back to database
 */
export async function getBattle(battleId: number): Promise<Battle | null> {
  const battleCache = getBattleCache();
  return await battleCache.loadBattleIfNeeded(battleId);
}

/**
 * Get ongoing battle for a user
 * Uses BattleCache for active battles
 */
export async function getOngoingBattleForUser(userId: number): Promise<Battle | null> {
  const battleCache = getBattleCache();
  return await battleCache.getOngoingBattleForUser(userId);
}

/**
 * Get all active battles
 * Uses BattleCache for in-memory active battles
 */
export async function getActiveBattles(): Promise<Battle[]> {
  const battleCache = getBattleCache();
  return await battleCache.getActiveBattles();
}

/**
 * Create a new battle
 * Creates battle in database and stores in BattleCache
 */
export async function createBattle(
  attackerId: number,
  attackeeId: number,
  attackerStartStats: BattleStats,
  attackeeStartStats: BattleStats,
  attackerInitialCooldowns: WeaponCooldowns,
  attackeeInitialCooldowns: WeaponCooldowns
): Promise<Battle> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO battles (
        attacker_id,
        attackee_id,
        battle_start_time,
        attacker_weapon_cooldowns,
        attackee_weapon_cooldowns,
        attacker_start_stats,
        attackee_start_stats,
        battle_log
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const attackerCooldowns = JSON.stringify(attackerInitialCooldowns);
    const attackeeCooldowns = JSON.stringify(attackeeInitialCooldowns);
    const attackerStats = JSON.stringify(attackerStartStats);
    const attackeeStats = JSON.stringify(attackeeStartStats);
    const battleLog = JSON.stringify([]);

    db.run(
      query,
      [
        attackerId,
        attackeeId,
        now,
        attackerCooldowns,
        attackeeCooldowns,
        attackerStats,
        attackeeStats,
        battleLog
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }

        // Create battle object with generated ID
        const battle: Battle = {
          id: this.lastID,
          attackerId,
          attackeeId,
          battleStartTime: now,
          battleEndTime: null,
          winnerId: null,
          loserId: null,
          attackerWeaponCooldowns: attackerInitialCooldowns,
          attackeeWeaponCooldowns: attackeeInitialCooldowns,
          attackerStartStats,
          attackeeStartStats,
          attackerEndStats: null,
          attackeeEndStats: null,
          battleLog: [],
          attackerTotalDamage: 0,
          attackeeTotalDamage: 0
        };

        // Store in BattleCache
        const battleCache = getBattleCache();
        battleCache.setBattleUnsafe(battle);

        resolve(battle);
      }
    );
  });
}

/**
 * Update weapon cooldowns for a battle
 * Updates both database and cache
 */
export async function updateWeaponCooldowns(
  battleId: number,
  userId: number,
  weaponCooldowns: WeaponCooldowns
): Promise<void> {
  const battleCache = getBattleCache();
  
  // Get battle from cache
  const battle = battleCache.getBattleUnsafe(battleId);
  if (!battle) {
    throw new Error(`Battle ${battleId} not found in cache`);
  }

  // Update cooldowns
  if (userId === battle.attackerId) {
    battle.attackerWeaponCooldowns = weaponCooldowns;
  } else if (userId === battle.attackeeId) {
    battle.attackeeWeaponCooldowns = weaponCooldowns;
  } else {
    throw new Error(`User ${userId} is not part of battle ${battleId}`);
  }

  // Mark battle as dirty for persistence
  battleCache.updateBattleUnsafe(battle);
}

/**
 * Add a battle event to the battle log
 */
export async function addBattleEvent(battleId: number, event: BattleEvent): Promise<void> {
  const battleCache = getBattleCache();
  
  // Get battle from cache
  const battle = battleCache.getBattleUnsafe(battleId);
  if (!battle) {
    throw new Error(`Battle ${battleId} not found in cache`);
  }

  // Add event to log
  battle.battleLog.push(event);

  // Mark battle as dirty for persistence
  battleCache.updateBattleUnsafe(battle);
}

/**
 * Update battle defense values
 */
export async function updateBattleDefenses(
  battleId: number,
  attackerEndStats: BattleStats | null,
  attackeeEndStats: BattleStats | null
): Promise<void> {
  const battleCache = getBattleCache();
  
  // Get battle from cache
  const battle = battleCache.getBattleUnsafe(battleId);
  if (!battle) {
    throw new Error(`Battle ${battleId} not found in cache`);
  }

  // Update defense stats
  if (attackerEndStats) {
    battle.attackerEndStats = attackerEndStats;
  }
  if (attackeeEndStats) {
    battle.attackeeEndStats = attackeeEndStats;
  }

  // Mark battle as dirty for persistence
  battleCache.updateBattleUnsafe(battle);
}

/**
 * End a battle
 * Updates battle in cache, persists to database, then removes from cache
 */
export async function endBattle(
  battleId: number,
  winnerId: number,
  loserId: number,
  attackerEndStats: BattleStats,
  attackeeEndStats: BattleStats
): Promise<void> {
  const battleCache = getBattleCache();
  
  // Get battle from cache
  const battle = battleCache.getBattleUnsafe(battleId);
  if (!battle) {
    throw new Error(`Battle ${battleId} not found in cache`);
  }

  // End battle
  battle.battleEndTime = Date.now();
  battle.winnerId = winnerId;
  battle.loserId = loserId;
  battle.attackerEndStats = attackerEndStats;
  battle.attackeeEndStats = attackeeEndStats;

  // Update battle in cache (marks as dirty)
  battleCache.updateBattleUnsafe(battle);

  // Persist to database immediately before removing from cache
  await battleCache.persistDirtyBattles();

  // Remove from cache (completed battles are not kept in memory)
  battleCache.deleteBattleUnsafe(battleId);
}

/**
 * Get all battles (for admin view)
 * Queries database directly as this is not cached
 */
export async function getAllBattles(): Promise<Battle[]> {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM battles 
      ORDER BY battle_start_time DESC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const battles = (rows as {
        id: number;
        attacker_id: number;
        attackee_id: number;
        battle_start_time: number;
        battle_end_time: number | null;
        winner_id: number | null;
        loser_id: number | null;
        attacker_weapon_cooldowns: string;
        attackee_weapon_cooldowns: string;
        attacker_start_stats: string;
        attackee_start_stats: string;
        attacker_end_stats: string | null;
        attackee_end_stats: string | null;
        battle_log: string;
        attacker_total_damage?: number;
        attackee_total_damage?: number;
      }[]).map(row => ({
        id: row.id,
        attackerId: row.attacker_id,
        attackeeId: row.attackee_id,
        battleStartTime: row.battle_start_time,
        battleEndTime: row.battle_end_time,
        winnerId: row.winner_id,
        loserId: row.loser_id,
        attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
        attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
        attackerStartStats: JSON.parse(row.attacker_start_stats),
        attackeeStartStats: JSON.parse(row.attackee_start_stats),
        attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
        attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
        battleLog: JSON.parse(row.battle_log),
        attackerTotalDamage: row.attacker_total_damage || 0,
        attackeeTotalDamage: row.attackee_total_damage || 0
      }));

      resolve(battles);
    });
  });
}

/**
 * Get battles for a specific user (for history)
 * Queries database directly as this is not cached
 */
export async function getBattlesForUser(userId: number): Promise<Battle[]> {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM battles 
      WHERE attacker_id = ? OR attackee_id = ?
      ORDER BY battle_start_time DESC
    `;

    db.all(query, [userId, userId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const battles = (rows as {
        id: number;
        attacker_id: number;
        attackee_id: number;
        battle_start_time: number;
        battle_end_time: number | null;
        winner_id: number | null;
        loser_id: number | null;
        attacker_weapon_cooldowns: string;
        attackee_weapon_cooldowns: string;
        attacker_start_stats: string;
        attackee_start_stats: string;
        attacker_end_stats: string | null;
        attackee_end_stats: string | null;
        battle_log: string;
        attacker_total_damage?: number;
        attackee_total_damage?: number;
      }[]).map(row => ({
        id: row.id,
        attackerId: row.attacker_id,
        attackeeId: row.attackee_id,
        battleStartTime: row.battle_start_time,
        battleEndTime: row.battle_end_time,
        winnerId: row.winner_id,
        loserId: row.loser_id,
        attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
        attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
        attackerStartStats: JSON.parse(row.attacker_start_stats),
        attackeeStartStats: JSON.parse(row.attackee_start_stats),
        attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
        attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
        battleLog: JSON.parse(row.battle_log),
        attackerTotalDamage: row.attacker_total_damage || 0,
        attackeeTotalDamage: row.attackee_total_damage || 0
      }));

      resolve(battles);
    });
  });
}

/**
 * Set weapon cooldown for specific weapon
 */
export async function setWeaponCooldown(
  battleId: number,
  userId: number,
  weaponType: string,
  cooldown: number
): Promise<void> {
  const battleCache = getBattleCache();
  
  // Get battle from cache
  const battle = battleCache.getBattleUnsafe(battleId);
  if (!battle) {
    throw new Error(`Battle ${battleId} not found in cache`);
  }

  // Update specific weapon cooldown
  if (userId === battle.attackerId) {
    battle.attackerWeaponCooldowns[weaponType] = cooldown;
  } else if (userId === battle.attackeeId) {
    battle.attackeeWeaponCooldowns[weaponType] = cooldown;
  } else {
    throw new Error(`User ${userId} is not part of battle ${battleId}`);
  }

  // Mark battle as dirty for persistence
  battleCache.updateBattleUnsafe(battle);
}

/**
 * Update battle stats for both players
 */
export async function updateBattleStats(
  battleId: number,
  attackerEndStats: BattleStats | null,
  attackeeEndStats: BattleStats | null
): Promise<void> {
  const battleCache = getBattleCache();
  
  // Get battle from cache
  const battle = battleCache.getBattleUnsafe(battleId);
  if (!battle) {
    throw new Error(`Battle ${battleId} not found in cache`);
  }

  // Update stats
  if (attackerEndStats) {
    battle.attackerEndStats = attackerEndStats;
  }
  if (attackeeEndStats) {
    battle.attackeeEndStats = attackeeEndStats;
  }

  // Mark battle as dirty for persistence
  battleCache.updateBattleUnsafe(battle);
}

// Backward compatibility - re-export as BattleRepo class for existing code
export const BattleRepo = {
  createBattle,
  getBattle,
  getOngoingBattleForUser,
  updateWeaponCooldowns,
  addBattleEvent,
  updateBattleDefenses,
  endBattle,
  getAllBattles,
  getBattlesForUser,
  getActiveBattles,
  setWeaponCooldown,
  updateBattleStats
};