// ---
// TypeScript Compile-Time Deadlock Prevention System
// Phase 2: Simplified Typed Cache Manager 
// ---

import { 
  createLockContext,
  type LockContext as IronGuardLockContext,
  CACHE_LOCK,
  WORLD_LOCK,
  USER_LOCK,
  MESSAGE_LOCK,
  DATABASE_LOCK,
  type CacheLevel,
  type WorldLevel,
  type UserLevel,
  // Import some backward compatibility helpers for the remaining methods
  TypedMutex,
  TypedReadWriteLock,
  type LockContext,
  type EmptyContext,
  type Locked,
  createEmptyContext
} from './typedLocks';
import { User } from './user';
import { World } from './world';
import { getDatabase } from './database';
import { loadWorldFromDb, saveWorldToDb } from './worldRepo';
import { getUserByIdFromDb, getUserByUsernameFromDb } from './userRepo';
import { getMessageCache } from './MessageCache';
import sqlite3 from 'sqlite3';

// Type aliases for IronGuard lock contexts
type WorldReadContext = IronGuardLockContext<readonly [typeof WORLD_LOCK]> | IronGuardLockContext<readonly [typeof CACHE_LOCK, typeof WORLD_LOCK]>;
type WorldWriteContext = IronGuardLockContext<readonly [typeof WORLD_LOCK]> | IronGuardLockContext<readonly [typeof CACHE_LOCK, typeof WORLD_LOCK]>;
type UserContext = IronGuardLockContext<readonly [typeof USER_LOCK]> | IronGuardLockContext<readonly [typeof CACHE_LOCK, typeof USER_LOCK]> | IronGuardLockContext<readonly [typeof WORLD_LOCK, typeof USER_LOCK]> | IronGuardLockContext<readonly [typeof CACHE_LOCK, typeof WORLD_LOCK, typeof USER_LOCK]>;
type DatabaseReadContext = IronGuardLockContext<readonly [typeof DATABASE_LOCK]> | IronGuardLockContext<readonly [typeof USER_LOCK, typeof DATABASE_LOCK]> | IronGuardLockContext<readonly [typeof WORLD_LOCK, typeof USER_LOCK, typeof DATABASE_LOCK]> | IronGuardLockContext<readonly [typeof CACHE_LOCK, typeof WORLD_LOCK, typeof USER_LOCK, typeof DATABASE_LOCK]>;
type DatabaseWriteContext = IronGuardLockContext<readonly [typeof DATABASE_LOCK]> | IronGuardLockContext<readonly [typeof USER_LOCK, typeof DATABASE_LOCK]> | IronGuardLockContext<readonly [typeof WORLD_LOCK, typeof USER_LOCK, typeof DATABASE_LOCK]> | IronGuardLockContext<readonly [typeof CACHE_LOCK, typeof WORLD_LOCK, typeof USER_LOCK, typeof DATABASE_LOCK]>;

// Context type for data access methods - accepts any context that provides the required lock
type WorldAccessContext = WorldReadContext | WorldWriteContext | UserContext | DatabaseReadContext | DatabaseWriteContext;
type UserAccessContext = UserContext | DatabaseReadContext | DatabaseWriteContext;
type DatabaseAccessContext = DatabaseReadContext | DatabaseWriteContext;

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

/**
 * Typed Cache Manager with compile-time deadlock prevention
 * Enforces singleton pattern and lock ordering
 */
export class TypedCacheManager {
  // Singleton enforcement
  private static instance: TypedCacheManager | null = null;
  private constructor() {
    console.log('🧠 Typed cache manager initialized');
  }

  static getInstance(config?: TypedCacheConfig): TypedCacheManager {
    if (!this.instance) {
      this.instance = new TypedCacheManager();
      if (config) {
        this.instance.config = config;
      }
    }
    return this.instance;
  }

  // Reset singleton for testing
  static resetInstance(): void {
    this.instance = null;
  }

  // Core infrastructure
  private config: TypedCacheConfig = {
    persistenceIntervalMs: 30000,
    enableAutoPersistence: true,
    logStats: false
  };
  private db: sqlite3.Database | null = null;
  private isInitialized = false;
  private persistenceTimer: NodeJS.Timeout | null = null;

