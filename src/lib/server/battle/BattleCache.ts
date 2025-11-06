// ---
// BattleCache: Single source of truth for ongoing battles.
// Responsibilities:
//   - Manages active battle objects in memory (Map<battleId, Battle>)
//   - ONLY component that writes to database (via battleRepo)
//   - Handles cache initialization, background persistence, cache invalidation
//   - Provides high-level API with automatic lock acquisition
//   - Provides unsafe API (requires manual lock acquisition by caller)
// Main interaction partners:
//   - BattleService (for orchestration)
//   - battleRepo (for DB persistence - called ONLY by BattleCache)
//   - TypedCacheManager (for User/World cache consistency)
// Status: ✅ Refactored - single source of truth, only DB writer
// ---

import type sqlite3 from 'sqlite3';
import { LOCK_10 as DATABASE_LOCK } from '@markdrei/ironguard-typescript-locks';
import type { Battle, BattleStats, BattleEvent, WeaponCooldowns } from './battleTypes';
import { createLockContext } from '../typedLocks';
import { getUserWorldCache } from '../world/userWorldCache';
import * as battleRepo from './battleRepo';

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
        const { getDatabase } = await import('../database');
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
    const cacheManager = getUserWorldCache();
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
    const cacheManager = getUserWorldCache();
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

  /**
   * Create a new battle
   * Creates battle in database and stores in cache
   * Auto-acquires necessary locks
   */
  async createBattle(
    attackerId: number,
    attackeeId: number,
    attackerStartStats: BattleStats,
    attackeeStartStats: BattleStats,
    attackerInitialCooldowns: WeaponCooldowns,
    attackeeInitialCooldowns: WeaponCooldowns
  ): Promise<Battle> {
    await this.ensureInitializedAsync();
    
    const now = Math.floor(Date.now() / 1000);
    
    // Acquire database lock to insert battle
    const cacheManager = getUserWorldCache();
    const ctx = createLockContext();
    const dbCtx = await cacheManager.acquireDatabaseWrite(ctx);
    try {
      // Insert to database via battleRepo
      const battle = await battleRepo.insertBattleToDb(
        attackerId,
        attackeeId,
        now,
        attackerStartStats,
        attackeeStartStats,
        attackerInitialCooldowns,
        attackeeInitialCooldowns
      );
      
      // Store in cache
      this.setBattleUnsafe(battle);
      
      return battle;
    } finally {
      dbCtx.dispose();
    }
  }

  /**
   * Update weapon cooldowns for a battle
   * Auto-acquires necessary locks
   */
  async updateWeaponCooldowns(
    battleId: number,
    userId: number,
    weaponCooldowns: WeaponCooldowns
  ): Promise<void> {
    await this.ensureInitializedAsync();
    
    // Get battle from cache (no lock needed for read)
    const battle = this.battles.get(battleId);
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
    this.updateBattleUnsafe(battle);
  }

  /**
   * Add a battle event to the battle log
   * Auto-acquires necessary locks
   */
  async addBattleEvent(battleId: number, event: BattleEvent): Promise<void> {
    await this.ensureInitializedAsync();
    
    // Get battle from cache
    const battle = this.battles.get(battleId);
    if (!battle) {
      throw new Error(`Battle ${battleId} not found in cache`);
    }

    // Add event to log
    battle.battleLog.push(event);

    // Mark battle as dirty for persistence
    this.updateBattleUnsafe(battle);
  }

  /**
   * Set weapon cooldown for specific weapon
   * Auto-acquires necessary locks
   */
  async setWeaponCooldown(
    battleId: number,
    userId: number,
    weaponType: string,
    cooldown: number
  ): Promise<void> {
    await this.ensureInitializedAsync();
    
    // Get battle from cache
    const battle = this.battles.get(battleId);
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
    this.updateBattleUnsafe(battle);
  }

  /**
   * Update battle stats for both players
   * Auto-acquires necessary locks
   */
  async updateBattleStats(
    battleId: number,
    attackerEndStats: BattleStats | null,
    attackeeEndStats: BattleStats | null
  ): Promise<void> {
    await this.ensureInitializedAsync();
    
    // Get battle from cache
    const battle = this.battles.get(battleId);
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
    this.updateBattleUnsafe(battle);
  }

  /**
   * End a battle
   * Updates battle in cache, persists to database, then removes from cache
   * Auto-acquires necessary locks
   */
  async endBattle(
    battleId: number,
    winnerId: number,
    loserId: number,
    attackerEndStats: BattleStats,
    attackeeEndStats: BattleStats
  ): Promise<void> {
    await this.ensureInitializedAsync();
    
    // Get battle from cache
    const battle = this.battles.get(battleId);
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
    this.updateBattleUnsafe(battle);

    // Persist to database immediately before removing from cache
    await this.persistDirtyBattles();

    // Remove from cache (completed battles are not kept in memory)
    this.deleteBattleUnsafe(battleId);
  }

  /**
   * Get all battles (for admin view)
   * Queries database directly as this includes historical battles
   */
  async getAllBattles(): Promise<Battle[]> {
    await this.ensureInitializedAsync();
    return await battleRepo.getAllBattlesFromDb();
  }

  /**
   * Get battles for a specific user (for history)
   * Queries database directly as this includes historical battles
   */
  async getBattlesForUser(userId: number): Promise<Battle[]> {
    await this.ensureInitializedAsync();
    return await battleRepo.getBattlesForUserFromDb(userId);
  }

  // ========================================
  // Database Operations
  // ========================================

  /**
   * Load active battles from database on initialization
   */
  private async loadActiveBattlesFromDb(): Promise<void> {
    const battles = await battleRepo.getActiveBattlesFromDb();
    
    for (const battle of battles) {
      this.battles.set(battle.id, battle);
      this.activeBattlesByUser.set(battle.attackerId, battle.id);
      this.activeBattlesByUser.set(battle.attackeeId, battle.id);
    }
  }

  /**
   * Load single battle from database
   */
  private async loadBattleFromDb(battleId: number): Promise<Battle | null> {
    return await battleRepo.getBattleFromDb(battleId);
  }

  /**
   * Load ongoing battle for user from database
   */
  private async loadOngoingBattleForUserFromDb(userId: number): Promise<Battle | null> {
    return await battleRepo.getOngoingBattleForUserFromDb(userId);
  }

  /**
   * Persist single battle to database
   * Called only by BattleCache - this is the ONLY way battles get written to DB
   */
  private async persistBattle(battle: Battle): Promise<void> {
    // Use battleRepo to update the battle in database
    await battleRepo.updateBattleInDb(battle);
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
    const cacheManager = getUserWorldCache();
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

// ========================================
// Backward Compatibility Layer
// ========================================

// Export high-level functions for backward compatibility
export async function createBattle(
  attackerId: number,
  attackeeId: number,
  attackerStartStats: BattleStats,
  attackeeStartStats: BattleStats,
  attackerInitialCooldowns: WeaponCooldowns,
  attackeeInitialCooldowns: WeaponCooldowns
): Promise<Battle> {
  const cache = await getBattleCacheInitialized();
  return cache.createBattle(
    attackerId,
    attackeeId,
    attackerStartStats,
    attackeeStartStats,
    attackerInitialCooldowns,
    attackeeInitialCooldowns
  );
}

export async function getBattle(battleId: number): Promise<Battle | null> {
  const cache = await getBattleCacheInitialized();
  return cache.loadBattleIfNeeded(battleId);
}

export async function getOngoingBattleForUser(userId: number): Promise<Battle | null> {
  const cache = await getBattleCacheInitialized();
  return cache.getOngoingBattleForUser(userId);
}

export async function updateWeaponCooldowns(
  battleId: number,
  userId: number,
  weaponCooldowns: WeaponCooldowns
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.updateWeaponCooldowns(battleId, userId, weaponCooldowns);
}

export async function addBattleEvent(battleId: number, event: BattleEvent): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.addBattleEvent(battleId, event);
}

