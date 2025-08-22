// ---
// Central in-memory data store for users and world data
// ---

import { User } from './user';
import { World } from './world';
import { ReadWriteLock, Mutex } from './locks';

export interface CacheStats {
  userCacheSize: number;
  worldCacheHits: number;
  worldCacheMisses: number;
  userCacheHits: number;
  userCacheMisses: number;
  dirtyUsers: number;
  worldDirty: boolean;
}

export class MemoryCache {
  private users: Map<number, User> = new Map();
  private world: World | null = null;
  private dirtyUsers: Set<number> = new Set();
  private worldDirty: boolean = false;
  
  // Locking mechanisms
  private worldLock: ReadWriteLock = new ReadWriteLock();
  private userLocks: Map<number, Mutex> = new Map();
  private globalUserLock: Mutex = new Mutex(); // For user cache operations
  
  // Statistics
  private stats = {
    worldCacheHits: 0,
    worldCacheMisses: 0,
    userCacheHits: 0,
    userCacheMisses: 0
  };

  constructor() {
    console.log('🧠 Memory cache initialized');
  }

  // World cache operations
  async getWorld(): Promise<World | null> {
    return await this.worldLock.read(async () => {
      if (this.world) {
        this.stats.worldCacheHits++;
        return this.world;
      } else {
        this.stats.worldCacheMisses++;
        return null;
      }
    });
  }

  async setWorld(world: World): Promise<void> {
    await this.worldLock.write(async () => {
      this.world = world;
      this.worldDirty = false; // Fresh from DB, not dirty
      console.log('🌍 World cached in memory');
    });
  }

  async updateWorld(world: World): Promise<void> {
    await this.worldLock.write(async () => {
      this.world = world;
      this.worldDirty = true; // Mark as dirty for persistence
    });
  }

  async isWorldDirty(): Promise<boolean> {
    return await this.worldLock.read(async () => this.worldDirty);
  }

  async markWorldClean(): Promise<void> {
    await this.worldLock.write(async () => {
      this.worldDirty = false;
    });
  }

  // User cache operations
  async getUser(userId: number): Promise<User | null> {
    // Get or create user-specific lock
    const userLock = await this.getUserLock(userId);
    
    return await userLock.acquire(async () => {
      const user = this.users.get(userId);
      if (user) {
        this.stats.userCacheHits++;
        return user;
      } else {
        this.stats.userCacheMisses++;
        return null;
      }
    });
  }

  async setUser(user: User): Promise<void> {
    const userLock = await this.getUserLock(user.id);
    
    await userLock.acquire(async () => {
      this.users.set(user.id, user);
      this.dirtyUsers.delete(user.id); // Fresh from DB, not dirty
      console.log(`👤 User ${user.id} cached in memory`);
    });
  }

  async updateUser(user: User): Promise<void> {
    const userLock = await this.getUserLock(user.id);
    
    await userLock.acquire(async () => {
      this.users.set(user.id, user);
      this.dirtyUsers.add(user.id); // Mark as dirty for persistence
    });
  }

  async isDirtyUser(userId: number): Promise<boolean> {
    return await this.globalUserLock.acquire(async () => {
      return this.dirtyUsers.has(userId);
    });
  }

  async markUserClean(userId: number): Promise<void> {
    await this.globalUserLock.acquire(async () => {
      this.dirtyUsers.delete(userId);
    });
  }

  async getAllDirtyUsers(): Promise<User[]> {
    return await this.globalUserLock.acquire(async () => {
      const dirtyUsers: User[] = [];
      for (const userId of this.dirtyUsers) {
        const user = this.users.get(userId);
        if (user) {
          dirtyUsers.push(user);
        }
      }
      return dirtyUsers;
    });
  }

  // Lock management
  private async getUserLock(userId: number): Promise<Mutex> {
    return await this.globalUserLock.acquire(async () => {
      let lock = this.userLocks.get(userId);
      if (!lock) {
        lock = new Mutex();
        this.userLocks.set(userId, lock);
      }
      return lock;
    });
  }

  // Cache statistics and management
  async getStats(): Promise<CacheStats> {
    return await this.globalUserLock.acquire(async () => {
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

  async clearCache(): Promise<void> {
    await this.worldLock.write(async () => {
      this.world = null;
      this.worldDirty = false;
    });

    await this.globalUserLock.acquire(async () => {
      this.users.clear();
      this.dirtyUsers.clear();
      this.userLocks.clear();
    });

    console.log('🧹 Memory cache cleared');
  }

  // Get locks for external operations (e.g., collection race condition prevention)
  getWorldLock(): ReadWriteLock {
    return this.worldLock;
  }

  async getUserMutex(userId: number): Promise<Mutex> {
    return await this.getUserLock(userId);
  }
}

// Singleton instance
let memoryCache: MemoryCache | null = null;

export function getMemoryCache(): MemoryCache {
  if (!memoryCache) {
    memoryCache = new MemoryCache();
  }
  return memoryCache;
}

export function resetMemoryCache(): void {
  memoryCache = null;
}
