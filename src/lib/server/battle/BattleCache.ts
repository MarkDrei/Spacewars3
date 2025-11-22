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
// Lock Strategy: BATTLE_LOCK (level 2) → DATABASE_LOCK_BATTLES (level 13)
// ---

import type sqlite3 from 'sqlite3';
import type { Battle, BattleStats, BattleEvent, WeaponCooldowns } from './battleTypes';
import * as battleRepo from './battleRepo';
import { createLockContext, HasLock13Context, HasLock2Context, IronLocks, LockContext, LocksAtMost4, LocksAtMostAndHas2 } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, DATABASE_LOCK_BATTLES, USER_LOCK } from '../typedLocks';
import { startBattleScheduler } from './battleScheduler';
import { userCache } from '../user/userCache';
import { WorldCache } from '../world/worldCache';
import { MessageCache } from '../messages/MessageCache';
import { Cache } from '../caches/Cache';

type BattleCacheDependencies = {
  userCache?: userCache;
  worldCache?: WorldCache;
  messageCache?: MessageCache;
};

declare global {
  var battleCacheInstance: BattleCache | null;
}

export class BattleCache extends Cache {
  private static initializationPromise: Promise<BattleCache> | null = null;
  private static dependencies: BattleCacheDependencies = {};

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
  private dependencies: BattleCacheDependencies = {};

  private constructor() {
    super();
    // Private constructor for singleton
    this.dependencies = BattleCache.dependencies;
  }

  private static get instance(): BattleCache | null {
    return globalThis.battleCacheInstance || null;
  }

