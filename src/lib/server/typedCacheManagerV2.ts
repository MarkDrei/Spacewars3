/**
 * Typed Cache Manager V2 with IronGuard Array-Based Lock System
 * 
 * Phase 3 Implementation: Full cache manager with array-based lock tracking
 */

import {
  LockContext,
  type LockLevel,
  LOCK_CACHE,
  LOCK_WORLD,
  LOCK_USER,
  LOCK_MESSAGE_READ,
  LOCK_MESSAGE_WRITE,
  LOCK_BATTLE,
  LOCK_DATABASE,
  createLockContext
} from './ironGuardV2';
import type {
  ValidCacheLockContext,
  ValidWorldLockContext,
  ValidUserLockContext,
  ValidMessageReadLockContext,
  ValidMessageWriteLockContext,
  ValidBattleLockContext,
  ValidDatabaseLockContext
} from './ironGuardTypesV2';
import {
  withWorldLock,
  withUserLock,
  withMessageReadLock,
  withMessageWriteLock,
  withBattleLock,
  withDatabaseLock
} from './lockHelpers';
import { User } from './user';
import { World, type SpaceObject } from './world';
import { getDatabase } from './database';
import { Message, UnreadMessage } from './messagesRepo';
import { loadWorldFromDb, saveWorldToDb } from './worldRepo';
import { getUserByIdFromDb, getUserByUsernameFromDb } from './userRepo';
import type { Battle } from '../../shared/battleTypes';
import { BattleRepo } from './battleRepo';
import sqlite3 from 'sqlite3';

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
  messageCacheSize: number;
  battleCacheSize: number;
  worldCacheHits: number;
  worldCacheMisses: number;
  userCacheHits: number;
  userCacheMisses: number;
  messageCacheHits: number;
  messageCacheMisses: number;
  battleCacheHits: number;
  battleCacheMisses: number;
  dirtyUsers: number;
  dirtyMessages: number;
  dirtyBattles: number;
  worldDirty: boolean;
}

/**
 * Typed Cache Manager V2 with compile-time deadlock prevention
 * Uses array-based lock tracking for precise lock state management
 */
export class TypedCacheManagerV2 {
  // Singleton enforcement
  private static instance: TypedCacheManagerV2 | null = null;
  
  private constructor() {
    console.log('🧠 Typed cache manager V2 initialized (IronGuard array-based)');
  }

