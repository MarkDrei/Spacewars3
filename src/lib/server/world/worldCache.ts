import { createLockContext, LOCK_11, LockContext, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';
import sqlite3 from 'sqlite3';
import { WORLD_LOCK } from '../typedLocks';
import { MessageCache } from '../messages/MessageCache';
import { World } from './world';
import { loadWorldFromDb, saveWorldToDb } from './worldRepo';
import { Cache } from '../Cache';

type WorldCacheDependencies = {
  messageCache?: MessageCache;
};

export interface WorldCacheConfig {
  persistenceIntervalMs: number;
  enableAutoPersistence: boolean;
  logStats: boolean;
}

export interface WorldCacheStats {
  worldCacheHits: number;
  worldCacheMisses: number;
  worldDirty: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var worldCacheInstance: WorldCache | null;
}

export class WorldCache extends Cache {
  private static dependencies: WorldCacheDependencies = {};
  private config: WorldCacheConfig = {
    persistenceIntervalMs: 30000,
    enableAutoPersistence: true,
    logStats: false,
  };

  private db: sqlite3.Database | null = null;
  private world: World | null = null;
  private worldDirty = false;
  private persistenceTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private stats = {
    worldCacheHits: 0,
    worldCacheMisses: 0,
  };

  private dependencies: WorldCacheDependencies = {};

  private constructor() {
    super();
    this.dependencies = WorldCache.dependencies;
    console.log('🌌 World cache manager created');
  }

  private static get instance(): WorldCache | null {
    return globalThis.worldCacheInstance || null;
  }

  private static set instance(value: WorldCache | null) {
    globalThis.worldCacheInstance = value;
  }

  static async initializeFromDb(db: sqlite3.Database, config?: Partial<WorldCacheConfig>): Promise<void> {
    WorldCache.instance?.stopBackgroundPersistence();
    const cache = new WorldCache();
    cache.applyConfig(config);
    cache.dependencies = WorldCache.dependencies;
    cache.db = db;
    cache.world = await loadWorldFromDb(db, async () => {
      cache.worldDirty = true;
    });
    cache.worldDirty = false;
    cache.stats.worldCacheMisses++;
    cache.isInitialized = true;
    cache.startBackgroundPersistence();
    WorldCache.instance = cache;
  }

  static initializeWithWorld(world: World, db: sqlite3.Database, config?: Partial<WorldCacheConfig>): void {
    WorldCache.instance?.stopBackgroundPersistence();
    const cache = new WorldCache();
    cache.applyConfig(config);
    cache.dependencies = WorldCache.dependencies;
    cache.db = db;
    cache.world = world;
    cache.worldDirty = false;
    cache.stats.worldCacheMisses++;
    cache.isInitialized = true;
    cache.startBackgroundPersistence();
    WorldCache.instance = cache;
  }

  static getInstance(): WorldCache {
    const cache = WorldCache.instance;
    if (!cache || !cache.isInitialized) {
      throw new Error('WorldCache not initialized');
    }
    return cache;
  }

  static resetInstance(): void {
    if (WorldCache.instance) {
      WorldCache.instance.stopBackgroundPersistence();
    }
    WorldCache.instance = null;
  }

  static configureDependencies(dependencies: WorldCacheDependencies): void {
    WorldCache.dependencies = dependencies;
    if (WorldCache.instance) {
      WorldCache.instance.dependencies = dependencies;
    }
  }

  getStats(): WorldCacheStats {
    this.ensureReady();
    return {
      worldCacheHits: this.stats.worldCacheHits,
      worldCacheMisses: this.stats.worldCacheMisses,
      worldDirty: this.worldDirty,
    };
  }

  getWorldFromCache(context: LockContext<LocksAtMostAndHas6>): World {
    this.ensureReady();
    if (!this.world) {
      throw new Error('World not loaded');
    }
    this.stats.worldCacheHits++;
    this.world.updatePhysics(context, Date.now());
    return this.world;
  }

  updateWorldUnsafe(_context: LockContext<LocksAtMostAndHas6>, world: World): void {
    this.ensureReady();
    this.world = world;
    this.worldDirty = true;
  }

  async flushToDatabase(): Promise<void> {
    this.ensureReady();
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldContext: LockContext<LocksAtMostAndHas6>) => {
      await this.persistDirtyWorld(worldContext);
    });
  }

  private async persistDirtyWorld(context: LockContext<LocksAtMostAndHas6>): Promise<void> {
    if (!this.worldDirty || !this.world) {
      return;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await context.useLockWithAcquire(LOCK_11, async () => {
      console.log('💾 Persisting world data to database...');
      const saveCallback = saveWorldToDb(this.db!);
      await saveCallback(this.world!);
      this.worldDirty = false;
      console.log('✅ World data persisted to database');
    });
  }

  private applyConfig(config?: Partial<WorldCacheConfig>): void {
    if (config) {
      this.config = {
        ...this.config,
        ...config,
      };
    }
  }

  private ensureReady(): void {
    if (!this.isInitialized) {
      throw new Error('WorldCache not initialized');
    }
  }

  private startBackgroundPersistence(): void {
    if (!this.config.enableAutoPersistence) {
      console.log('📝 World background persistence disabled by config');
      return;
    }

    console.log(`📝 Starting world background persistence (interval: ${this.config.persistenceIntervalMs}ms)`);

    this.persistenceTimer = setInterval(async () => {
      try {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(WORLD_LOCK, async (worldContext: LockContext<LocksAtMostAndHas6>) => {
          await this.backgroundPersist(worldContext);
        });
      } catch (error) {
        console.error('❌ World background persistence error:', error);
      }
    }, this.config.persistenceIntervalMs);
  }

  private stopBackgroundPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
      console.log('⏹️ World background persistence stopped');
    }
  }

  private async backgroundPersist(context: LockContext<LocksAtMostAndHas6>): Promise<void> {
    if (this.worldDirty) {
      console.log('💾 Background persisting world data...');
      await this.persistDirtyWorld(context);
    }
  }

  async shutdown(): Promise<void> {
    this.stopBackgroundPersistence();
    this.world = null;
    this.db = null;
    this.worldDirty = false;
    this.isInitialized = false;
  }
}

export function getWorldCache(): WorldCache {
  return WorldCache.getInstance();
}
