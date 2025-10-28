// ---
// BattleCacheManager: Singleton for in-memory battle object management.
// Responsibilities:
//   - Manages active battle objects in memory.
//   - Handles cache initialization, background persistence, and cache invalidation.
//   - Delegates mechanics and orchestration to BattleEngine and BattleService.
// Main interaction partners:
//   - BattleService (for orchestration)
//   - BattleRepository (for persistence)
//   - TypedCacheManager (for User/World cache consistency)
// Responsibilities to move:
//   - Any business logic or orchestration should move to BattleService; only cache management should remain here.
// ---

import type sqlite3 from 'sqlite3';
import { LOCK_10 as DATABASE_LOCK } from '@markdrei/ironguard-typescript-locks';
import type { Battle } from '../../shared/battleTypes';
import { createLockContext } from './typedLocks';
import { getTypedCacheManager } from './typedCacheManager';

// Define BATTLE_LOCK at level 12 (between USER_LOCK and DATABASE_LOCK)
// Lock Hierarchy: CACHE(2) → WORLD(4) → USER(6) → BATTLE(12) → DATABASE(10)
// Note: Level 12 > 10, but DATABASE_LOCK is always last in practice
const BATTLE_LOCK = {
  level: 12 as const,
  mode: 'write' as const
};

/**
 * BattleCache - Manages battle objects in memory
 * 
 * Design Principles:
 * - ONLY caches Battle objects (Map<battleId, Battle>)
 * - Delegates User operations to TypedCacheManager
 * - Delegates World operations to TypedCacheManager
 * - No cache consistency issues (single source of truth per entity type)
 * 
 * Lock Strategy:
 * - BATTLE_LOCK (level 12) for battle-specific operations
 * - Must acquire USER_LOCK before BATTLE_LOCK
 * - Delegates to TypedCacheManager for User/World locks
 */
export class BattleCache {
  private static instance: BattleCache | null = null;
  private static initializationPromise: Promise<BattleCache> | null = null;

  // Storage
  private battles: Map<number, Battle> = new Map();
  private activeBattlesByUser: Map<number, number> = new Map(); // userId → battleId
  private dirtyBattles: Set<number> = new Set();

  // Database connection
  private db: sqlite3.Database | null = null;

  // Background persistence
  private persistenceTimer: NodeJS.Timeout | null = null;
  private readonly PERSISTENCE_INTERVAL_MS = 30_000; // 30 seconds

  private initialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance (synchronous, but may not be fully initialized)
   * Use getInitializedInstance() for guaranteed initialization
   */
  static getInstance(): BattleCache {
    if (!BattleCache.instance) {
      BattleCache.instance = new BattleCache();
    }
    return BattleCache.instance;
  }

  /**
   * Get fully initialized singleton instance (async)
   */
  static async getInitializedInstance(): Promise<BattleCache> {
    if (BattleCache.instance && BattleCache.instance.initialized) {
      return BattleCache.instance;
    }

    if (BattleCache.initializationPromise) {
      return BattleCache.initializationPromise;
    }

    BattleCache.initializationPromise = (async () => {
      if (!BattleCache.instance) {
        BattleCache.instance = new BattleCache();
      }

      if (!BattleCache.instance.initialized) {
        // Import here to avoid circular dependency
        const { getDatabase } = await import('./database');
        const db = await getDatabase();
        await BattleCache.instance.initialize(db);
      }

      return BattleCache.instance;
    })();

    return BattleCache.initializationPromise;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (BattleCache.instance) {
      BattleCache.instance.shutdown();
      BattleCache.instance = null;
    }
    BattleCache.initializationPromise = null;
  }

  /**
   * Initialize the battle cache with database connection
   */
  async initialize(db: sqlite3.Database): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.db = db;
    
    // Load active battles from database
    await this.loadActiveBattlesFromDb();
    
    // Start background persistence
    this.startPersistence();
    
