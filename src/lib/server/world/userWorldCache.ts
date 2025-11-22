// ---
// Cache manager for User and World data
// Uses IronGuard lock system with hierarchical locking
// ---

import { createLockContext, HasLock4Context, HasLock6Context, IronLocks, LOCK_10, LOCK_11, LOCK_9, LockContext, LocksAtMost1, LocksAtMost3, LocksAtMost4, LocksAtMost8, LocksAtMostAndHas4, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';
import sqlite3 from 'sqlite3';
import { getDatabase } from '../database';
import {
  CACHES_LOCK,
  USER_LOCK,
  WORLD_LOCK
} from '../typedLocks';
import { User } from './user';
import { getUserByIdFromDb, getUserByUsernameFromDb } from './userRepo';
import { World } from './world';
import { loadWorldFromDb, saveWorldToDb } from './worldRepo';

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
  var userWorldCacheInstance: UserWorldCache | null;
}

/**
 * Typed Cache Manager with compile-time deadlock prevention
 * Enforces singleton pattern and lock ordering
 */
export class UserWorldCache {

  // ===== FIELDS =====


  // Core infrastructure
  private config: TypedCacheConfig = {
    persistenceIntervalMs: 30000,
    enableAutoPersistence: true,
    logStats: false
  };
  
  private db: sqlite3.Database | null = null;
  private isInitialized = false;
  private persistenceTimer: NodeJS.Timeout | null = null;

  // In-memory cache storage
  private users: Map<number, User> = new Map();
  private world: World | null = null;
  private usernameToUserId: Map<string, number> = new Map(); // username -> userId mapping
  private dirtyUsers: Set<number> = new Set();
  private worldDirty: boolean = false;

  // Statistics
  private stats = {
    worldCacheHits: 0,
    worldCacheMisses: 0,
    userCacheHits: 0,
    userCacheMisses: 0
  };


  // Singleton enforcement
  private constructor() {
    console.log('🧠 Typed cache manager initialized');
  }

  private static get instance(): UserWorldCache | null {
    return globalThis.userWorldCacheInstance || null;
  }

  private static set instance(value: UserWorldCache | null) {
    globalThis.userWorldCacheInstance = value;
  }

  /**
   * Initialize singleton instance, only to be called at as part of the server startup or testing
   * 
   * @param config optional configuration for the cache
   */
  static async intialize2(world: World, db: sqlite3.Database, config?: TypedCacheConfig): Promise<void> {
    this.instance = new UserWorldCache();
    if (config) {
      this.instance.config = config;
    }
    this.instance.db = db;
    this.instance.world = world;
    this.instance.isInitialized = true;
  }

  /**
   * Synchronous non-locking getter for singleton instance, which was initialized at startup
   */
  static getInstance2(): UserWorldCache {
    if (!this.instance) {
      throw new Error('UserWorldCache not initialized');
    }
    return this.instance;
  }
  
  static async getInstance(context: LockContext<LocksAtMost8>, config?: TypedCacheConfig): Promise<UserWorldCache> {
    if (!this.instance) {
      return await context.useLockWithAcquire(CACHES_LOCK, () => {
        if (!this.instance) {
          this.instance = new UserWorldCache();
          if (config) {
            this.instance.config = config;
          }
        }
        return this.instance;
      }); 
    }
    return this.instance;
  }

  // Reset singleton for testing
  static resetInstance(): void {
    this.instance = null;
  }

  /**
   * Check if cache manager is initialized
   */
  get isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize the cache manager (idempotent - safe to call multiple times)
   */
  async initialize(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    if (this.isInitialized) {
      return; // Fast path - already initialized
    }

    console.log('🚀 Initializing typed cache manager...');

    // Need database connection
    await context.useLockWithAcquire(LOCK_10, async () => {
      // Initialize database connection
      this.db = await getDatabase();
      console.log('✅ user & world Database connected');
    });

    // Load world data
    await this.initializeWorld(context);
    console.log('✅ World data loaded');

    // Start background persistence if enabled
    this.startBackgroundPersistence();

    // Start battle scheduler
    this.startBattleScheduler();

    this.isInitialized = true;
    console.log('✅ userWorld cache initialization complete');
  }

