// ---
// Cache manager for User and World data
// Uses IronGuard lock system with hierarchical locking
// ---

import { createLockContext, HasLock4Context, IronLocks, LOCK_10, LockContext, LocksAtMost3, LocksAtMost4, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import sqlite3 from 'sqlite3';
import { MessageCache } from '../messages/MessageCache';
import {
  USER_LOCK,
} from '../typedLocks';
import { User } from './user';
import { getUserByIdFromDb, getUserByUsernameFromDb } from './userRepo';
import { WorldCache } from '../world/worldCache';
import { Cache } from '../caches/Cache';

type userCacheDependencies = {
  worldCache?: WorldCache;
  messageCache?: MessageCache;
};

// Cache configuration interface
export interface TypedCacheConfig {
  persistenceIntervalMs: number;
  enableAutoPersistence: boolean;
  logStats: boolean;
}

// Cache statistics interface
export interface TypedCacheStats {
  userCacheSize: number;
  usernameCacheSize: number;
  worldCacheHits: number;
  worldCacheMisses: number;
  userCacheHits: number;
  userCacheMisses: number;
  dirtyUsers: number;
  worldDirty: boolean;
}

declare global {
  var userWorldCacheInstance: UserCache | null;
}

/**
 * Typed Cache Manager with compile-time deadlock prevention
 * Enforces singleton pattern and lock ordering
 */
export class UserCache extends Cache {
  private static dependencies: userCacheDependencies = {};

  // ===== FIELDS =====


  // Core infrastructure
  private config: TypedCacheConfig = {
    persistenceIntervalMs: 30000,
    enableAutoPersistence: true,
    logStats: false
  };

  private db: sqlite3.Database | null = null;
  private persistenceTimer: NodeJS.Timeout | null = null;

  // In-memory cache storage
  private users: Map<number, User> = new Map();
  private usernameToUserId: Map<string, number> = new Map(); // username -> userId mapping
  private dirtyUsers: Set<number> = new Set();

  // Statistics
  private stats = {
    userCacheHits: 0,
    userCacheMisses: 0
  };

  private dependencies: userCacheDependencies = {};
  private worldCacheRef: WorldCache | null = null;


  // Singleton enforcement
  private constructor() {
    super();
    this.dependencies = UserCache.dependencies;
    console.log('🧠 Typed cache manager initialized');
  }

  private static get instance(): UserCache | null {
    return globalThis.userWorldCacheInstance || null;
  }

  private static set instance(value: UserCache | null) {
    globalThis.userWorldCacheInstance = value;
  }

  /**
   * Initialize singleton instance, only to be called at as part of the server startup or testing
   * 
   * @param config optional configuration for the cache
   */
  static async intialize2(db: sqlite3.Database, dependencies: userCacheDependencies = {}, config?: TypedCacheConfig): Promise<void> {
    UserCache.configureDependencies(dependencies);
    this.instance = new UserCache();
    if (config) {
      this.instance.config = config;
    }
    this.instance.db = db;
  }

  /**
   * Synchronous non-locking getter for singleton instance, which was initialized at startup
   */
  static getInstance2(): UserCache {
    if (!this.instance) {
      throw new Error('UserWorldCache not initialized');
    }
    return this.instance;
  }

  // Reset singleton for testing
  static resetInstance(): void {
    this.instance = null;
    WorldCache.resetInstance();
  }

  static configureDependencies(dependencies: userCacheDependencies): void {
    UserCache.dependencies = dependencies;
    if (UserCache.instance) {
      UserCache.instance.dependencies = dependencies;
      UserCache.instance.worldCacheRef = dependencies.worldCache ?? null;
    }
  }

  /**
   * Get database connection (for BattleCache and other components)
   * Returns the database connection after ensuring initialization
   */
  // needs _context for compile time lock checking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getDatabaseConnection(_context: LockContext<LocksAtMostAndHas4>): Promise<sqlite3.Database> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  private getWorldCacheOrNull(): WorldCache | null {
    return this.worldCacheRef ?? this.dependencies.worldCache ?? null;
  }

  private async getMessageCache(): Promise<MessageCache | null> {
    if (this.dependencies.messageCache) {
      return this.dependencies.messageCache;
    }

    try {
      const { getMessageCache } = await import('../messages/MessageCache');
      return getMessageCache();
    } catch {
      return null;
    }
  }

  // ===== DATABASE OPERATIONS =====

  /**
   * Load user from database helper (requires context with locks up to USER_LOCK)
   */
  private async loadUserFromDb(
    context: LockContext<LocksAtMostAndHas4>,
    userId: number
  ): Promise<User | null> {
    return await context.useLockWithAcquire(LOCK_10, async () => {
      if (!this.db) throw new Error('Database not initialized');
      return await getUserByIdFromDb(this.db, userId, async () => { });
    });
  }

  /**
   * Load user by username from database helper (requires context with locks up to USER_LOCK)
   */
  private async loadUserByUsernameFromDb(
    context: LockContext<LocksAtMostAndHas4>,
    username: string
  ): Promise<User | null> {
    return await context.useLockWithAcquire(LOCK_10, async () => {
      if (!this.db) throw new Error('Database not initialized');
      return await getUserByUsernameFromDb(this.db, username, async () => { });
    });
  }

  // ===== USER OPERATIONS =====

  /**
   * Get user data from cache, will return null if not found. Requires user lock context.
   * 
   * Use getUserById for safe loading from database if not in cache.
   */
  getUserByIdFromCache<THeld extends IronLocks>(
    _context: HasLock4Context<THeld>,
    userId: number
  ): User | null {
    const user = this.users.get(userId);
    if (user) {
      this.stats.userCacheHits++;
      return user;
    } else {
      this.stats.userCacheMisses++;
      return null;
    }
  }

  /**
   * Announces that the user was written to the DB and is now safe to cache
   * This should only be called after a successful database write operation.
   */
  setUserUnsafe<THeld extends IronLocks>(_context: HasLock4Context<THeld>, user: User): void {
    this.users.set(user.id, user);
    this.usernameToUserId.set(user.username, user.id); // Cache username mapping
    this.dirtyUsers.delete(user.id); // Fresh from DB, not dirty
    console.log(`👤 User ${user.id} cached in memory`);
  }


  /**
   * Update user data in the cache, marking as dirty (requires user lock context)
   */
  updateUserInCache(_context: LockContext<LocksAtMostAndHas4>, user: User): void {
    this.users.set(user.id, user);
    this.usernameToUserId.set(user.username, user.id); // Update username mapping
    this.dirtyUsers.add(user.id); // Mark as dirty for persistence
  }

  /**
   * Internal method to get user by ID when already holding USER_LOCK
   * - Loads from database if not in cache
   * - Updates user before returning
   */
  async getUserByIdWithLock(
    context: LockContext<LocksAtMostAndHas4>,
    userId: number
  ): Promise<User | null> {
    // Check cache first
    let user = this.getUserByIdFromCache(context, userId);

    // if (user) {
    //   console.log(`👤 User ${userId} cache hit`);
    // }

    if (!user) {
      console.log(`🔍 User ${userId} cache miss, loading from database`);
      user = await this.loadUserFromDb(context, userId);
      if (user) {
        this.setUserUnsafe(context, user);
      }
    }

    if (user) {
      user.updateStats(Math.floor(Date.now() / 1000));
      this.updateUserInCache(context, user);
      return user;
    }
    return null;
  }

  /**
   * Get user by ID (with caching) for reading purposes
   * - Loads from database if not in cache
   * - Updates user before returning
   */
  async getUserById(context: LockContext<LocksAtMost3>, userId: number): Promise<User | null> {

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await this.getUserByIdWithLock(userContext, userId);
    });
  }

  /**
   * Internal method to get user by username when already holding USER_LOCK
   * - Loads from database if not in cache
   * - Updates user before returning
   */
  private async getUserByUsernameInternal(
    context: LockContext<LocksAtMostAndHas4>,
    username: string
  ): Promise<User | null> {
    // Check username cache first
    const cachedUserId = this.usernameToUserId.get(username);
    let user: User | null = null;
    if (cachedUserId) {
      user = this.getUserByIdFromCache(context, cachedUserId);
      // if (user) {
      //   console.log(`👤 Username "${username}" cache hit for user ID ${cachedUserId}`);
      // }
    }

    if (!user) {
      // Cache miss - load from database
      console.log(`🔍 Username "${username}" cache miss, loading from database`);
      user = await this.loadUserByUsernameFromDb(context, username);
    }

    if (user) {
      user.updateStats(Math.floor(Date.now() / 1000));
      this.updateUserInCache(context, user);
      return user;
    }

    return null;
  }

  /**
   * Get user by name (with caching)
   * - Loads from database if not in cache
   * - Updates user before returning
   */
  async getUserByUsername(context: LockContext<LocksAtMostAndHas4>, username: string): Promise<User | null> {
    return await this.getUserByUsernameInternal(context, username);
  }

  // ===== PERSISTENCE RELATED OPERATIONS =====

  /**
   * Get cache statistics
   */
  // needs _context for compile time lock checking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getStats(_context: LockContext<LocksAtMostAndHas4>): Promise<TypedCacheStats> {
    const worldStats = this.getWorldCacheOrNull()?.getStats();

    return {
      userCacheSize: this.users.size,
      usernameCacheSize: this.usernameToUserId.size,
      worldCacheHits: worldStats?.worldCacheHits ?? 0,
      worldCacheMisses: worldStats?.worldCacheMisses ?? 0,
      userCacheHits: this.stats.userCacheHits,
      userCacheMisses: this.stats.userCacheMisses,
      dirtyUsers: this.dirtyUsers.size,
      worldDirty: worldStats?.worldDirty ?? false
    };
  }

  /**
   * Force flush all dirty data to database
   * Useful for ensuring data is persisted before reading directly from DB
   */
  async flushAllToDatabase(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    console.log('🔄 Flushing all dirty data to database...');

    // Persist dirty users
    if (this.dirtyUsers.size > 0) {
      console.log(`💾 Flushing ${this.dirtyUsers.size} dirty user(s)`);
      await this.persistDirtyUsers(context);
    }

    // Persist dirty world data via world cache
    const worldCache = this.getWorldCacheOrNull();
    if (worldCache) {
      console.log('💾 Flushing world data');
      await worldCache.flushToDatabase();
    }

    const messageCache = await this.getMessageCache();
    if (messageCache) {
      await messageCache.flushToDatabase(context);
    }

    console.log('✅ All dirty data flushed to database');
  }

  /**
   * Manually persist all dirty users to database
   */
  private async persistDirtyUsers(context: LockContext<LocksAtMost4>): Promise<void> {
    await context.useLockWithAcquire(LOCK_10, async () => {
      const dirtyUserIds = Array.from(this.dirtyUsers);

      if (dirtyUserIds.length === 0) {
        return;
      }

      console.log(`💾 Persisting ${dirtyUserIds.length} dirty user(s) to database...`);

      for (const userId of dirtyUserIds) {
        const user = this.users.get(userId);
        if (user) {
          await this.persistUserToDb(user);
        }
      }

      this.dirtyUsers.clear();
      console.log('✅ Dirty users persisted to database');
    });

  }

  /**
   * Persist a single user to database
   */
  private async persistUserToDb(user: User): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise<void>((resolve, reject) => {
      this.db!.run(
        `UPDATE users SET 
          iron = ?, 
          last_updated = ?, 
          tech_tree = ?, 
          ship_id = ?,
          pulse_laser = ?,
          auto_turret = ?,
          plasma_lance = ?,
          gauss_rifle = ?,
          photon_torpedo = ?,
          rocket_launcher = ?,
          ship_hull = ?,
          kinetic_armor = ?,
          energy_shield = ?,
          missile_jammer = ?,
          hull_current = ?,
          armor_current = ?,
          shield_current = ?,
          defense_last_regen = ?,
          in_battle = ?,
          current_battle_id = ?,
          build_queue = ?,
          build_start_sec = ?
        WHERE id = ?`,
        [
          user.iron,
          user.last_updated,
          JSON.stringify(user.techTree),
          user.ship_id,
          user.techCounts.pulse_laser,
          user.techCounts.auto_turret,
          user.techCounts.plasma_lance,
          user.techCounts.gauss_rifle,
          user.techCounts.photon_torpedo,
          user.techCounts.rocket_launcher,
          user.techCounts.ship_hull,
          user.techCounts.kinetic_armor,
          user.techCounts.energy_shield,
          user.techCounts.missile_jammer,
          user.hullCurrent,
          user.armorCurrent,
          user.shieldCurrent,
          user.defenseLastRegen,
          user.inBattle ? 1 : 0,
          user.currentBattleId,
          JSON.stringify(user.buildQueue),
          user.buildStartSec,
          user.id
        ],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }


  /**
   * Start background persistence timer
   */
  private startBackgroundPersistence(): void {
    if (!this.config.enableAutoPersistence) {
      console.log('📝 Background persistence disabled by config');
      return;
    }

    console.log(`📝 Starting background persistence (interval: ${this.config.persistenceIntervalMs}ms)`);

    this.persistenceTimer = setInterval(async () => {
      try {
        const ctx = createLockContext();
        ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
          await this.backgroundPersist(userContext);
        });
      } catch (error) {
        console.error('❌ Background persistence error:', error);
      }
    }, this.config.persistenceIntervalMs);
  }

  /**
   * Stop background persistence timer
   */
  private stopBackgroundPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
      console.log('⏹️ Background persistence stopped');
    }
  }

  /**
   * Background persistence operation
   */
  private async backgroundPersist(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    // Persist dirty users
    if (this.dirtyUsers.size > 0) {
      console.log(`💾 Background persisting ${this.dirtyUsers.size} dirty user(s)`);
      await this.persistDirtyUsers(context);
    }
    // Note: Messages and world data are handled by their own caches
  }

  /**
   * Shutdown the cache manager
   * Currently only used in tests
   */
  async shutdown(): Promise<void> {
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      console.log('🔄 Shutting down typed cache manager...');

      // Stop background persistence
      this.stopBackgroundPersistence();

      // Final persist of any dirty data
      if (this.dirtyUsers.size > 0) {
        console.log('💾 Final persist of dirty users before shutdown');
        await this.persistDirtyUsers(userContext);
      }

      const worldCache = this.getWorldCacheOrNull();
      if (worldCache) {
        console.log('💾 Final persist of world data before shutdown');
        await worldCache.flushToDatabase();
        await worldCache.shutdown();
      }

      const messageCache = await this.getMessageCache();
      if (messageCache) {
        await messageCache.flushToDatabase(userContext);
        await messageCache.shutdown();
      }

      console.log('✅ Typed cache manager shutdown complete');
    });
  }
}

