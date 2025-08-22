// ---
// High-level cache operations and persistence management
// ---

import { getMemoryCache, MemoryCache } from './memoryCache';
import { getLockManager, LockManager } from './locks';
import { loadWorldFromDb, saveWorldToDb } from './worldRepo';
import { getUserByIdFromDb, saveUserToDb } from './userRepo';
import { getDatabase } from './database';
import { World, SaveWorldCallback } from './world';
import { User, SaveUserCallback } from './user';
import sqlite3 from 'sqlite3';

export interface CacheManagerConfig {
  persistenceIntervalMs: number;
  enableAutoPersistence: boolean;
  logStats: boolean;
}

export class CacheManager {
  private cache: MemoryCache;
  private lockManager: LockManager;
  private db: sqlite3.Database;
  private config: CacheManagerConfig;
  private persistenceTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isShuttingDown = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: Partial<CacheManagerConfig> = {}) {
    this.cache = getMemoryCache();
    this.lockManager = getLockManager();
    this.db = getDatabase();
    
    this.config = {
      persistenceIntervalMs: config.persistenceIntervalMs ?? 30000, // 30 seconds default
      enableAutoPersistence: config.enableAutoPersistence ?? true,
      logStats: config.logStats ?? false
    };

    console.log('📋 Cache manager initialized with config:', this.config);
  }

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized) {
      console.log('⚠️ Cache manager already initialized');
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.initializationPromise) {
      console.log('⏳ Cache manager initialization in progress, waiting...');
      return await this.initializationPromise;
    }

    // Start initialization
    console.log('🚀 Initializing cache manager...');
    
    this.initializationPromise = this.doInitialization();
    await this.initializationPromise;
  }

  private async doInitialization(): Promise<void> {
    try {
      // Initialize world cache
      await this.initializeWorldCache();

      // Start auto-persistence if enabled
      if (this.config.enableAutoPersistence) {
        this.startAutoPersistence();
      }

      this.isInitialized = true;
      console.log('✅ Cache manager initialization complete');
    } catch (error) {
      // Reset the initialization promise on failure so it can be retried
      this.initializationPromise = null;
      throw error;
    } finally {
      // Clear the initialization promise on completion (success or failure)
      this.initializationPromise = null;
    }
  }

  private async initializeWorldCache(): Promise<void> {
    try {
      console.log('🌍 Loading world data into cache...');
      const world = await loadWorldFromDb(this.db, this.createWorldSaveCallback());
      await this.cache.setWorld(world);
      console.log('✅ World data cached successfully');
    } catch (error) {
      console.error('❌ Failed to initialize world cache:', error);
      throw error;
    }
  }

  // World operations
  async getWorld(): Promise<World> {
    const world = await this.cache.getWorld();
    if (!world) {
      console.log('🔄 World cache miss, loading from database...');
      const freshWorld = await loadWorldFromDb(this.db, this.createWorldSaveCallback());
      await this.cache.setWorld(freshWorld);
      return freshWorld;
    }
    return world;
  }

  async updateWorld(world: World): Promise<void> {
    await this.cache.updateWorld(world);
  }

  // User operations
  async getUser(userId: number): Promise<User | null> {
    let user = await this.cache.getUser(userId);
    if (!user) {
      console.log(`🔄 User ${userId} cache miss, loading from database...`);
      user = await getUserByIdFromDb(this.db, userId, this.createUserSaveCallback());
      if (user) {
        await this.cache.setUser(user);
      }
    }
    return user;
  }

  async updateUser(user: User): Promise<void> {
    await this.cache.updateUser(user);
  }

  // Lock access for external operations
  getWorldLock() {
    return this.cache.getWorldLock();
  }

  async getUserMutex(userId: number) {
    return await this.cache.getUserMutex(userId);
  }

  // Persistence operations
  async persistDirtyData(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⏹️ Skipping persistence during shutdown');
      return;
    }

    await this.internalPersistDirtyData();
  }

  private async internalPersistDirtyData(): Promise<void> {

    try {
      const startTime = Date.now();
      let persistedUsers = 0;
      let persistedWorld = false;

      // Persist dirty world
      if (await this.cache.isWorldDirty()) {
        const world = await this.cache.getWorld();
        if (world) {
          const worldSaveCallback = saveWorldToDb(this.db);
          await worldSaveCallback(world);
          await this.cache.markWorldClean();
          persistedWorld = true;
        }
      }

      // Persist dirty users
      const dirtyUsers = await this.cache.getAllDirtyUsers();
      for (const user of dirtyUsers) {
        const userSaveCallback = saveUserToDb(this.db);
        await userSaveCallback(user);
        await this.cache.markUserClean(user.id);
        persistedUsers++;
      }

      const duration = Date.now() - startTime;
      if (persistedUsers > 0 || persistedWorld) {
        console.log(`💾 Persisted ${persistedUsers} users, world: ${persistedWorld} (${duration}ms)`);
      } else if (this.config.logStats) {
        console.log(`💾 No dirty data to persist (${duration}ms)`);
      }
    } catch (error) {
      console.error('❌ Failed to persist dirty data:', error);
      // Don't throw - let auto-persistence continue
    }
  }

  private startAutoPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }

    this.persistenceTimer = setInterval(async () => {
      await this.persistDirtyData();
      
      if (this.config.logStats) {
        const stats = await this.cache.getStats();
        console.log('📊 Cache stats:', stats);
      }
    }, this.config.persistenceIntervalMs);

    console.log(`⏰ Auto-persistence started (${this.config.persistenceIntervalMs}ms interval)`);
  }

  private stopAutoPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
      console.log('⏹️ Auto-persistence stopped');
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.log('⚠️ Cache manager not initialized, nothing to shutdown');
      return;
    }

    console.log('🛑 Shutting down cache manager...');
    this.isShuttingDown = true;

    // Stop auto-persistence
    this.stopAutoPersistence();

    // Final persistence of dirty data
    console.log('💾 Final persistence of dirty data...');
    await this.internalPersistDirtyData();

    // Clear cache
    await this.cache.clearCache();

    // Cleanup locks
    await this.lockManager.cleanup();

    this.isInitialized = false;
    this.isShuttingDown = false;
    console.log('✅ Cache manager shutdown complete');
  }

  // Statistics and monitoring
  async getStats() {
    const cacheStats = await this.cache.getStats();
    const lockStats = await this.lockManager.getLockStats();
    
    return {
      cache: cacheStats,
      locks: lockStats,
      initialized: this.isInitialized,
      shuttingDown: this.isShuttingDown,
      autoPersistence: !!this.persistenceTimer
    };
  }

  // Callback factories for domain objects
  private createWorldSaveCallback(): SaveWorldCallback {
    return async (world: World) => {
      await this.cache.updateWorld(world);
    };
  }

  private createUserSaveCallback(): SaveUserCallback {
    return async (user: User) => {
      await this.cache.updateUser(user);
    };
  }

  // Force operations (for testing/admin)
  async forceRefreshWorld(): Promise<void> {
    console.log('🔄 Force refreshing world cache...');
    const world = await loadWorldFromDb(this.db, this.createWorldSaveCallback());
    await this.cache.setWorld(world);
  }

  async forceRefreshUser(userId: number): Promise<void> {
    console.log(`🔄 Force refreshing user ${userId} cache...`);
    const user = await getUserByIdFromDb(this.db, userId, this.createUserSaveCallback());
    if (user) {
      await this.cache.setUser(user);
    }
  }
}

// Singleton instance
let cacheManager: CacheManager | null = null;

export function getCacheManager(config?: Partial<CacheManagerConfig>): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager(config);
  }
  return cacheManager;
}

export function resetCacheManager(): void {
  cacheManager = null;
}
