// ---
// Battle Repository - Database operations for battles
// Phase 4: Migrated to IronGuard V2
// ---

import { getDatabase } from './database';
import { getTypedCacheManagerV2 } from './typedCacheManagerV2';
import { createLockContext } from './ironGuardV2';
import { withBattleLock, withDatabaseLock } from './lockHelpers';
import type { Battle, BattleRow, BattleStats, WeaponCooldowns } from '../../shared/battleTypes';

/**
 * Battle Repository V2
 * Handles all database operations for the battle system
 * Uses IronGuard V2 lock system
 */
export class BattleRepoV2 {
  /**
   * Create a new battle
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: BATTLE(50) → DATABASE(60)
   */
  static async createBattle(
    attackerId: number,
    attackeeId: number,
    attackerStartStats: BattleStats,
    attackeeStartStats: BattleStats,
    attackerInitialCooldowns: WeaponCooldowns,
    attackeeInitialCooldowns: WeaponCooldowns
  ): Promise<Battle> {
    const db = await getDatabase();
    const ctx = createLockContext();
    const now = Math.floor(Date.now() / 1000);

    return withBattleLock(ctx, async (battleCtx) => {
      return withDatabaseLock(battleCtx, async () => {
        return new Promise<Battle>((resolve, reject) => {
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
            function (this: { lastID: number }, err: Error | null) {
              if (err) {
                reject(err);
                return;
              }

              // Fetch the created battle using the static method
              BattleRepoV2.getBattle(this.lastID)
                .then(battle => {
                  if (!battle) {
                    reject(new Error('Failed to retrieve created battle'));
                    return;
                  }
                  resolve(battle);
                })
                .catch(reject);
            }
          );
        });
      });
    });
  }

  /**
   * Get a battle by ID
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Uses cache manager for caching
   */
  static async getBattle(battleId: number): Promise<Battle | null> {
    const cacheManager = getTypedCacheManagerV2();
    await cacheManager.initialize();
    
    // Use cache manager's loadBattleIfNeeded which handles locks internally
    return await cacheManager.loadBattleIfNeeded(battleId);
  }

  /**
   * Get battle by ID from database (internal function)
   * This is used by cache manager and doesn't need lock migration
   */
  static async getBattleFromDb(battleId: number): Promise<Battle | null> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM battles WHERE id = ?`;

      db.get<BattleRow>(query, [battleId], (err: Error | null, row?: BattleRow) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        try {
          // Parse JSON fields - converting from snake_case DB to camelCase Battle type
          const battle: Battle = {
            id: row.id,
            attackerId: row.attacker_id,
            attackeeId: row.attackee_id,
            battleStartTime: row.battle_start_time,
            battleEndTime: row.battle_end_time,
            winnerId: row.winner_id,
            loserId: row.winner_id === row.attacker_id ? row.attackee_id : (row.winner_id === row.attackee_id ? row.attacker_id : null),
            attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
            attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
            attackerStartStats: JSON.parse(row.attacker_start_stats),
            attackeeStartStats: JSON.parse(row.attackee_start_stats),
            attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
            attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
            battleLog: JSON.parse(row.battle_log)
          };

          resolve(battle);
        } catch (parseErr) {
          reject(new Error(`Failed to parse battle data: ${parseErr}`));
        }
      });
    });
  }

  /**
   * Update battle
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: BATTLE(50) → DATABASE(60)
   */
  static async updateBattle(battle: Battle): Promise<void> {
    const db = await getDatabase();
    const ctx = createLockContext();

    return withBattleLock(ctx, async (battleCtx) => {
      return withDatabaseLock(battleCtx, async () => {
        return new Promise<void>((resolve, reject) => {
          const query = `
            UPDATE battles SET
              attacker_weapon_cooldowns = ?,
              attackee_weapon_cooldowns = ?,
              attacker_end_stats = ?,
              attackee_end_stats = ?,
              battle_log = ?,
              battle_end_time = ?,
              winner_id = ?,
              last_update_time = ?
            WHERE id = ?
          `;

          const now = Math.floor(Date.now() / 1000);

          db.run(
            query,
            [
              JSON.stringify(battle.attackerWeaponCooldowns),
              JSON.stringify(battle.attackeeWeaponCooldowns),
              JSON.stringify(battle.attackerEndStats),
              JSON.stringify(battle.attackeeEndStats),
              JSON.stringify(battle.battleLog),
              battle.battleEndTime,
              battle.winnerId,
              now,
              battle.id
            ],
            (err: Error | null) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            }
          );
        });
      });
    });
  }

  /**
   * Get battles for a user (as attacker or attackee)
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: BATTLE(50) → DATABASE(60)
   */
  static async getBattlesForUser(userId: number, limit: number = 10): Promise<Battle[]> {
    const db = await getDatabase();
    const ctx = createLockContext();

    return withBattleLock(ctx, async (battleCtx) => {
      return withDatabaseLock(battleCtx, async () => {
        return new Promise<Battle[]>((resolve, reject) => {
          const query = `
            SELECT * FROM battles 
            WHERE attacker_id = ? OR attackee_id = ?
            ORDER BY battle_start_time DESC
            LIMIT ?
          `;

          db.all<BattleRow>(query, [userId, userId, limit], (err: Error | null, rows?: BattleRow[]) => {
            if (err) {
              reject(err);
              return;
            }

            if (!rows || rows.length === 0) {
              resolve([]);
              return;
            }

            try {
              const battles = rows.map((row: BattleRow) => ({
                id: row.id,
                attackerId: row.attacker_id,
                attackeeId: row.attackee_id,
                battleStartTime: row.battle_start_time,
                battleEndTime: row.battle_end_time,
                winnerId: row.winner_id,
                loserId: row.winner_id === row.attacker_id ? row.attackee_id : (row.winner_id === row.attackee_id ? row.attacker_id : null),
                attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
                attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
                attackerStartStats: JSON.parse(row.attacker_start_stats),
                attackeeStartStats: JSON.parse(row.attackee_start_stats),
                attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
                attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
                battleLog: JSON.parse(row.battle_log)
              }));

              resolve(battles);
            } catch (parseErr) {
              reject(new Error(`Failed to parse battles data: ${parseErr}`));
            }
          });
        });
      });
    });
  }

  /**
   * Get active battle for a user
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: BATTLE(50) → DATABASE(60)
   */
  static async getActiveBattleForUser(userId: number): Promise<Battle | null> {
    const db = await getDatabase();
    const ctx = createLockContext();

    return withBattleLock(ctx, async (battleCtx) => {
      return withDatabaseLock(battleCtx, async () => {
        return new Promise<Battle | null>((resolve, reject) => {
          const query = `
            SELECT * FROM battles 
            WHERE (attacker_id = ? OR attackee_id = ?)
              AND battle_end_time IS NULL
            ORDER BY battle_start_time DESC
            LIMIT 1
          `;

          db.get<BattleRow>(query, [userId, userId], (err: Error | null, row?: BattleRow) => {
            if (err) {
              reject(err);
              return;
            }

            if (!row) {
              resolve(null);
              return;
            }

            try {
              const battle: Battle = {
                id: row.id,
                attackerId: row.attacker_id,
                attackeeId: row.attackee_id,
                battleStartTime: row.battle_start_time,
                battleEndTime: row.battle_end_time,
                winnerId: row.winner_id,
                loserId: row.winner_id === row.attacker_id ? row.attackee_id : (row.winner_id === row.attackee_id ? row.attacker_id : null),
                attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
                attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
                attackerStartStats: JSON.parse(row.attacker_start_stats),
                attackeeStartStats: JSON.parse(row.attackee_start_stats),
                attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
                attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
                battleLog: JSON.parse(row.battle_log)
              };

              resolve(battle);
            } catch (parseErr) {
              reject(new Error(`Failed to parse battle data: ${parseErr}`));
            }
          });
        });
      });
    });
  }

  /**
   * Delete a battle
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: BATTLE(50) → DATABASE(60)
   */
  static async deleteBattle(battleId: number): Promise<void> {
    const db = await getDatabase();
    const ctx = createLockContext();

    return withBattleLock(ctx, async (battleCtx) => {
      return withDatabaseLock(battleCtx, async () => {
        return new Promise<void>((resolve, reject) => {
          const query = `DELETE FROM battles WHERE id = ?`;

          db.run(query, [battleId], (err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }
}
