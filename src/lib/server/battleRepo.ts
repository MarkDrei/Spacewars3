// ---
// Battle Repository - Database operations for battles
// ---

import { getDatabase } from './database';
import type { Battle, BattleRow, BattleStats, WeaponCooldowns, BattleEvent, battleRowToBattle } from '../../shared/battleTypes';

/**
 * Battle Repository
 * Handles all database operations for the battle system
 */
export class BattleRepo {
  /**
   * Create a new battle
   */
  static async createBattle(
    attackerId: number,
    attackeeId: number,
    attackerStartStats: BattleStats,
    attackeeStartStats: BattleStats
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
          attackee_start_stats
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const attackerCooldowns = JSON.stringify({});
      const attackeeCooldowns = JSON.stringify({});
      const attackerStats = JSON.stringify(attackerStartStats);
      const attackeeStats = JSON.stringify(attackeeStartStats);

      db.run(
        query,
        [
          attackerId,
          attackeeId,
          now,
          attackerCooldowns,
          attackeeCooldowns,
          attackerStats,
          attackeeStats
        ],
        function (err) {
          if (err) {
            reject(err);
            return;
          }

          // Fetch the created battle
          BattleRepo.getBattle(this.lastID)
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
  }

  /**
   * Get a battle by ID
   */
  static async getBattle(battleId: number): Promise<Battle | null> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM battles WHERE id = ?`;

      db.get<BattleRow>(query, [battleId], (err, row) => {
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
            loserId: row.loser_id,
            attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
            attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
            attackerStartStats: JSON.parse(row.attacker_start_stats),
            attackeeStartStats: JSON.parse(row.attackee_start_stats),
            attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
            attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
            battleLog: JSON.parse(row.battle_log),
          };
          resolve(battle);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Get ongoing battle for a user (either as attacker or attackee)
   */
  static async getOngoingBattleForUser(userId: number): Promise<Battle | null> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM battles 
        WHERE (attacker_id = ? OR attackee_id = ?)
        AND battle_end_time IS NULL
        LIMIT 1
      `;

      db.get<BattleRow>(query, [userId, userId], (err, row) => {
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
            loserId: row.loser_id,
            attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
            attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
            attackerStartStats: JSON.parse(row.attacker_start_stats),
            attackeeStartStats: JSON.parse(row.attackee_start_stats),
            attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
            attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
            battleLog: JSON.parse(row.battle_log),
          };
          resolve(battle);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Update weapon cooldowns for a player in a battle
   */
  static async updateWeaponCooldowns(
    battleId: number,
    userId: number,
    battle: Battle
  ): Promise<void> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      // Determine if user is attacker or attackee
      const isAttacker = battle.attackerId === userId;
      const column = isAttacker ? 'attacker_weapon_cooldowns' : 'attackee_weapon_cooldowns';
      const cooldowns = isAttacker ? battle.attackerWeaponCooldowns : battle.attackeeWeaponCooldowns;

      const query = `UPDATE battles SET ${column} = ? WHERE id = ?`;

      db.run(query, [JSON.stringify(cooldowns), battleId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Add an event to the battle log
   */
  static async addBattleEvent(battleId: number, event: BattleEvent, battle: Battle): Promise<void> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      const updatedLog = [...battle.battleLog, event];
      const query = `UPDATE battles SET battle_log = ? WHERE id = ?`;

      db.run(query, [JSON.stringify(updatedLog), battleId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Update defense values during battle
   */
  static async updateBattleDefenses(
    battleId: number,
    userId: number,
    battle: Battle
  ): Promise<void> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      // Determine if user is attacker or attackee
      const isAttacker = battle.attackerId === userId;
      const column = isAttacker ? 'attacker_start_stats' : 'attackee_start_stats';
      const stats = isAttacker ? battle.attackerStartStats : battle.attackeeStartStats;

      const query = `UPDATE battles SET ${column} = ? WHERE id = ?`;

      db.run(query, [JSON.stringify(stats), battleId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * End a battle with final outcome
   */
  static async endBattle(
    battleId: number,
    winnerId: number,
    loserId: number,
    attackerEndStats: BattleStats,
    attackeeEndStats: BattleStats
  ): Promise<void> {
    const db = await getDatabase();
    const now = Math.floor(Date.now() / 1000);

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE battles 
        SET battle_end_time = ?,
            winner_id = ?,
            loser_id = ?,
            attacker_end_stats = ?,
            attackee_end_stats = ?
        WHERE id = ?
      `;

      db.run(
        query,
        [
          now,
          winnerId,
          loserId,
          JSON.stringify(attackerEndStats),
          JSON.stringify(attackeeEndStats),
          battleId
        ],
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
   * Get all battles for a user (for battle history)
   */
  static async getBattlesForUser(userId: number, limit: number = 10): Promise<Battle[]> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM battles 
        WHERE attacker_id = ? OR attackee_id = ?
        ORDER BY battle_start_time DESC
        LIMIT ?
      `;

      db.all<BattleRow>(query, [userId, userId, limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const battles = rows.map(row => ({
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
          }));
          resolve(battles);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Get all active battles
   */
  static async getActiveBattles(): Promise<Battle[]> {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM battles 
        WHERE battle_end_time IS NULL
        ORDER BY battle_start_time DESC
      `;

      db.all<BattleRow>(query, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const battles = rows.map(row => ({
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
          }));
          resolve(battles);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }
}