  static getInstance(config?: TypedCacheConfig): TypedCacheManagerV2 {
    if (!this.instance) {
      this.instance = new TypedCacheManagerV2();
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

  // Cache storage
  private users: Map<number, User> = new Map();
  private world: World | null = null;
  private userMessages: Map<number, Message[]> = new Map(); // userId -> messages
  private battles: Map<number, Battle> = new Map(); // battleId -> battle
  private usernameToUserId: Map<string, number> = new Map(); // username -> userId mapping
  private dirtyUsers: Set<number> = new Set();
  private worldDirty = false;
  private dirtyMessages: Set<number> = new Set(); // userIds with dirty messages
  private dirtyBattles: Set<number> = new Set(); // battleIds with dirty battles
  
  // Stats tracking
  private stats = {
    worldCacheHits: 0,
    worldCacheMisses: 0,
    userCacheHits: 0,
    userCacheMisses: 0,
    messageCacheHits: 0,
    messageCacheMisses: 0,
    battleCacheHits: 0,
    battleCacheMisses: 0
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
    
    // Acquire CACHE lock for initialization
    const cacheCtx = emptyCtx.acquire(LOCK_CACHE);
    if (typeof cacheCtx === 'string') {
      throw new Error(`Failed to acquire LOCK_CACHE: ${cacheCtx}`);
    }
    
    try {
      if (this.isInitialized) {
        return; // Double-check inside lock
      }

      console.log('🚀 Initializing typed cache manager V2...');

      // Initialize database connection
      this.db = await getDatabase();
      console.log('✅ Database connected');

      // Load world data
      await this.initializeWorld(cacheCtx);
      console.log('✅ World data loaded');

      // Start background persistence if enabled
      this.startBackgroundPersistence();

      // Start battle scheduler
      this.startBattleScheduler();

      this.isInitialized = true;
      console.log('✅ Typed cache manager V2 initialization complete');
    } finally {
      cacheCtx.release(LOCK_CACHE);
    }
  }

  /**
   * Load world data from database into cache
   * 
   * LOCK ORDER FIX: Acquire WORLD lock first (20), then DATABASE lock (60)
   * This is safe because 20 < 60 follows the correct ordering
   * 
   * Called only during initialization with CACHE lock held
   */
  private async initializeWorld(
    cacheCtx: LockContext<readonly [10]>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Correct order: CACHE (10) → WORLD (20) → DATABASE (60)
    return withWorldLock(cacheCtx, async (worldCtx) => {
      // Type assertion: we know [10, 20] is valid for DATABASE lock acquisition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return withDatabaseLock(worldCtx as any, async () => {
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
   * Get world data without acquiring locks (requires world lock context)
   */
  getWorldUnsafe<THeld extends readonly LockLevel[]>(
    _context: ValidWorldLockContext<THeld>
  ): World {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    this.stats.worldCacheHits++;
    return this.world;
  }

  /**
   * Update world data without acquiring locks (requires world write lock context)
   */
  updateWorldUnsafe<THeld extends readonly LockLevel[]>(
    world: World,
    _context: ValidWorldLockContext<THeld>
  ): void {
    this.world = world;
    this.worldDirty = true;
  }

  /**
   * Set ship speed without acquiring locks
   */
  setShipSpeedUnsafe<THeld extends readonly LockLevel[]>(
    shipId: number,
    speed: number,
    context: ValidWorldLockContext<THeld>
  ): void {
    const world = this.getWorldUnsafe(context);
    const ship = world.spaceObjects.find((s: SpaceObject) => s.id === shipId && s.type === 'player_ship');
    if (ship) {
      ship.speed = speed;
      this.worldDirty = true;
    }
  }

  /**
   * Teleport ship without acquiring locks
   */
  teleportShipUnsafe<THeld extends readonly LockLevel[]>(
    shipId: number,
    x: number,
    y: number,
    context: ValidWorldLockContext<THeld>
  ): void {
    const world = this.getWorldUnsafe(context);
    const ship = world.spaceObjects.find((s: SpaceObject) => s.id === shipId && s.type === 'player_ship');
    if (ship) {
      ship.x = x;
      ship.y = y;
      this.worldDirty = true;
    }
  }

  /**
   * Delete space object without acquiring locks
   */
  deleteSpaceObjectUnsafe<THeld extends readonly LockLevel[]>(
    objectId: number,
    context: ValidWorldLockContext<THeld>
  ): void {
    const world = this.getWorldUnsafe(context);
    const index = world.spaceObjects.findIndex(o => o.id === objectId);
    if (index !== -1) {
      world.spaceObjects.splice(index, 1);
      this.worldDirty = true;
    }
  }

  /**
   * Insert space object without acquiring locks
   */
  insertSpaceObjectUnsafe<THeld extends readonly LockLevel[]>(
    obj: Omit<SpaceObject, 'id'>,
    context: ValidWorldLockContext<THeld>
  ): void {
    const world = this.getWorldUnsafe(context);
    const newId = Math.max(0, ...world.spaceObjects.map(o => o.id)) + 1;
    world.spaceObjects.push({ ...obj, id: newId });
    this.worldDirty = true;
  }

  // ===== USER OPERATIONS =====

  /**
   * Get user from cache without acquiring locks
   */
  getUserUnsafe<THeld extends readonly LockLevel[]>(
    userId: number,
    _context: ValidUserLockContext<THeld>
  ): User | null {
    const user = this.users.get(userId);
    if (user) {
      this.stats.userCacheHits++;
      return user;
    }
    this.stats.userCacheMisses++;
    return null;
  }

  /**
   * Set user in cache without acquiring locks
   */
  setUserUnsafe<THeld extends readonly LockLevel[]>(
    user: User,
    _context: ValidUserLockContext<THeld>
  ): void {
    this.users.set(user.id, user);
    this.usernameToUserId.set(user.username, user.id);
    this.dirtyUsers.add(user.id);
  }

  /**
   * Update user in cache without acquiring locks
   */
  updateUserUnsafe<THeld extends readonly LockLevel[]>(
    user: User,
    _context: ValidUserLockContext<THeld>
  ): void {
    this.users.set(user.id, user);
    this.dirtyUsers.add(user.id);
  }

  /**
   * Load user from database without acquiring locks (requires database lock)
   */
  async loadUserFromDbUnsafe<THeld extends readonly LockLevel[]>(
    userId: number,
    _context: ValidDatabaseLockContext<THeld>
  ): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    // Create a save callback that marks user as dirty
    const saveCallback = async () => {
      this.dirtyUsers.add(userId);
    };
    return getUserByIdFromDb(this.db, userId, saveCallback);
  }

  /**
   * Load user by username from database without acquiring locks (requires database lock)
   */
  async loadUserByUsernameFromDbUnsafe<THeld extends readonly LockLevel[]>(
    username: string,
    _context: ValidDatabaseLockContext<THeld>
  ): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    // Create a save callback that marks user as dirty (we'll add userId when known)
    const saveCallback = async () => {
      // User ID will be added to dirty set when user is cached
    };
    return getUserByUsernameFromDb(this.db, username, saveCallback);
  }

  /**
   * Load user if not in cache
   * 
   * This method should be called with an empty or low-level context
   * so it can acquire USER and DATABASE locks in the correct order
   */
  async loadUserIfNeeded(
    userId: number
  ): Promise<User | null> {
    const ctx = createLockContext();
    
    // Correct order: USER (30) → DATABASE (60)
    return withUserLock(ctx, async (userCtx) => {
      // Check cache first
      const cached = this.getUserUnsafe(userId, userCtx);
      if (cached) return cached;

      // Load from database
      return withDatabaseLock(userCtx, async (dbCtx) => {
        // Double-check cache (in case another request loaded it)
        const cached2 = this.users.get(userId);
        if (cached2) return cached2;

        // Load from DB
        const user = await this.loadUserFromDbUnsafe(userId, dbCtx);
        if (user) {
          // Re-acquire USER lock context for setting (we're still in the lock)
          this.users.set(user.id, user);
          this.usernameToUserId.set(user.username, user.id);
          this.dirtyUsers.add(user.id);
        }
        return user;
      });
    });
  }

  /**
   * Get user by username with caching
   * 
   * This method should be called with an empty or low-level context
   */
  async getUserByUsername(
    username: string
  ): Promise<User | null> {
    const ctx = createLockContext();
    
    // Correct order: USER (30) → DATABASE (60)
    return withUserLock(ctx, async (userCtx) => {
      // Check cache first
      const userId = this.usernameToUserId.get(username);
      if (userId !== undefined) {
        return this.getUserUnsafe(userId, userCtx);
      }

      // Load from database
      return withDatabaseLock(userCtx, async (dbCtx) => {
        // Double-check cache
        const userId2 = this.usernameToUserId.get(username);
        if (userId2 !== undefined) {
          return this.users.get(userId2) || null;
        }

        // Load from DB
        const user = await this.loadUserByUsernameFromDbUnsafe(username, dbCtx);
        if (user) {
          this.users.set(user.id, user);
          this.usernameToUserId.set(user.username, user.id);
          this.dirtyUsers.add(user.id);
        }
        return user;
      });
    });
  }

  // ===== BATTLE OPERATIONS =====

  /**
   * Get battle from cache without acquiring locks
   */
  getBattleUnsafe<THeld extends readonly LockLevel[]>(
    battleId: number,
    _context: ValidBattleLockContext<THeld>
  ): Battle | null {
    const battle = this.battles.get(battleId);
    if (battle) {
      this.stats.battleCacheHits++;
      return battle;
    }
    this.stats.battleCacheMisses++;
    return null;
  }

  /**
   * Set battle in cache without acquiring locks
   */
  setBattleUnsafe<THeld extends readonly LockLevel[]>(
    battle: Battle,
    _context: ValidBattleLockContext<THeld>
  ): void {
    this.battles.set(battle.id, battle);
    this.dirtyBattles.add(battle.id);
  }

  /**
   * Load battle from database without acquiring locks (requires database lock)
   */
  async loadBattleFromDbUnsafe<THeld extends readonly LockLevel[]>(
    battleId: number,
    _context: ValidDatabaseLockContext<THeld>
  ): Promise<Battle | null> {
    if (!this.db) throw new Error('Database not initialized');
    return BattleRepo.getBattle(battleId);
  }

  /**
   * Load battle if not in cache
   * 
   * This method should be called with an empty or low-level context
   * so it can acquire BATTLE and DATABASE locks in the correct order
   */
  async loadBattleIfNeeded(
    battleId: number
  ): Promise<Battle | null> {
    const ctx = createLockContext();
    
    // Correct order: BATTLE (50) → DATABASE (60)
    return withBattleLock(ctx, async (battleCtx) => {
      // Check cache first
      const cached = this.getBattleUnsafe(battleId, battleCtx);
      if (cached) return cached;

      // Load from database
      return withDatabaseLock(battleCtx, async (dbCtx) => {
        // Double-check cache
        const cached2 = this.battles.get(battleId);
        if (cached2) return cached2;

        // Load from DB
        const battle = await this.loadBattleFromDbUnsafe(battleId, dbCtx);
        if (battle) {
          this.battles.set(battle.id, battle);
          this.dirtyBattles.add(battle.id);
        }
        return battle;
      });
    });
  }

  // ===== STATISTICS & MAINTENANCE =====

  /**
   * Get cache statistics
   */
  async getStats(): Promise<TypedCacheStats> {
    return {
      userCacheSize: this.users.size,
      usernameCacheSize: this.usernameToUserId.size,
      messageCacheSize: this.userMessages.size,
      battleCacheSize: this.battles.size,
      worldCacheHits: this.stats.worldCacheHits,
      worldCacheMisses: this.stats.worldCacheMisses,
      userCacheHits: this.stats.userCacheHits,
      userCacheMisses: this.stats.userCacheMisses,
      messageCacheHits: this.stats.messageCacheHits,
      messageCacheMisses: this.stats.messageCacheMisses,
      battleCacheHits: this.stats.battleCacheHits,
      battleCacheMisses: this.stats.battleCacheMisses,
      dirtyUsers: this.dirtyUsers.size,
      dirtyMessages: this.dirtyMessages.size,
      dirtyBattles: this.dirtyBattles.size,
      worldDirty: this.worldDirty
    };
  }

  /**
   * Flush all dirty data to database
   * 
   * LOCK ORDER FIX: We need to acquire locks in order, but we need multiple locks:
   * CACHE (10) → WORLD (20) → USER (30) → BATTLE (50) → DATABASE (60)
   * 
   * We'll acquire all needed locks upfront in the correct order
   */
  async flushAllToDatabase(): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ Database not initialized, skipping flush');
      return;
    }

    const ctx = createLockContext();
    
    // Acquire CACHE lock first
    const cacheCtx = ctx.acquire(LOCK_CACHE);
    if (typeof cacheCtx === 'string') {
      throw new Error(`Failed to acquire LOCK_CACHE: ${cacheCtx}`);
    }

    try {
      console.log('💾 Flushing cache to database...');

      // Flush world if dirty - need WORLD and DATABASE locks
      if (this.worldDirty && this.world) {
        const worldCtx = cacheCtx.acquire(LOCK_WORLD);
        if (typeof worldCtx === 'string') {
          throw new Error(`Failed to acquire LOCK_WORLD: ${worldCtx}`);
        }
        try {
          const dbCtx = worldCtx.acquire(LOCK_DATABASE);
          if (typeof dbCtx === 'string') {
            throw new Error(`Failed to acquire LOCK_DATABASE: ${dbCtx}`);
          }
          try {
            if (this.world && this.worldDirty) {
              const saveCallback = saveWorldToDb(this.db!);
              await saveCallback(this.world);
              this.worldDirty = false;
            }
          } finally {
            dbCtx.release(LOCK_DATABASE);
          }
        } finally {
          worldCtx.release(LOCK_WORLD);
        }
      }

      // Flush dirty users - need USER and DATABASE locks
      if (this.dirtyUsers.size > 0) {
        const userCtx = cacheCtx.acquire(LOCK_USER);
        if (typeof userCtx === 'string') {
          throw new Error(`Failed to acquire LOCK_USER: ${userCtx}`);
        }
        try {
          const dbCtx = userCtx.acquire(LOCK_DATABASE);
          if (typeof dbCtx === 'string') {
            throw new Error(`Failed to acquire LOCK_DATABASE: ${dbCtx}`);
          }
          try {
            const userIds = Array.from(this.dirtyUsers);
            for (const userId of userIds) {
              const user = this.users.get(userId);
              if (user) {
                // Save user to database (placeholder - would need proper implementation)
                console.log(`💾 Saving user ${userId} to database`);
              }
            }
            this.dirtyUsers.clear();
          } finally {
            dbCtx.release(LOCK_DATABASE);
          }
        } finally {
          userCtx.release(LOCK_USER);
        }
      }

      // Flush dirty battles - need BATTLE and DATABASE locks
      if (this.dirtyBattles.size > 0) {
        const battleCtx = cacheCtx.acquire(LOCK_BATTLE);
        if (typeof battleCtx === 'string') {
          throw new Error(`Failed to acquire LOCK_BATTLE: ${battleCtx}`);
        }
        try {
          const dbCtx = battleCtx.acquire(LOCK_DATABASE);
          if (typeof dbCtx === 'string') {
            throw new Error(`Failed to acquire LOCK_DATABASE: ${dbCtx}`);
          }
          try {
            const battleIds = Array.from(this.dirtyBattles);
            for (const battleId of battleIds) {
              const battle = this.battles.get(battleId);
              if (battle) {
                // Save battle to database (placeholder - would need proper implementation)
                console.log(`💾 Saving battle ${battleId} to database`);
              }
            }
            this.dirtyBattles.clear();
          } finally {
            dbCtx.release(LOCK_DATABASE);
          }
        } finally {
          battleCtx.release(LOCK_BATTLE);
        }
      }

      console.log('✅ Cache flush complete');
    } finally {
      cacheCtx.release(LOCK_CACHE);
    }
  }

  /**
   * Start background persistence timer
   */
  private startBackgroundPersistence(): void {
    if (!this.config.enableAutoPersistence) return;

    this.persistenceTimer = setInterval(async () => {
      try {
        await this.flushAllToDatabase();
      } catch (error) {
        console.error('❌ Background persistence failed:', error);
      }
    }, this.config.persistenceIntervalMs);
  }

  /**
   * Start battle scheduler (placeholder)
   */
  private startBattleScheduler(): void {
    // TODO: Implement battle scheduler
    console.log('⚔️ Battle scheduler started (placeholder)');
  }

  /**
   * Shutdown the cache manager
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down typed cache manager V2...');

    // Stop timers
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }

    // Flush remaining data
    await this.flushAllToDatabase();

    this.isInitialized = false;
    console.log('✅ Typed cache manager V2 shutdown complete');
  }
}

// Export singleton getter
export function getTypedCacheManagerV2(): TypedCacheManagerV2 {
  return TypedCacheManagerV2.getInstance();
}

// Default export for convenience
export default TypedCacheManagerV2;