export async function updateBattleDefenses(
  battleId: number,
  attackerEndStats: BattleStats | null,
  attackeeEndStats: BattleStats | null
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.updateBattleStats(battleId, attackerEndStats, attackeeEndStats);
}

export async function endBattle(
  battleId: number,
  winnerId: number,
  loserId: number,
  attackerEndStats: BattleStats,
  attackeeEndStats: BattleStats
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.endBattle(battleId, winnerId, loserId, attackerEndStats, attackeeEndStats);
}

export async function getAllBattles(): Promise<Battle[]> {
  const cache = await getBattleCacheInitialized();
  return cache.getAllBattles();
}

export async function getBattlesForUser(userId: number): Promise<Battle[]> {
  const cache = await getBattleCacheInitialized();
  return cache.getBattlesForUser(userId);
}

export async function getActiveBattles(): Promise<Battle[]> {
  const cache = await getBattleCacheInitialized();
  return cache.getActiveBattles();
}

export async function setWeaponCooldown(
  battleId: number,
  userId: number,
  weaponType: string,
  cooldown: number
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.setWeaponCooldown(battleId, userId, weaponType, cooldown);
}

export async function updateBattleStats(
  battleId: number,
  attackerEndStats: BattleStats | null,
  attackeeEndStats: BattleStats | null
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.updateBattleStats(battleId, attackerEndStats, attackeeEndStats);
}