  /**
   * Ensure cache manager is initialized before operations
   * (internal helper for auto-initialization)
   */
  private async ensureInitialized(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(context);
    }
  }

  /**
   * Get database connection (for BattleCache and other components)
   * Returns the database connection after ensuring initialization
   */
  async getDatabaseConnection(context: LockContext<LocksAtMostAndHas4>): Promise<sqlite3.Database> {
    await this.ensureInitialized(context);
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Load world data from database into cache
   */
  private async initializeWorld(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      await worldContext.useLockWithAcquire(LOCK_11, async () => {
        console.log('🌍 Loading world data from database...');
        this.world = await loadWorldFromDb(this.db!, async () => {
          this.worldDirty = true;
        });
        this.worldDirty = false;
        this.stats.worldCacheMisses++;
        console.log('🌍 World data cached in memory');
      });
    });
  }

  // ===== WORLD OPERATIONS =====

  /**
   * Get world data reference (requires world lock context). Performs a physics update.
   */
  getWorldFromCache(context: LockContext<LocksAtMostAndHas6>): World {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    this.stats.worldCacheHits++;
    this.world.updatePhysics(context, Date.now());
    return this.world;
  }

  /**
   * Update world data without acquiring locks (requires world write lock context)
   */
  updateWorldUnsafe(_context:LockContext<LocksAtMostAndHas6>, world: World): void {
    this.world = world;
    this.worldDirty = true;
  }

  // ===== DATABASE OPERATIONS =====

  /**
   * Load user from database helper (requires context with locks up to USER_LOCK)
   */
  private async loadUserFromDb(
    context: LockContext<LocksAtMostAndHas4>,
    userId: number
  ): Promise<User | null> {
    await this.ensureInitialized(context);
    return await context.useLockWithAcquire(LOCK_10, async () => {
      if (!this.db) throw new Error('Database not initialized');
      return await getUserByIdFromDb(this.db, userId, async () => {});
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
      return await getUserByUsernameFromDb(this.db, username, async () => {});
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
      await this.ensureInitialized(userContext);
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
    await this.ensureInitialized(context);
    return await this.getUserByUsernameInternal(context, username);
  }

  // ===== PERSISTENCE RELATED OPERATIONS =====

  /**
   * Get cache statistics
   */
  async getStats(context: LockContext<LocksAtMostAndHas4>): Promise<TypedCacheStats> {
    await this.ensureInitialized(context);
    
    return {
      userCacheSize: this.users.size,
      usernameCacheSize: this.usernameToUserId.size,
      worldCacheHits: this.stats.worldCacheHits,
      worldCacheMisses: this.stats.worldCacheMisses,
      userCacheHits: this.stats.userCacheHits,
      userCacheMisses: this.stats.userCacheMisses,
      dirtyUsers: this.dirtyUsers.size,
      worldDirty: this.worldDirty
    };
  }

  /**
   * Force flush all dirty data to database
   * Useful for ensuring data is persisted before reading directly from DB
   */
  async flushAllToDatabase(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    await this.ensureInitialized(context);
    
    console.log('🔄 Flushing all dirty data to database...');
    
    // Persist dirty users
    if (this.dirtyUsers.size > 0) {
      console.log(`💾 Flushing ${this.dirtyUsers.size} dirty user(s)`);
      await this.persistDirtyUsers(context);
    }
    
    // Persist dirty world data
    if (this.worldDirty) {
      console.log('💾 Flushing world data');
      await this.persistDirtyWorld(context);
    }
    
    // Flush messages via MessageCache (imported dynamically to avoid circular dependencies)
    const { getMessageCache } = await import('../messages/MessageCache');
    const messageCache = getMessageCache();
    await messageCache.flushToDatabase(context);
    
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
          defense_last_regen = ?
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
   * Manually persist dirty world data to database
   */
  private async persistDirtyWorld(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    if (!this.worldDirty || !this.world) {
      return; // Nothing to persist
    }

    await context.useLockWithAcquire(LOCK_11, async () => {
      if (!this.db) throw new Error('Database not initialized');
      
      console.log('💾 Persisting world data to database...');
      const saveCallback = saveWorldToDb(this.db);
      await saveCallback(this.world!);
      
      this.worldDirty = false;
      console.log('✅ World data persisted to database');
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
   * Start battle scheduler
   */
  private startBattleScheduler(): void {
    // Import dynamically to avoid circular dependencies
    import('../battle/battleScheduler').then(({ startBattleScheduler }) => {
      startBattleScheduler(1000); // Process battles every 1 second
    }).catch(error => {
      console.error('❌ Failed to start battle scheduler:', error);
    });
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

    // Persist dirty world data
    if (this.worldDirty) {
      console.log('💾 Background persisting world data...');
      await this.persistDirtyWorld(context);
    }
    
    // Note: Messages are persisted by MessageCache independently
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
      
      // Final persist of dirty world data before shutdown
      if (this.worldDirty) {
        console.log('💾 Final persist of world data before shutdown');
        await this.persistDirtyWorld(userContext);
      }
      
      this.isInitialized = false;
      console.log('✅ Typed cache manager shutdown complete');
    });
  }
}
  
// Convenience function to get singleton instance
export async function getUserWorldCache(context: LockContext<LocksAtMost8>, config?: TypedCacheConfig): Promise<UserWorldCache> {
  return await UserWorldCache.getInstance(context, config);
}