  // IronGuard lock contexts - no instance needed for new methods
  // Legacy wrapper instances for methods not yet converted
  private cacheManagementLock = new TypedMutex('cache-mgmt', CACHE_LOCK as any);
  private userLock = new TypedMutex('user', USER_LOCK as any);
  private messageLock = new TypedReadWriteLock('message', MESSAGE_LOCK as any);
  private databaseLock = new TypedReadWriteLock('database', DATABASE_LOCK as any);
  private worldLock = new TypedReadWriteLock('world', WORLD_LOCK as any);

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

  /**
   * Check if cache manager is initialized
   */
  get isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize the cache manager - must be called before use
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const emptyCtx = createLockContext();
    
    const cacheCtx = await emptyCtx.acquireWrite(CACHE_LOCK);
    try {
      if (this.isInitialized) {
        return; // Double-check inside lock
      }

      console.log('🚀 Initializing typed cache manager...');

      // Initialize database connection
      this.db = await getDatabase();
      console.log('✅ Database connected');

      // Load world data
      await this.initializeWorld();
      console.log('✅ World data loaded');

      // Start background persistence if enabled
      this.startBackgroundPersistence();

      // Start battle scheduler
      this.startBattleScheduler();

      this.isInitialized = true;
      console.log('✅ Typed cache manager initialization complete');
    } finally {
      cacheCtx.dispose();
    }
  }

  /**
   * Load world data from database into cache
   */
  private async initializeWorld(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const emptyCtx = createLockContext();
    
    const worldCtx = await emptyCtx.acquireWrite(WORLD_LOCK);
    try {
      const dbCtx = await worldCtx.acquireRead(DATABASE_LOCK);
      try {
        console.log('🌍 Loading world data from database...');
        this.world = await loadWorldFromDb(this.db!, async () => {
          this.worldDirty = true;
        });
        this.worldDirty = false;
        this.stats.worldCacheMisses++;
        console.log('🌍 World data cached in memory');
      } finally {
        dbCtx.dispose();
      }
    } finally {
      worldCtx.dispose();
    }
  }

  // ===== LEVEL 1: WORLD OPERATIONS =====

  /**
   * Perform cache management operations with proper locking (legacy compatibility)
   */
  async withCacheManagement<T>(
    context: EmptyContext,
    fn: (ctx: LockContext<Locked<'cache-mgmt'>, CacheLevel>) => Promise<T>
  ): Promise<T> {
    return await this.cacheManagementLock.acquire(context, fn);
  }

  /**
   * Acquire world read lock and return context for chaining
   */
  async acquireWorldRead(
    context: IronGuardLockContext<readonly []>
  ): Promise<WorldReadContext> {
    return await context.acquireRead(WORLD_LOCK) as WorldReadContext;
  }

  /**
   * Acquire world write lock and return context for chaining
   */
  async acquireWorldWrite(
    context: IronGuardLockContext<readonly []>
  ): Promise<WorldWriteContext> {
    return await context.acquireWrite(WORLD_LOCK) as WorldWriteContext;
  }

  /**
   * Legacy compatibility: Perform world read operations with proper locking
   */
  async withWorldRead<T>(
    context: LockContext<any, CacheLevel | never>,
    fn: (ctx: WorldReadContext) => Promise<T>
  ): Promise<T> {
    return await this.worldLock.read(context, fn);
  }

  /**
   * Legacy compatibility: Perform world write operations with proper locking
   */
  async withWorldWrite<T>(
    context: LockContext<any, CacheLevel | never>,
    fn: (ctx: WorldWriteContext) => Promise<T>
  ): Promise<T> {
    return await this.worldLock.write(context, fn);
  }

  /**
   * Get world data without acquiring locks (requires world lock context)
   */
  getWorldUnsafe(_context: WorldAccessContext): World {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    this.stats.worldCacheHits++;
    return this.world;
  }

  /**
   * Update world data without acquiring locks (requires world write lock context)
   */
  updateWorldUnsafe(world: World, _context: WorldAccessContext): void {
    this.world = world;
    this.worldDirty = true;
  }

  // ===== LEVEL 2: USER OPERATIONS =====

  /**
   * Acquire user lock and return context for chaining
   */
  async acquireUserLock(
    context: IronGuardLockContext<readonly []> | WorldReadContext | WorldWriteContext
  ): Promise<UserContext> {
    return await context.acquireWrite(USER_LOCK) as UserContext;
  }

  /**
   * Legacy compatibility: Perform user operations with proper locking (single lock for ALL users)
   */
  async withUserLock<T>(
    context: LockContext<any, CacheLevel | WorldLevel | never>,
    fn: (ctx: UserContext) => Promise<T>
  ): Promise<T> {
    return await this.userLock.acquire(context, fn);
  }

  /**
   * Get user data without acquiring locks (requires user lock context)
   */
  getUserUnsafe(userId: number, _context: UserAccessContext): User | null {
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
   * Set user data without acquiring locks (requires user lock context)
   */
  setUserUnsafe(user: User, _context: UserAccessContext): void {
    this.users.set(user.id, user);
    this.usernameToUserId.set(user.username, user.id); // Cache username mapping
    this.dirtyUsers.delete(user.id); // Fresh from DB, not dirty
    console.log(`👤 User ${user.id} cached in memory`);
  }

  /**
   * Update user data without acquiring locks (requires user lock context)
   */
  updateUserUnsafe(user: User, _context: UserAccessContext): void {
    this.users.set(user.id, user);
    this.usernameToUserId.set(user.username, user.id); // Update username mapping
    this.dirtyUsers.add(user.id); // Mark as dirty for persistence
  }

  // ===== LEVEL 3: DATABASE OPERATIONS =====

  /**
   * Acquire database read lock and return context for chaining
   */
  async acquireDatabaseRead(
    context: IronGuardLockContext<readonly []> | WorldReadContext | WorldWriteContext | UserContext
  ): Promise<DatabaseReadContext> {
    return await context.acquireRead(DATABASE_LOCK) as DatabaseReadContext;
  }

  /**
   * Acquire database write lock and return context for chaining
   */
  async acquireDatabaseWrite(
    context: IronGuardLockContext<readonly []> | WorldReadContext | WorldWriteContext | UserContext
  ): Promise<DatabaseWriteContext> {
    return await context.acquireWrite(DATABASE_LOCK) as DatabaseWriteContext;
  }

  /**
   * Legacy compatibility: Perform database read operations with proper locking
   */
  async withDatabaseRead<T>(
    context: LockContext<any, CacheLevel | WorldLevel | UserLevel | never>,
    fn: (ctx: DatabaseReadContext) => Promise<T>
  ): Promise<T> {
    return await this.databaseLock.read(context, fn);
  }

  /**
   * Legacy compatibility: Perform database write operations with proper locking
   */
  async withDatabaseWrite<T>(
    context: LockContext<any, CacheLevel | WorldLevel | UserLevel | never>,
    fn: (ctx: DatabaseWriteContext) => Promise<T>
  ): Promise<T> {
    return await this.databaseLock.write(context, fn);
  }

  /**
   * Load user from database without acquiring locks (requires database read lock context)
   */
  async loadUserFromDbUnsafe(userId: number, _context: DatabaseAccessContext): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return await getUserByIdFromDb(this.db, userId, async () => {});
  }

  /**
   * Load user by username from database without acquiring locks (requires database read lock context)
   */
  async loadUserByUsernameFromDbUnsafe(username: string, _context: DatabaseAccessContext): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return await getUserByUsernameFromDb(this.db, username, async () => {});
  }

  // ===== HIGH-LEVEL OPERATIONS WITH PROPER LOCK ORDERING =====

  /**
   * Load user from database if not in cache (proper lock ordering)
   */
  async loadUserIfNeeded(userId: number): Promise<User | null> {
    const emptyCtx = createLockContext();
    
    const userCtx = await this.acquireUserLock(emptyCtx);
    try {
      let user = this.getUserUnsafe(userId, userCtx);
      if (user) {
        return user;
      }

      // Load from database
      const dbCtx = await this.acquireDatabaseRead(userCtx);
      try {
        console.log(`🔄 User ${userId} cache miss, loading from database...`);
        user = await this.loadUserFromDbUnsafe(userId, dbCtx);
        if (user) {
          this.setUserUnsafe(user, userCtx);
        }
        return user;
      } finally {
        dbCtx.dispose();
      }
    } finally {
      userCtx.dispose();
    }
  }

  /**
   * Get user by username (with caching)
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const emptyCtx = createLockContext();
    
    const userCtx = await this.acquireUserLock(emptyCtx);
    try {
      // Check username cache first
      const cachedUserId = this.usernameToUserId.get(username);
      if (cachedUserId) {
        const user = this.getUserUnsafe(cachedUserId, userCtx);
        if (user) {
          console.log(`👤 Username "${username}" cache hit for user ID ${cachedUserId}`);
          return user;
        }
      }
      
      // Cache miss - load from database
      console.log(`🔍 Username "${username}" cache miss, loading from database`);
      const dbCtx = await this.acquireDatabaseRead(userCtx);
      try {
        const user = await this.loadUserByUsernameFromDbUnsafe(username, dbCtx);
        if (user) {
          this.setUserUnsafe(user, userCtx);
        }
        return user;
      } finally {
        dbCtx.dispose();
      }
    } finally {
      userCtx.dispose();
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<TypedCacheStats> {
    const emptyCtx = createLockContext();
    
    const userCtx = await this.acquireUserLock(emptyCtx);
    try {
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
    } finally {
      userCtx.dispose();
    }
  }

  /**
   * Force flush all dirty data to database
   * Useful for ensuring data is persisted before reading directly from DB
   */
  async flushAllToDatabase(): Promise<void> {
    const emptyCtx = createLockContext();
    
    console.log('🔄 Flushing all dirty data to database...');
    
    // Persist dirty users
    if (this.dirtyUsers.size > 0) {
      console.log(`💾 Flushing ${this.dirtyUsers.size} dirty user(s)`);
      await this.persistDirtyUsers(emptyCtx);
    }
    
    // Persist dirty world data
    if (this.worldDirty) {
      console.log('💾 Flushing world data');
      await this.persistDirtyWorld(emptyCtx);
    }
    
    // Flush messages via MessageCache
    const messageCache = getMessageCache();
    await messageCache.flushToDatabase();
    
    console.log('✅ All dirty data flushed to database');
  }

  /**
   * Manually persist all dirty users to database
   */
  async persistDirtyUsers<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>
  ): Promise<void> {
    await this.userLock.acquire(context, async (userCtx) => {
      await this.databaseLock.write(userCtx, async () => {
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
  async persistDirtyWorld<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>
  ): Promise<void> {
    await this.worldLock.write(context, async (worldCtx) => {
      if (!this.worldDirty || !this.world) {
        return; // Nothing to persist
      }

      await this.databaseLock.write(worldCtx, async () => {
        if (!this.db) throw new Error('Database not initialized');
        
        console.log('💾 Persisting world data to database...');
        const saveCallback = saveWorldToDb(this.db);
        await saveCallback(this.world!);
        
        this.worldDirty = false;
        console.log('✅ World data persisted to database');
      });
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
        await this.backgroundPersist();
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
    import('./battleScheduler').then(({ startBattleScheduler }) => {
      startBattleScheduler(1000); // Process battles every 1 second
    }).catch(error => {
      console.error('❌ Failed to start battle scheduler:', error);
    });
  }

  /**
   * Background persistence operation
   */
  private async backgroundPersist(): Promise<void> {
    const emptyCtx = createEmptyContext();
    
    // Persist dirty users
    if (this.dirtyUsers.size > 0) {
      console.log(`💾 Background persisting ${this.dirtyUsers.size} dirty user(s)`);
      await this.persistDirtyUsers(emptyCtx);
    }

    // Persist dirty world data
    if (this.worldDirty) {
      console.log('💾 Background persisting world data...');
      await this.persistDirtyWorld(emptyCtx);
    }
    
    // Note: Messages are persisted by MessageCache independently
  }

  /**
   * Shutdown the cache manager
   */
  async shutdown(): Promise<void> {
    const emptyCtx = createEmptyContext();
    
    await this.withCacheManagement(emptyCtx, async () => {
      console.log('🔄 Shutting down typed cache manager...');
      
      // Stop background persistence
      this.stopBackgroundPersistence();
      
      // Final persist of any dirty data
      if (this.dirtyUsers.size > 0) {
        console.log('💾 Final persist of dirty users before shutdown');
        await this.persistDirtyUsers(emptyCtx);
      }
      
      // Final persist of dirty world data before shutdown
      if (this.worldDirty) {
        console.log('💾 Final persist of world data before shutdown');
        await this.persistDirtyWorld(emptyCtx);
      }
      
      this.isInitialized = false;
      console.log('✅ Typed cache manager shutdown complete');
    });
  }
}

// Convenience function to get singleton instance
export function getTypedCacheManager(config?: TypedCacheConfig): TypedCacheManager {
  return TypedCacheManager.getInstance(config);
}

// Convenience functions for message operations (delegated to MessageCache)
export { sendMessageToUser as sendMessageToUserCached } from './MessageCache';
export { getUserMessages as getUserMessagesCached } from './MessageCache';
export { getUserMessageCount as getUserMessageCountCached } from './MessageCache';