    this.initialized = true;
  }

  /**
   * Ensure cache is initialized before operations (sync version)
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('BattleCache not initialized - call initialize() first');
    }
  }

  /**
   * Ensure cache is initialized before operations (async auto-initialization)
   */
  private async ensureInitializedAsync(): Promise<void> {
    if (!this.initialized || !this.db) {
      // Auto-initialize if not already done
      await BattleCache.getInitializedInstance();
    }
  }

  /**
   * Shutdown the cache (flush dirty data, stop timers)
   */
  shutdown(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }

    // Flush any remaining dirty battles
    if (this.dirtyBattles.size > 0) {
      this.persistDirtyBattlesSync();
    }

    this.initialized = false;
    this.db = null;
  }

  // ========================================
  // Unsafe Methods (require lock context)
  // ========================================

  /**
   * Get battle from cache (UNSAFE - requires lock)
   * Returns null if battle not in cache
   */
  getBattleUnsafe(battleId: number): Battle | null {
    this.ensureInitialized();
    return this.battles.get(battleId) ?? null;
  }

  /**
   * Set battle in cache (UNSAFE - requires lock)
   * Marks battle as dirty for persistence
   */
  setBattleUnsafe(battle: Battle): void {
    this.ensureInitialized();
    this.battles.set(battle.id, battle);
    this.dirtyBattles.add(battle.id);

    // Track active battle by user
    if (battle.battleEndTime === null) {
      this.activeBattlesByUser.set(battle.attackerId, battle.id);
      this.activeBattlesByUser.set(battle.attackeeId, battle.id);
    }
  }

  /**
   * Update battle in cache (UNSAFE - requires lock)
   * Marks battle as dirty for persistence
   */
  updateBattleUnsafe(battle: Battle): void {
    this.ensureInitialized();
    if (!this.battles.has(battle.id)) {
      throw new Error(`Cannot update non-existent battle ${battle.id}`);
    }
    this.battles.set(battle.id, battle);
    this.dirtyBattles.add(battle.id);

    // Update active tracking if battle ended
    if (battle.battleEndTime !== null) {
      this.activeBattlesByUser.delete(battle.attackerId);
      this.activeBattlesByUser.delete(battle.attackeeId);
    }
  }

  /**
   * Delete battle from cache (UNSAFE - requires lock)
   * Used for completed battles that are persisted
   */
  deleteBattleUnsafe(battleId: number): void {
    this.ensureInitialized();
    const battle = this.battles.get(battleId);
    if (battle) {
      this.battles.delete(battleId);
      this.dirtyBattles.delete(battleId);
      this.activeBattlesByUser.delete(battle.attackerId);
      this.activeBattlesByUser.delete(battle.attackeeId);
    }
  }

  // ========================================
  // High-Level API (auto-acquires locks)
  // ========================================

  /**
   * Load battle from cache or database
   * Auto-acquires necessary locks
   */
  async loadBattleIfNeeded(battleId: number): Promise<Battle | null> {
    await this.ensureInitializedAsync();

    // Check cache first (no lock needed for read)
    const cached = this.battles.get(battleId);
    if (cached) {
      return cached;
    }

    // Load from database
    const cacheManager = getTypedCacheManager();
    const ctx = createLockContext();
    const dbCtx = await cacheManager.acquireDatabaseRead(ctx);
    try {
      const battle = await this.loadBattleFromDb(battleId);
      
      // Cache only if active
      if (battle && battle.battleEndTime === null) {
        this.battles.set(battle.id, battle);
        this.activeBattlesByUser.set(battle.attackerId, battle.id);
        this.activeBattlesByUser.set(battle.attackeeId, battle.id);
      }
      
      return battle;
    } finally {
      dbCtx.dispose();
    }
  }

  /**
   * Get ongoing battle for a user
   * Returns null if user has no active battle
   */
  async getOngoingBattleForUser(userId: number): Promise<Battle | null> {
    await this.ensureInitializedAsync();

    // Check active battles index
    const battleId = this.activeBattlesByUser.get(userId);
    if (battleId !== undefined) {
      return this.battles.get(battleId) ?? null;
    }

    // Not in cache - query database
    const cacheManager = getTypedCacheManager();
    const ctx = createLockContext();
    const dbCtx = await cacheManager.acquireDatabaseRead(ctx);
    try {
      const battle = await this.loadOngoingBattleForUserFromDb(userId);
      
      // Cache if found
      if (battle) {
        this.battles.set(battle.id, battle);
        this.activeBattlesByUser.set(battle.attackerId, battle.id);
        this.activeBattlesByUser.set(battle.attackeeId, battle.id);
      }
      
      return battle;
    } finally {
      dbCtx.dispose();
    }
  }

  /**
   * Get all active battles
   */
  async getActiveBattles(): Promise<Battle[]> {
    await this.ensureInitializedAsync();

    // Return all cached active battles
    const active: Battle[] = [];
    for (const battle of this.battles.values()) {
      if (battle.battleEndTime === null) {
        active.push(battle);
      }
    }
    
    return active;
  }

  /**
   * Get list of dirty battle IDs
   */
  getDirtyBattleIds(): number[] {
    return Array.from(this.dirtyBattles);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cachedBattles: number;
    activeBattles: number;
    dirtyBattles: number;
  } {
    let activeCount = 0;
    for (const battle of this.battles.values()) {
      if (battle.battleEndTime === null) {
        activeCount++;
      }
    }

    return {
      cachedBattles: this.battles.size,
      activeBattles: activeCount,
      dirtyBattles: this.dirtyBattles.size
    };
  }

  /**
   * Persist all dirty battles to database (public async version)
   */
  async persistDirtyBattles(): Promise<void> {
    await this.persistDirtyBattlesInternal();
  }

  // ========================================
  // Database Operations
  // ========================================

  /**
   * Load active battles from database on initialization
   */
  private async loadActiveBattlesFromDb(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(`
        SELECT * FROM battles 
        WHERE battle_end_time IS NULL
      `, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of rows as any[]) {
          const battle = this.deserializeBattle(row);
          this.battles.set(battle.id, battle);
          this.activeBattlesByUser.set(battle.attackerId, battle.id);
          this.activeBattlesByUser.set(battle.attackeeId, battle.id);
        }

        resolve();
      });
    });
  }

  /**
   * Load single battle from database
   */
  private async loadBattleFromDb(battleId: number): Promise<Battle | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(`
        SELECT * FROM battles WHERE id = ?
      `, [battleId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve(row ? this.deserializeBattle(row as any) : null);
      });
    });
  }

  /**
   * Load ongoing battle for user from database
   */
  private async loadOngoingBattleForUserFromDb(userId: number): Promise<Battle | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(`
        SELECT * FROM battles 
        WHERE (attacker_id = ? OR attackee_id = ?)
          AND battle_end_time IS NULL
        ORDER BY battle_start_time DESC
        LIMIT 1
      `, [userId, userId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve(row ? this.deserializeBattle(row as any) : null);
      });
    });
  }

  /**
   * Deserialize battle from database row
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deserializeBattle(row: any): Battle {
    return {
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
      attackeeTotalDamage: row.attackee_total_damage || 0,
    };
  }

  /**
   * Persist single battle to database
   */
  private async persistBattle(battle: Battle): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      // Check if battle exists
      this.db!.get('SELECT id FROM battles WHERE id = ?', [battle.id], (err, exists) => {
        if (err) {
          reject(err);
          return;
        }

        if (exists) {
          // Update existing battle
          this.db!.run(`
            UPDATE battles SET
              attacker_weapon_cooldowns = ?,
              attackee_weapon_cooldowns = ?,
              attacker_start_stats = ?,
              attackee_start_stats = ?,
              attacker_end_stats = ?,
              attackee_end_stats = ?,
              battle_log = ?,
              battle_end_time = ?,
              winner_id = ?,
              loser_id = ?,
              attacker_total_damage = ?,
              attackee_total_damage = ?
            WHERE id = ?
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
          ], (updateErr) => {
            if (updateErr) {
              reject(updateErr);
            } else {
              resolve();
            }
          });
        } else {
          // Insert new battle
          this.db!.run(`
            INSERT INTO battles (
              id, attacker_id, attackee_id, battle_start_time, battle_end_time,
              winner_id, loser_id,
              attacker_weapon_cooldowns, attackee_weapon_cooldowns,
              attacker_start_stats, attackee_start_stats,
              attacker_end_stats, attackee_end_stats,
              battle_log,
              attacker_total_damage, attackee_total_damage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            battle.id,
            battle.attackerId,
            battle.attackeeId,
            battle.battleStartTime,
            battle.battleEndTime,
            battle.winnerId,
            battle.loserId,
            JSON.stringify(battle.attackerWeaponCooldowns),
            JSON.stringify(battle.attackeeWeaponCooldowns),
            JSON.stringify(battle.attackerStartStats),
            JSON.stringify(battle.attackeeStartStats),
            battle.attackerEndStats ? JSON.stringify(battle.attackerEndStats) : null,
            battle.attackeeEndStats ? JSON.stringify(battle.attackeeEndStats) : null,
            JSON.stringify(battle.battleLog),
            battle.attackerTotalDamage,
            battle.attackeeTotalDamage
          ], (insertErr) => {
            if (insertErr) {
              reject(insertErr);
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  // ========================================
  // Background Persistence
  // ========================================

  /**
   * Start background persistence timer
   */
  private startPersistence(): void {
    if (this.persistenceTimer) {
      return; // Already running
    }

    this.persistenceTimer = setInterval(() => {
      this.persistDirtyBattlesInternal().catch((err) => {
        console.error('Error persisting dirty battles:', err);
      });
    }, this.PERSISTENCE_INTERVAL_MS);
  }

  /**
   * Persist all dirty battles to database (async, internal)
   */
  private async persistDirtyBattlesInternal(): Promise<void> {
    if (this.dirtyBattles.size === 0) {
      return;
    }

    // Get list of dirty battle IDs
    const dirtyIds = Array.from(this.dirtyBattles);
    
    // Acquire database lock
    const cacheManager = getTypedCacheManager();
    const ctx = createLockContext();
    const dbCtx = await cacheManager.acquireDatabaseWrite(ctx);
    try {
      for (const battleId of dirtyIds) {
        const battle = this.battles.get(battleId);
        if (battle) {
          await this.persistBattle(battle);
          this.dirtyBattles.delete(battleId);
        }
      }
    } finally {
      dbCtx.dispose();
    }
  }

  /**
   * Persist all dirty battles synchronously (for shutdown)
   */
  private persistDirtyBattlesSync(): void {
    if (this.dirtyBattles.size === 0 || !this.db) {
      return;
    }

    const dirtyIds = Array.from(this.dirtyBattles);
    
    for (const battleId of dirtyIds) {
      const battle = this.battles.get(battleId);
      if (battle) {
        // Synchronous persist during shutdown using serialize
        try {
          this.db.serialize(() => {
            // Check if exists (synchronous get)
            let exists = false;
            this.db!.get('SELECT id FROM battles WHERE id = ?', [battle.id], (err, row) => {
              if (!err && row) {
                exists = true;
              }
            });
            
            if (exists) {
              this.db!.run(`
                UPDATE battles SET
                  attacker_weapon_cooldowns = ?,
                  attackee_weapon_cooldowns = ?,
                  attacker_start_stats = ?,
                  attackee_start_stats = ?,
                  attacker_end_stats = ?,
                  attackee_end_stats = ?,
                  battle_log = ?,
                  battle_end_time = ?,
                  winner_id = ?,
                  loser_id = ?,
                  attacker_total_damage = ?,
                  attackee_total_damage = ?
                WHERE id = ?
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
          });
          
          this.dirtyBattles.delete(battleId);
        } catch (err) {
          console.error(`Error persisting battle ${battleId} during shutdown:`, err);
        }
      }
    }
  }
}

// Export singleton getter
export function getBattleCache(): BattleCache {
  return BattleCache.getInstance();
}

// Export async singleton getter (auto-initializing)
export async function getBattleCacheInitialized(): Promise<BattleCache> {
  return BattleCache.getInitializedInstance();
}