  private static set instance(value: BattleCache | null) {
    globalThis.battleCacheInstance = value;
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

  static async initialize2(db: sqlite3.Database): Promise<void> {
    const instance = new BattleCache();
    await instance.initialize(db);
    startBattleScheduler();
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

  static configureDependencies(dependencies: BattleCacheDependencies): void {
    BattleCache.dependencies = dependencies;
    if (BattleCache.instance) {
      BattleCache.instance.dependencies = dependencies;
    }
  }

  /**
   * Initialize the battle cache with database connection
   */
  async initialize(db: sqlite3.Database): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.assertDependenciesConfigured();
    this.db = db;
    
    // Load active battles from database
    await this.loadActiveBattlesFromDb();
    
    // Start background persistence
    this.startPersistence();
    
    this.initialized = true;
  }

  private assertDependenciesConfigured(): void {
    this.getUserCache();
    this.getWorldCache();
    this.getMessageCache();
  }

  private getUserCache(): userCache {
    const userCache = this.dependencies.userCache;
    if (!userCache) {
      throw new Error('BattleCache: user cache dependency not configured');
    }
    return userCache;
  }

  private getWorldCache(): WorldCache {
    const worldCache = this.dependencies.worldCache;
    if (!worldCache) {
      throw new Error('BattleCache: world cache dependency not configured');
    }
    return worldCache;
  }

  private getMessageCache(): MessageCache {
    const messageCache = this.dependencies.messageCache;
    if (!messageCache) {
      throw new Error('BattleCache: message cache dependency not configured');
    }
    return messageCache;
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
  // Private Methods (internal use only - no locks needed as used within locked sections)
  // ========================================

  /**
   * Get battle from cache (PRIVATE - internal use only)
   * Returns null if battle not in cache
   */
  private getBattleFromCacheInternal(battleId: number): Battle | null {
    this.ensureInitialized();
    return this.battles.get(battleId) ?? null;
  }

  /**
   * Set battle in cache (PRIVATE - internal use only)
   * Marks battle as dirty for persistence
   */
  private setBattleInCacheInternal<THeld extends IronLocks>(_context: HasLock2Context<THeld>, battle: Battle): void {
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
   * Update battle in cache (PRIVATE - internal use only)
   * Marks battle as dirty for persistence
   */
  private updateBattleInCacheInternal<THeld extends IronLocks>(context: HasLock2Context<THeld>, battle: Battle): void {
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
   * Delete battle from cache (PRIVATE - internal use only)
   * Used for completed battles that are persisted
   */
  private deleteBattleFromCacheInternal(context: LockContext<LocksAtMostAndHas2>, battleId: number): void {
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
  async loadBattleIfNeeded(context: LockContext<LocksAtMostAndHas2>, battleId: number): Promise<Battle | null> {
    await this.ensureInitializedAsync();

    // Check cache first (no lock needed for read)
    const cached = this.battles.get(battleId);
    if (cached) {
      return cached;
    }

    // Load from database
    return await context.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      const battle = await battleRepo.getBattleFromDb(databaseContext, battleId);
      
      // Cache only if active
      if (battle && battle.battleEndTime === null) {
        this.battles.set(battle.id, battle);
        this.activeBattlesByUser.set(battle.attackerId, battle.id);
        this.activeBattlesByUser.set(battle.attackeeId, battle.id);
      }
      
      return battle;
    }, 'read');
  }

  /**
   * Get ongoing battle for a user
   * Returns null if user has no active battle
   * Acquires READ lock internally UNLESS a lock context is provided
   * 
   * @param userId - User ID to check
   * @param lockContext - Optional lock context (if caller already holds BATTLE lock at level 2 or higher)
   */
  async getOngoingBattleForUser(lockContext: LockContext<LocksAtMostAndHas2>, userId: number): Promise<Battle | null> {
    await this.ensureInitializedAsync();
    return this.getOngoingBattleForUserInternal(lockContext, userId);
  }

  /**
   * Internal method to get ongoing battle
   * Requires caller to hold BATTLE lock (enforced at compile-time via lockContext parameter)
   * 
   * @param userId - User ID to check
   * @param lockContext - REQUIRED lock context proving caller holds BATTLE lock
   */
  private async getOngoingBattleForUserInternal(
    lockContext: LockContext<LocksAtMostAndHas2>,
    userId: number
  ): Promise<Battle | null> {
    // Check active battles index
    const battleId = this.activeBattlesByUser.get(userId);
    if (battleId !== undefined) {
      return this.battles.get(battleId) ?? null;
    }

    // Not in cache - query database
    return await lockContext.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      const battle = await battleRepo.getOngoingBattleForUserFromDb(databaseContext, userId);
      
      // Cache if found
      if (battle) {
        this.battles.set(battle.id, battle);
        this.activeBattlesByUser.set(battle.attackerId, battle.id);
        this.activeBattlesByUser.set(battle.attackeeId, battle.id);
      }
      
      return battle;
    });
  }

  /**
   * Get all active battles
   * Acquires lock internally UNLESS a lock context is provided
   * 
   * @param lockContext - Optional lock context (if caller already holds BATTLE lock at level 2 or higher)
   */
  async getActiveBattles(lockContext: LockContext<LocksAtMostAndHas2>): Promise<Battle[]> {
    await this.ensureInitializedAsync();
    return this.getActiveBattlesInternal(lockContext);
  }

  /**
   * Internal method to get active battles
   * Requires caller to hold BATTLE lock (enforced at compile-time via lockContext parameter)
   * 
   * @param lockContext - REQUIRED lock context proving caller holds BATTLE lock
   */
  private getActiveBattlesInternal(lockContext: LockContext<LocksAtMostAndHas2>): Battle[] {
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
   * Check if a battle is in cache (for testing)
   * Returns the cached battle or null if not in cache
   */
  getBattleFromCache(battleId: number): Battle | null {
    this.ensureInitialized();
    return this.battles.get(battleId) ?? null;
  }

  /**
   * Persist all dirty battles to database (public async version)
   */
  async persistDirtyBattles(context: LockContext<LocksAtMostAndHas2>): Promise<void> {
    await this.persistDirtyBattlesInternal(context);
  }

  /**
   * Create a new battle
   * Creates battle in database and stores in cache
   * Auto-acquires necessary locks
   * 
   * @param contextBattleLock HAS level 2 lock
   * @param context has level 4 lock as well and can take more locks
   */
  async createBattle<THeld extends IronLocks>(
    contextBattleLock: HasLock2Context<THeld>,
    context: LockContext<LocksAtMost4>, 
    attackerId: number,
    attackeeId: number,
    attackerStartStats: BattleStats,
    attackeeStartStats: BattleStats,
    attackerInitialCooldowns: WeaponCooldowns,
    attackeeInitialCooldowns: WeaponCooldowns
  ): Promise<Battle> {
    await this.ensureInitializedAsync();
    
    const now = Math.floor(Date.now() / 1000);
    
    // Acquire DB lock and insert battle
    return await context.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      // Insert to database via battleRepo
      const battle = await battleRepo.insertBattleToDb(
        databaseContext,
        attackerId,
        attackeeId,
        now,
        attackerStartStats,
        attackeeStartStats,
        attackerInitialCooldowns,
        attackeeInitialCooldowns
      );
      
      // Store in cache
      this.setBattleInCacheInternal(contextBattleLock, battle);
      
      return battle;
    });
  }

