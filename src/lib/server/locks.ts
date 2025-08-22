// ---
// Concurrency control utilities for safe in-memory data access
// ---

export class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runLocked = async () => {
        try {
          const result = await fn();
          this.release();
          resolve(result);
        } catch (error) {
          this.release();
          reject(error);
        }
      };

      if (this.locked) {
        this.queue.push(runLocked);
      } else {
        this.locked = true;
        runLocked();
      }
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export class ReadWriteLock {
  private readers = 0;
  private writer = false;
  private readQueue: Array<() => void> = [];
  private writeQueue: Array<() => void> = [];

  async read<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runRead = async () => {
        this.readers++;
        try {
          const result = await fn();
          this.readers--;
          this.checkQueues();
          resolve(result);
        } catch (error) {
          this.readers--;
          this.checkQueues();
          reject(error);
        }
      };

      if (this.writer || this.writeQueue.length > 0) {
        this.readQueue.push(runRead);
      } else {
        runRead();
      }
    });
  }

  async write<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runWrite = async () => {
        this.writer = true;
        try {
          const result = await fn();
          this.writer = false;
          this.checkQueues();
          resolve(result);
        } catch (error) {
          this.writer = false;
          this.checkQueues();
          reject(error);
        }
      };

      if (this.writer || this.readers > 0) {
        this.writeQueue.push(runWrite);
      } else {
        runWrite();
      }
    });
  }

  private checkQueues(): void {
    // Process write queue first (writers have priority when readers are done)
    if (!this.writer && this.readers === 0 && this.writeQueue.length > 0) {
      const nextWriter = this.writeQueue.shift()!;
      nextWriter();
    }
    // Process read queue if no writers are waiting or active
    else if (!this.writer && this.writeQueue.length === 0 && this.readQueue.length > 0) {
      // Allow all waiting readers to proceed
      const waitingReaders = [...this.readQueue];
      this.readQueue = [];
      waitingReaders.forEach(reader => reader());
    }
  }

  getStats(): { readers: number; writer: boolean; readQueue: number; writeQueue: number } {
    return {
      readers: this.readers,
      writer: this.writer,
      readQueue: this.readQueue.length,
      writeQueue: this.writeQueue.length
    };
  }
}

export class LockManager {
  private userLocks: Map<number, Mutex> = new Map();
  private worldLock: ReadWriteLock = new ReadWriteLock();
  private globalLock: Mutex = new Mutex();

  async getUserLock(userId: number): Promise<Mutex> {
    return await this.globalLock.acquire(async () => {
      let lock = this.userLocks.get(userId);
      if (!lock) {
        lock = new Mutex();
        this.userLocks.set(userId, lock);
      }
      return lock;
    });
  }

  getWorldLock(): ReadWriteLock {
    return this.worldLock;
  }

  async withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
    const lock = await this.getUserLock(userId);
    return await lock.acquire(fn);
  }

  async withWorldReadLock<T>(fn: () => Promise<T>): Promise<T> {
    return await this.worldLock.read(fn);
  }

  async withWorldWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    return await this.worldLock.write(fn);
  }

  async getLockStats(): Promise<{
    totalUserLocks: number;
    worldLockStats: { readers: number; writer: boolean; readQueue: number; writeQueue: number };
    userLockStats: Array<{ userId: number; locked: boolean; queueLength: number }>;
  }> {
    return await this.globalLock.acquire(async () => {
      const userLockStats = Array.from(this.userLocks.entries()).map(([userId, lock]) => ({
        userId,
        locked: lock.isLocked(),
        queueLength: lock.getQueueLength()
      }));

      return {
        totalUserLocks: this.userLocks.size,
        worldLockStats: this.worldLock.getStats(),
        userLockStats
      };
    });
  }

  async cleanup(): Promise<void> {
    await this.globalLock.acquire(async () => {
      this.userLocks.clear();
    });
    console.log('🔒 Lock manager cleaned up');
  }
}

// Singleton instance
let lockManager: LockManager | null = null;

export function getLockManager(): LockManager {
  if (!lockManager) {
    lockManager = new LockManager();
  }
  return lockManager;
}

export function resetLockManager(): void {
  lockManager = null;
}