/**
 * Backward compatibility object that mimics the old BattleRepo API
 * All methods delegate to BattleCache
 * This allows existing code to work without changes during migration
 */
export const BattleRepo = {
  createBattle: async (
    attackerId: number,
    attackeeId: number,
    attackerStartStats: BattleStats,
    attackeeStartStats: BattleStats,
    attackerInitialCooldowns: WeaponCooldowns,
    attackeeInitialCooldowns: WeaponCooldowns
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.createBattle(
      attackerId,
      attackeeId,
      attackerStartStats,
      attackeeStartStats,
      attackerInitialCooldowns,
      attackeeInitialCooldowns
    );
  },

  getBattle: async (battleId: number) => {
    const cache = await getBattleCacheInitialized();
    return cache.loadBattleIfNeeded(battleId);
  },

  getOngoingBattleForUser: async (userId: number) => {
    const cache = await getBattleCacheInitialized();
    return cache.getOngoingBattleForUser(userId);
  },

  updateWeaponCooldowns: async (
    battleId: number,
    userId: number,
    weaponCooldowns: WeaponCooldowns
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.updateWeaponCooldowns(battleId, userId, weaponCooldowns);
  },

  addBattleEvent: async (battleId: number, event: BattleEvent) => {
    const cache = await getBattleCacheInitialized();
    return cache.addBattleEvent(battleId, event);
  },

  updateBattleDefenses: async (
    battleId: number,
    attackerEndStats: BattleStats | null,
    attackeeEndStats: BattleStats | null
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.updateBattleStats(battleId, attackerEndStats, attackeeEndStats);
  },

  endBattle: async (
    battleId: number,
    winnerId: number,
    loserId: number,
    attackerEndStats: BattleStats,
    attackeeEndStats: BattleStats
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.endBattle(battleId, winnerId, loserId, attackerEndStats, attackeeEndStats);
  },

  getAllBattles: async () => {
    const cache = await getBattleCacheInitialized();
    return cache.getAllBattles();
  },

  getBattlesForUser: async (userId: number) => {
    const cache = await getBattleCacheInitialized();
    return cache.getBattlesForUser(userId);
  },

  getActiveBattles: async () => {
    const cache = await getBattleCacheInitialized();
    return cache.getActiveBattles();
  },

  setWeaponCooldown: async (
    battleId: number,
    userId: number,
    weaponType: string,
    cooldown: number
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.setWeaponCooldown(battleId, userId, weaponType, cooldown);
  },

  updateBattleStats: async (
    battleId: number,
    attackerEndStats: BattleStats | null,
    attackeeEndStats: BattleStats | null
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.updateBattleStats(battleId, attackerEndStats, attackeeEndStats);
  }
};