  /**
   * Update weapon cooldowns for a battle
   */
  async updateWeaponCooldowns(
    context: LockContext<LocksAtMostAndHas2>,
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
    this.updateBattleInCacheInternal(context, battle);
  }

  /**
   * Add a battle event to the battle log
   */
  async addBattleEvent<THeld extends IronLocks>(context: HasLock2Context<THeld>, battleId: number, event: BattleEvent): Promise<void> {
    await this.ensureInitializedAsync();
    
    // Get battle from cache
    const battle = this.battles.get(battleId);
    if (!battle) {
      throw new Error(`Battle ${battleId} not found in cache`);
    }

    // Add event to log
    battle.battleLog.push(event);

    // Mark battle as dirty for persistence
    this.updateBattleInCacheInternal(context, battle);
  }

  /**
   * Set weapon cooldown for specific weapon
   */
  async setWeaponCooldown(
    context: LockContext<LocksAtMostAndHas2>,
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
    this.updateBattleInCacheInternal(context, battle);
  }

  /**
   * Update battle stats for both players
   * Auto-acquires necessary locks
   */
  async updateBattleStats(
    context: LockContext<LocksAtMostAndHas2>,
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
    this.updateBattleInCacheInternal(context, battle);
  }

  /**
   * Update total damage dealt in a battle
   * Auto-acquires necessary locks
   */
  async updateTotalDamage(
    context: LockContext<LocksAtMostAndHas2>,
    battleId: number,
    userId: number,
    additionalDamage: number
  ): Promise<void> {
    await this.ensureInitializedAsync();
    
    // Get battle from cache
    const battle = this.battles.get(battleId);
    if (!battle) {
      throw new Error(`Battle ${battleId} not found in cache`);
    }

    // Update total damage
    if (userId === battle.attackerId) {
      battle.attackerTotalDamage += additionalDamage;
    } else if (userId === battle.attackeeId) {
      battle.attackeeTotalDamage += additionalDamage;
    } else {
      throw new Error(`User ${userId} is not part of battle ${battleId}`);
    }

    // Mark battle as dirty for persistence
    this.updateBattleInCacheInternal(context, battle);
  }

  /**
   * End a battle
   * Updates battle in cache, persists to database, then removes from cache
   * Auto-acquires necessary locks
   */
  async endBattle(
    context: LockContext<LocksAtMostAndHas2>,
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
    this.updateBattleInCacheInternal(context, battle);

    // Persist to database immediately before removing from cache
    await this.persistDirtyBattles(context);

    // Remove from cache (completed battles are not kept in memory)
    this.deleteBattleFromCacheInternal(context, battleId);
  }

