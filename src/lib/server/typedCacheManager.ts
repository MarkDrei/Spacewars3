// ---
// TypeScript Compile-Time Deadlock Prevention System
// Phase 2: Simplified Typed Cache Manager 
// ---

import { 
  TypedMutex, 
  TypedReadWriteLock, 
  type LockContext, 
  type EmptyContext, 
  type Locked,
  type CacheLevel,
  type WorldLevel,
  type UserLevel,
  type DatabaseLevel,
  createEmptyContext
} from './typedLocks';
import { User } from './user';
import { World } from './world';
import { getDatabase } from './database';
import { loadWorldFromDb } from './worldRepo';
import { getUserByIdFromDb } from './userRepo';
import sqlite3 from 'sqlite3';

// Type aliases for lock contexts to improve readability and avoid 'any'
// Type aliases for lock contexts to improve readability and avoid 'any'
type WorldReadContext = LockContext<Locked<'world:read'>, CacheLevel | WorldLevel>;
type WorldWriteContext = LockContext<Locked<'world:write'>, CacheLevel | WorldLevel>;
type UserContext = LockContext<Locked<'user'>, CacheLevel | WorldLevel | UserLevel>;
type DatabaseReadContext = LockContext<Locked<'database:read'>, CacheLevel | WorldLevel | UserLevel | DatabaseLevel>;
type DatabaseWriteContext = LockContext<Locked<'database:write'>, CacheLevel | WorldLevel | UserLevel | DatabaseLevel>;

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

  // Typed locks with explicit level assignment
  private cacheManagementLock = new TypedMutex('cache-mgmt', 0 as CacheLevel);
  private worldLock = new TypedReadWriteLock('world', 1 as WorldLevel);
  private userLock = new TypedMutex('user', 2 as UserLevel);
  private databaseLock = new TypedReadWriteLock('database', 3 as DatabaseLevel);

  // In-memory cache storage
  private users: Map<number, User> = new Map();
  private world: World | null = null;
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
   * Initialize the cache manager - must be called before use
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const emptyCtx = createEmptyContext();
    
    await this.cacheManagementLock.acquire(emptyCtx, async () => {
      if (this.isInitialized) {
        return; // Double-check inside lock
      }

      console.log('🚀 Initializing typed cache manager...');

      // Initialize database connection
      this.db = getDatabase();
      console.log('✅ Database connected');

      // Load world data
      await this.initializeWorld();
      console.log('✅ World data loaded');

      this.isInitialized = true;
      console.log('✅ Typed cache manager initialization complete');
    });
  }

  /**
   * Load world data from database into cache
   */
  private async initializeWorld(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const emptyCtx = createEmptyContext();
    
    await this.databaseLock.read(emptyCtx, async (dbCtx: DatabaseReadContext) => {
      await this.worldLock.write(dbCtx, async () => {
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

  // ===== LEVEL 0: CACHE MANAGEMENT OPERATIONS =====

  /**
   * Perform cache management operations with proper locking
   */
  async withCacheManagement<T>(
    context: EmptyContext,
    fn: (ctx: LockContext<Locked<'cache-mgmt'>, CacheLevel>) => Promise<T>
  ): Promise<T> {
    return await this.cacheManagementLock.acquire(context, fn);
  }

  // ===== LEVEL 1: WORLD OPERATIONS =====

  /**
   * Perform world read operations with proper locking
   */
  async withWorldRead<T>(
    context: LockContext<any, CacheLevel | never>,
    fn: (ctx: WorldReadContext) => Promise<T>
  ): Promise<T> {
    return await this.worldLock.read(context, fn);
  }

  /**
   * Perform world write operations with proper locking
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
   * Perform user operations with proper locking (single lock for ALL users)
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
    this.dirtyUsers.delete(user.id); // Fresh from DB, not dirty
    console.log(`👤 User ${user.id} cached in memory`);
  }

  /**
   * Update user data without acquiring locks (requires user lock context)
   */
  updateUserUnsafe(user: User, _context: UserAccessContext): void {
    this.users.set(user.id, user);
    this.dirtyUsers.add(user.id); // Mark as dirty for persistence
  }

  // ===== LEVEL 3: DATABASE OPERATIONS =====

  /**
   * Perform database read operations with proper locking
   */
  async withDatabaseRead<T>(
    context: LockContext<any, CacheLevel | WorldLevel | UserLevel | never>,
    fn: (ctx: DatabaseReadContext) => Promise<T>
  ): Promise<T> {
    return await this.databaseLock.read(context, fn);
  }

  /**
   * Perform database write operations with proper locking
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

  // ===== HIGH-LEVEL OPERATIONS WITH PROPER LOCK ORDERING =====

  /**
   * Load user from database if not in cache (proper lock ordering)
   */
  async loadUserIfNeeded(userId: number): Promise<User | null> {
    const emptyCtx = createEmptyContext();
    
    return await this.withUserLock(emptyCtx, async (userCtx: UserContext) => {
      let user = this.getUserUnsafe(userId, userCtx);
      if (user) {
        return user;
      }

      // Load from database
      return await this.withDatabaseRead(userCtx, async (dbCtx: DatabaseReadContext) => {
        console.log(`🔄 User ${userId} cache miss, loading from database...`);
        user = await this.loadUserFromDbUnsafe(userId, dbCtx);
        if (user) {
          this.setUserUnsafe(user, userCtx);
        }
        return user;
      });
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<TypedCacheStats> {
    const emptyCtx = createEmptyContext();
    
    return await this.withUserLock(emptyCtx, async (_userCtx: UserContext) => {
      return {
        userCacheSize: this.users.size,
        worldCacheHits: this.stats.worldCacheHits,
        worldCacheMisses: this.stats.worldCacheMisses,
        userCacheHits: this.stats.userCacheHits,
        userCacheMisses: this.stats.userCacheMisses,
        dirtyUsers: this.dirtyUsers.size,
        worldDirty: this.worldDirty
      };
    });
  }

  /**
   * Shutdown the cache manager
   */
  async shutdown(): Promise<void> {
    const emptyCtx = createEmptyContext();
    
    await this.withCacheManagement(emptyCtx, async () => {
      console.log('🔄 Shutting down typed cache manager...');
      this.isInitialized = false;
      console.log('✅ Typed cache manager shutdown complete');
    });
  }
}

// Convenience function to get singleton instance
export function getTypedCacheManager(config?: TypedCacheConfig): TypedCacheManager {
  return TypedCacheManager.getInstance(config);
}
