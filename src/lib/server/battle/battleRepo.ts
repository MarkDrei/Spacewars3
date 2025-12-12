// ---
// BattleRepository: Pure database operations ONLY for battle objects.
// Responsibilities:
//   - Read/write battle data from/to database
//   - NO cache access, NO business logic, NO orchestration
//   - Called ONLY by BattleCache for persistence
// Main interaction partners:
//   - BattleCache (the only caller for writes)
// Status: ✅ Refactored to be DB-only
// ---

import type { Battle, BattleStats, WeaponCooldowns } from './battleTypes';
import { getDatabase } from '../database';
import { HasLock13Context, IronLocks } from '@markdrei/ironguard-typescript-locks';

// ========================================
// Pure Database Read Operations
// ========================================

/**
 * Get a battle by ID from database
 * Pure DB operation - no cache access
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
export async function getBattleFromDb<THeld extends IronLocks>(
  _context: HasLock13Context<THeld>,
  battleId: number
): Promise<Battle | null> {
  const db = await getDatabase();
  
  const result = await db.query(
    `SELECT * FROM battles WHERE id = $1`,
    [battleId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return deserializeBattle(result.rows[0]);
}

/**
 * Get ongoing battle for user from database
 * Pure DB operation - no cache access
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
export async function getOngoingBattleForUserFromDb<THeld extends IronLocks>(
  _context: HasLock13Context<THeld>,
  userId: number
): Promise<Battle | null> {
  const db = await getDatabase();
  
  const result = await db.query(`
    SELECT * FROM battles 
    WHERE (attacker_id = $1 OR attackee_id = $2)
      AND battle_end_time IS NULL
    ORDER BY battle_start_time DESC
    LIMIT 1
  `, [userId, userId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return deserializeBattle(result.rows[0]);
}

/**
 * Get all active battles from database
 * Pure DB operation - no cache access
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
export async function getActiveBattlesFromDb(): Promise<Battle[]> {
  const db = await getDatabase();
  
  const result = await db.query(`
    SELECT * FROM battles 
    WHERE battle_end_time IS NULL
  `);
  
  return result.rows.map(row => deserializeBattle(row));
}

// ========================================
// Pure Database Write Operations
// ========================================

/**
 * Insert a new battle into database
 * Pure DB operation - no cache access
 * Returns the battle with generated ID
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
export async function insertBattleToDb<THeld extends IronLocks>(
  _context: HasLock13Context<THeld>,
  attackerId: number,
  attackeeId: number,
  battleStartTime: number,
  attackerStartStats: BattleStats,
  attackeeStartStats: BattleStats,
  attackerInitialCooldowns: WeaponCooldowns,
  attackeeInitialCooldowns: WeaponCooldowns
): Promise<Battle> {
  const db = await getDatabase();

  const attackerCooldowns = JSON.stringify(attackerInitialCooldowns);
  const attackeeCooldowns = JSON.stringify(attackeeInitialCooldowns);
  const attackerStats = JSON.stringify(attackerStartStats);
  const attackeeStats = JSON.stringify(attackeeStartStats);
  const battleLog = JSON.stringify([]);

  const result = await db.query(`
    INSERT INTO battles (
      attacker_id,
      attackee_id,
      battle_start_time,
      attacker_weapon_cooldowns,
      attackee_weapon_cooldowns,
      attacker_start_stats,
      attackee_start_stats,
      battle_log
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
  `, [
    attackerId,
    attackeeId,
    battleStartTime,
    attackerCooldowns,
    attackeeCooldowns,
    attackerStats,
    attackeeStats,
    battleLog
  ]);

  // Create battle object with generated ID
  const battle: Battle = {
    id: result.rows[0].id,
    attackerId,
    attackeeId,
    battleStartTime,
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

  return battle;
}

/**
 * Update battle in database
 * Pure DB operation - updates all battle fields
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
export async function updateBattleInDb<THeld extends IronLocks>(
  _context: HasLock13Context<THeld>,
  battle: Battle
): Promise<void> {
  const db = await getDatabase();
  
  await db.query(`
    UPDATE battles SET
      attacker_weapon_cooldowns = $1,
      attackee_weapon_cooldowns = $2,
      attacker_start_stats = $3,
      attackee_start_stats = $4,
      attacker_end_stats = $5,
      attackee_end_stats = $6,
      battle_log = $7,
      battle_end_time = $8,
      winner_id = $9,
      loser_id = $10,
      attacker_total_damage = $11,
      attackee_total_damage = $12
    WHERE id = $13
  `, [
    JSON.stringify(battle.attackerWeaponCooldowns),
    JSON.stringify(battle.attackeeWeaponCooldowns),
    JSON.stringify(battle.attackerStartStats),
    JSON.stringify(battle.attackeeStartStats),
    battle.attackerEndStats ? JSON.stringify(battle.attackerEndStats) : null,
    battle.attackeeEndStats ? JSON.stringify(battle.attackeeEndStats) : null,
    JSON.stringify(battle.battleLog),
    battle.battleEndTime,
    battle.winnerId,
    battle.loserId,
    battle.attackerTotalDamage,
    battle.attackeeTotalDamage,
    battle.id
  ]);
}

/**
 * Delete battle from database
 * Pure DB operation - no cache access
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
export async function deleteBattleFromDb<THeld extends IronLocks>(
  _context: HasLock13Context<THeld>,
  battleId: number
): Promise<void> {
  const db = await getDatabase();
  
  await db.query(`DELETE FROM battles WHERE id = $1`, [battleId]);
}

/**
 * Get all battles from database (for admin view)
 * Pure DB operation - no cache access
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
// needs _context for compile time lock checking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getAllBattlesFromDb<THeld extends IronLocks>(_context: HasLock13Context<THeld>): Promise<Battle[]> {
  const db = await getDatabase();

  const result = await db.query(`
    SELECT * FROM battles 
    ORDER BY battle_start_time DESC
  `);

  return result.rows.map(row => deserializeBattle(row));
}

/**
 * Get battles for a specific user from database (for history)
 * Pure DB operation - no cache access
 * NOTE: Caller must hold DATABASE_LOCK_BATTLES (level 13)
 */
export async function getBattlesForUserFromDb<THeld extends IronLocks>(
  _context: HasLock13Context<THeld>,
  userId: number
): Promise<Battle[]> {
  const db = await getDatabase();

  const result = await db.query(`
    SELECT * FROM battles 
    WHERE attacker_id = $1 OR attackee_id = $2
    ORDER BY battle_start_time DESC
  `, [userId, userId]);

  return result.rows.map(row => deserializeBattle(row));
}

// ========================================
// Helper Functions
// ========================================

/**
 * Deserialize battle from database row
 * Helper function for converting DB rows to Battle objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeBattle(row: any): Battle {
  return {
    id: row.id,
    attackerId: row.attacker_id,
    attackeeId: row.attackee_id,
    battleStartTime: parseInt(row.battle_start_time, 10),
    battleEndTime: row.battle_end_time ? parseInt(row.battle_end_time, 10) : null,
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
    attackeeTotalDamage: row.attackee_total_damage || 0,
  };
}