  /**
   * Get all battles (for admin view)
   * Queries database directly as this includes historical battles
   */
  async getAllBattles(): Promise<Battle[]> {
    await this.ensureInitializedAsync();
    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      return await battleRepo.getAllBattlesFromDb(databaseContext);
    });
  }

  /**
   * Get battles for a specific user (for history)
   * Queries database directly as this includes historical battles
   */
  async getBattlesForUser(userId: number): Promise<Battle[]> {
    await this.ensureInitializedAsync();
    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      return await battleRepo.getBattlesForUserFromDb(databaseContext, userId);
    });
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
  private async loadBattleFromDb(context: LockContext<LocksAtMostAndHas2>, battleId: number): Promise<Battle | null> {
    return await context.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      return await battleRepo.getBattleFromDb(databaseContext, battleId);
    });
  }

  /**
   * Load ongoing battle for user from database
   */
  private async loadOngoingBattleForUserFromDb(context: LockContext<LocksAtMostAndHas2>, userId: number): Promise<Battle | null> {
    return await context.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      return await battleRepo.getOngoingBattleForUserFromDb(databaseContext, userId);
    });
  }

  /**
   * Persist single battle to database
   * Called only by BattleCache - this is the ONLY way battles get written to DB
   */
  private async persistBattle(battle: Battle, dbContext: LockContext<LocksAtMostAndHas2>): Promise<void> {
    // Use battleRepo to update the battle in database
    await dbContext.useLockWithAcquire(DATABASE_LOCK_BATTLES, async (databaseContext) => {
      await battleRepo.updateBattleInDb(databaseContext, battle);
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

    this.persistenceTimer = setInterval(async () => {
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
        await this.persistDirtyBattlesInternal(battleContext).catch((err) => {
          console.error('Error persisting dirty battles:', err);
        });
      });
    }, this.PERSISTENCE_INTERVAL_MS);
  }

  /**
   * Persist all dirty battles to database (async, internal)
   */
  private async persistDirtyBattlesInternal(context: LockContext<LocksAtMostAndHas2>): Promise<void> {
    if (this.dirtyBattles.size === 0) {
      return;
    }

    // Get list of dirty battle IDs
    const dirtyIds = Array.from(this.dirtyBattles);
    
    for (const battleId of dirtyIds) {
      const battle = this.battles.get(battleId);
      if (battle) {
        await this.persistBattle(battle, context);
        this.dirtyBattles.delete(battleId);
      }
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

export async function getBattle(context: LockContext<LocksAtMostAndHas2>, battleId: number): Promise<Battle | null> {
  const cache = await getBattleCacheInitialized();
  return cache.loadBattleIfNeeded(context, battleId);
}

export async function getOngoingBattleForUser(context: LockContext<LocksAtMostAndHas2>, userId: number): Promise<Battle | null> {
  const cache = await getBattleCacheInitialized();
  return cache.getOngoingBattleForUser(context, userId);
}

export async function updateWeaponCooldowns(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  userId: number,
  weaponCooldowns: WeaponCooldowns
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.updateWeaponCooldowns(context, battleId, userId, weaponCooldowns);
}

export async function addBattleEvent(context: LockContext<LocksAtMostAndHas2>, battleId: number, event: BattleEvent): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.addBattleEvent(context, battleId, event);
}

export async function updateBattleDefenses(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  attackerEndStats: BattleStats | null,
  attackeeEndStats: BattleStats | null
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.updateBattleStats(context, battleId, attackerEndStats, attackeeEndStats);
}

export async function endBattle(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  winnerId: number,
  loserId: number,
  attackerEndStats: BattleStats,
  attackeeEndStats: BattleStats
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.endBattle(context, battleId, winnerId, loserId, attackerEndStats, attackeeEndStats);
}

export async function getAllBattles(): Promise<Battle[]> {
  const cache = await getBattleCacheInitialized();
  return cache.getAllBattles();
}

export async function getBattlesForUser(userId: number): Promise<Battle[]> {
  const cache = await getBattleCacheInitialized();
  return cache.getBattlesForUser(userId);
}

export async function getActiveBattles(context: LockContext<LocksAtMostAndHas2>): Promise<Battle[]> {
  const cache = await getBattleCacheInitialized();
  return cache.getActiveBattles(context);
}

export async function setWeaponCooldown(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  userId: number,
  weaponType: string,
  cooldown: number
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.setWeaponCooldown(context, battleId, userId, weaponType, cooldown);
}

export async function updateBattleStats(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  attackerEndStats: BattleStats | null,
  attackeeEndStats: BattleStats | null
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.updateBattleStats(context, battleId, attackerEndStats, attackeeEndStats);
}

export async function updateTotalDamage(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  userId: number,
  additionalDamage: number
): Promise<void> {
  const cache = await getBattleCacheInitialized();
  return cache.updateTotalDamage(context, battleId, userId, additionalDamage);
}

/**
 * Backward compatibility object that mimics the old BattleRepo API
 * All methods delegate to BattleCache
 * This allows existing code to work without changes during migration
 */
export const BattleRepo = {
  createBattle: async (
    context: LockContext<LocksAtMostAndHas2>,
    attackerId: number,
    attackeeId: number,
    attackerStartStats: BattleStats,
    attackeeStartStats: BattleStats,
    attackerInitialCooldowns: WeaponCooldowns,
    attackeeInitialCooldowns: WeaponCooldowns
  ) => {
    await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const cache = await getBattleCacheInitialized();
      return cache.createBattle(
        context,
        userContext,
        attackerId,
        attackeeId,
        attackerStartStats,
        attackeeStartStats,
        attackerInitialCooldowns,
        attackeeInitialCooldowns
      );
    });
  },

  getBattle: async (context: LockContext<LocksAtMostAndHas2>, battleId: number) => {
    const cache = await getBattleCacheInitialized();
    return cache.loadBattleIfNeeded(context, battleId);
  },

  getOngoingBattleForUser: async (context: LockContext<LocksAtMostAndHas2>, userId: number) => {
    const cache = await getBattleCacheInitialized();
    return cache.getOngoingBattleForUser(context, userId);
  },

  updateWeaponCooldowns: async (
    context: LockContext<LocksAtMostAndHas2>,
    battleId: number,
    userId: number,
    weaponCooldowns: WeaponCooldowns
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.updateWeaponCooldowns(context, battleId, userId, weaponCooldowns);
  },

  addBattleEvent: async <THeld extends IronLocks>(context: HasLock2Context<THeld>, battleId: number, event: BattleEvent) => {
    const cache = await getBattleCacheInitialized();
    return cache.addBattleEvent(context, battleId, event);
  },

  updateBattleDefenses: async (
    context: LockContext<LocksAtMostAndHas2>,
    battleId: number,
    attackerEndStats: BattleStats | null,
    attackeeEndStats: BattleStats | null
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.updateBattleStats(context, battleId, attackerEndStats, attackeeEndStats);
  },

  endBattle: async (
    context: LockContext<LocksAtMostAndHas2>,
    battleId: number,
    winnerId: number,
    loserId: number,
    attackerEndStats: BattleStats,
    attackeeEndStats: BattleStats
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.endBattle(context, battleId, winnerId, loserId, attackerEndStats, attackeeEndStats);
  },

  getAllBattles: async () => {
    const cache = await getBattleCacheInitialized();
    return cache.getAllBattles();
  },

  getBattlesForUser: async (userId: number) => {
    const cache = await getBattleCacheInitialized();
    return cache.getBattlesForUser(userId);
  },

  getActiveBattles: async (context: LockContext<LocksAtMostAndHas2>) => {
    const cache = await getBattleCacheInitialized();
    return cache.getActiveBattles(context);
  },

  setWeaponCooldown: async (
    context: LockContext<LocksAtMostAndHas2>,
    battleId: number,
    userId: number,
    weaponType: string,
    cooldown: number
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.setWeaponCooldown(context, battleId, userId, weaponType, cooldown);
  },

  updateBattleStats: async (
    context: LockContext<LocksAtMostAndHas2>,
    battleId: number,
    attackerEndStats: BattleStats | null,
    attackeeEndStats: BattleStats | null
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.updateBattleStats(context, battleId, attackerEndStats, attackeeEndStats);
  },

  updateTotalDamage: async (
    context: LockContext<LocksAtMostAndHas2>, 
    battleId: number,
    userId: number,
    additionalDamage: number
  ) => {
    const cache = await getBattleCacheInitialized();
    return cache.updateTotalDamage(context, battleId, userId, additionalDamage);
  }
};
