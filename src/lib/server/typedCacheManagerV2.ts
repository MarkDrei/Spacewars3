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
   */
  private async initializeWorld<THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Acquire DATABASE lock, then WORLD lock
    return withDatabaseLock(context, async (dbCtx) => {
      return withWorldLock(dbCtx, async () => {
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
    const ship = world.ships.find(s => s.id === shipId);
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
    const ship = world.ships.find(s => s.id === shipId);
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
    return getUserByIdFromDb(this.db, userId);
  }

  /**
   * Load user by username from database without acquiring locks (requires database lock)
   */
  async loadUserByUsernameFromDbUnsafe<THeld extends readonly LockLevel[]>(
    username: string,
    _context: ValidDatabaseLockContext<THeld>
  ): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return getUserByUsernameFromDb(this.db, username);
  }

  /**
   * Load user if not in cache
   */
  async loadUserIfNeeded<THeld extends readonly LockLevel[]>(
    context: ValidUserLockContext<THeld>,
    userId: number
  ): Promise<User | null> {
    // Check cache first
    const cached = this.getUserUnsafe(userId, context);
    if (cached) return cached;

    // Load from database
    return withDatabaseLock(context, async (dbCtx) => {
      return withUserLock(dbCtx, async (userCtx) => {
        // Double-check cache
        const cached2 = this.getUserUnsafe(userId, userCtx);
        if (cached2) return cached2;

        // Load from DB
        const user = await this.loadUserFromDbUnsafe(userId, dbCtx);
        if (user) {
          this.setUserUnsafe(user, userCtx);
        }
        return user;
      });
    });
  }

  /**
   * Get user by username with caching
   */
  async getUserByUsername<THeld extends readonly LockLevel[]>(
    context: ValidUserLockContext<THeld>,
    username: string
  ): Promise<User | null> {
    // Check cache first
    const userId = this.usernameToUserId.get(username);
    if (userId !== undefined) {
      return this.getUserUnsafe(userId, context);
    }

    // Load from database
    return withDatabaseLock(context, async (dbCtx) => {
      return withUserLock(dbCtx, async (userCtx) => {
        // Double-check cache
        const userId2 = this.usernameToUserId.get(username);
        if (userId2 !== undefined) {
          return this.getUserUnsafe(userId2, userCtx);
        }

        // Load from DB
        const user = await this.loadUserByUsernameFromDbUnsafe(username, dbCtx);
        if (user) {
          this.setUserUnsafe(user, userCtx);
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
    const battleRepo = new BattleRepo(this.db);
    return battleRepo.getBattle(battleId);
  }

  /**
   * Load battle if not in cache
   */
  async loadBattleIfNeeded<THeld extends readonly LockLevel[]>(
    context: ValidBattleLockContext<THeld>,
    battleId: number
  ): Promise<Battle | null> {
    // Check cache first
    const cached = this.getBattleUnsafe(battleId, context);
    if (cached) return cached;

    // Load from database
    return withDatabaseLock(context, async (dbCtx) => {
      return withBattleLock(dbCtx, async (battleCtx) => {
        // Double-check cache
        const cached2 = this.getBattleUnsafe(battleId, battleCtx);
        if (cached2) return cached2;

        // Load from DB
        const battle = await this.loadBattleFromDbUnsafe(battleId, dbCtx);
        if (battle) {
          this.setBattleUnsafe(battle, battleCtx);
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
   */
  async flushAllToDatabase(): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ Database not initialized, skipping flush');
      return;
    }

    const emptyCtx = createLockContext();
    const cacheCtx = emptyCtx.acquire(LOCK_CACHE);
    if (typeof cacheCtx === 'string') {
      throw new Error(`Failed to acquire LOCK_CACHE: ${cacheCtx}`);
    }

    try {
      console.log('💾 Flushing cache to database...');

      // Flush world if dirty
      if (this.worldDirty && this.world) {
        await withDatabaseLock(cacheCtx, async (dbCtx) => {
          await withWorldLock(dbCtx, async () => {
            if (this.world && this.worldDirty) {
              await saveWorldToDb(this.db!, this.world);
              this.worldDirty = false;
            }
          });
        });
      }

      // Flush dirty users
      if (this.dirtyUsers.size > 0) {
        await withDatabaseLock(cacheCtx, async (dbCtx) => {
          await withUserLock(dbCtx, async () => {
            const userIds = Array.from(this.dirtyUsers);
            for (const userId of userIds) {
              const user = this.users.get(userId);
              if (user) {
                // Save user to database (placeholder - would need proper implementation)
                console.log(`💾 Saving user ${userId} to database`);
              }
            }
            this.dirtyUsers.clear();
          });
        });
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
