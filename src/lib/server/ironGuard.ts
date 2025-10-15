/**
 * IronGuard: Unbreakable Compile-Time Lock Protection System
 * 
 * This system replaces the old typedLocks.ts with a simpler, more maintainable approach.
 * 
 * Rules:
 * - Locks have numeric levels (1, 2, 3, 4, 5)
 * - You can skip locks (1→3 is legal, or directly acquire 3)
 * - Once you hold a lock, you can only acquire higher level locks
 * - You can pass lock contexts to functions with compile-time validation
 * 
 * Lock Level Mapping (from old system):
 * - Level 1: Cache Management (was CacheLevel = 0)
 * - Level 2: World Operations (was WorldLevel = 1)
 * - Level 3: User Operations (was UserLevel = 2)
 * - Level 4: Message Read (was MessageReadLevel = 2.4)
 * - Level 5: Message Write & Database (was MessageWriteLevel = 2.5 / DatabaseLevel = 3)
 */

// Type definitions for lock levels
export type LockLevel = 1 | 2 | 3 | 4 | 5;

// Lock level constants for backwards compatibility
export type CacheLevel = 1;
export type WorldLevel = 2;
export type UserLevel = 3;
export type MessageReadLevel = 4;
export type MessageWriteLevel = 5;
export type DatabaseLevel = 5;

// Lock state phantom types for compatibility
declare const LockBrand: unique symbol;
export type Unlocked = { readonly [LockBrand]: 'unlocked' };
export type Locked<Name extends string> = { readonly [LockBrand]: `locked:${Name}` };

// Check if a lock level is in the held locks array
type Contains<T extends readonly unknown[], U> = T extends readonly [infer First, ...infer Rest]
  ? First extends U 
    ? true 
    : Contains<Rest, U>
  : false;

// Check if we can acquire a specific lock given current holdings
type CanAcquire<THeld extends readonly LockLevel[], TLock extends LockLevel> =
  Contains<THeld, TLock> extends true
    ? false  // Already held
    : THeld extends readonly []
      ? true  // No locks held, can acquire any
      : THeld extends readonly [1, ...any[]]
        ? TLock extends 1 ? false : true  // Have 1, can acquire 2-5
        : THeld extends readonly [2, ...any[]] 
          ? TLock extends 1 | 2 ? false : true  // Have 2, can acquire 3-5
          : THeld extends readonly [3, ...any[]]
            ? TLock extends 1 | 2 | 3 ? false : true  // Have 3, can acquire 4-5
            : THeld extends readonly [4, ...any[]]
              ? TLock extends 1 | 2 | 3 | 4 ? false : true  // Have 4, can acquire 5
              : THeld extends readonly [5, ...any[]]
                ? false  // Have 5, can't acquire anything higher
                : true;  // Fallback

/**
 * Lock context that tracks currently held locks
 * This is the core of the compile-time lock ordering validation
 */
export class LockContext<
  State = Unlocked,
  THeldLocks extends readonly LockLevel[] = readonly []
> {
  readonly _state: State;
  readonly _maxLevel: THeldLocks extends readonly [] ? never : THeldLocks[number];
  private heldLocks: THeldLocks;

  constructor(state: State, heldLocks: THeldLocks) {
    this._state = state;
    this._maxLevel = (heldLocks.length > 0 ? Math.max(...heldLocks) : undefined) as any;
    this.heldLocks = heldLocks;
  }

  /**
   * Acquire a lock - enforces ordering at compile time
   * Returns a new context with the acquired lock
   */
  acquire<TLock extends LockLevel, Name extends string>(
    lock: TLock,
    name: Name
  ): CanAcquire<THeldLocks, TLock> extends true
    ? LockContext<Locked<Name>, readonly [...THeldLocks, TLock]>
    : `Cannot acquire lock ${TLock}` {
    
    // Runtime validation
    if (this.heldLocks.includes(lock)) {
      throw new Error(`Lock ${lock} (${name}) already held`);
    }
    
    const maxHeld = Math.max(0, ...this.heldLocks);
    if (lock <= maxHeld && maxHeld > 0) {
      throw new Error(`Cannot acquire lock ${lock} (${name}) - violates ordering (max held: ${maxHeld})`);
    }
    
    return new LockContext(
      `locked:${name}` as any,
      [...this.heldLocks, lock] as const
    ) as any;
  }

  /**
   * Check if a specific lock is held
   */
  hasLock<TLock extends LockLevel>(lock: TLock): Contains<THeldLocks, TLock> {
    return this.heldLocks.includes(lock) as any;
  }

  /**
   * Get all held locks
   */
  getHeldLocks(): THeldLocks {
    return this.heldLocks;
  }

  toString(): string {
    return `LockContext[${this.heldLocks.join(', ')}]`;
  }
}

// Base context (no locks held)
export type EmptyContext = LockContext<Unlocked, readonly []>;

/**
 * Create an empty lock context (starting point for all lock acquisitions)
 */
export function createEmptyContext(): EmptyContext {
  return new LockContext<Unlocked, readonly []>('unlocked' as any, [] as const);
}

/**
 * Typed Mutex with compile-time lock ordering enforcement
 * This wraps a regular mutex with type-safe lock context tracking
 */
export class TypedMutex<Name extends string, LockLevelNum extends LockLevel> {
  private name: Name;
  private level: LockLevelNum;
  private locked: boolean = false;
  private queue: Array<() => void> = [];

  constructor(name: Name, level: LockLevelNum) {
    this.name = name;
    this.level = level;
  }

  /**
   * Acquire the mutex, execute the function, then release
   * Type system ensures proper lock ordering
   */
  async acquire<THeld extends readonly LockLevel[], T>(
    context: CanAcquire<THeld, LockLevelNum> extends true
      ? LockContext<any, THeld>
      : `Cannot acquire ${Name} at level ${LockLevelNum}`,
    fn: (ctx: LockContext<Locked<Name>, readonly [...THeld, LockLevelNum]>) => Promise<T>
  ): Promise<T> {
    const ctx = context as LockContext<any, THeld>;
    
    // Acquire the lock
    await this.lock();
    
    // Create new context with this lock acquired
    const newContext = ctx.acquire(this.level, this.name);
    
    try {
      // Execute the function with the new context
      return await fn(newContext as any);
    } finally {
      // Release the lock
      this.unlock();
    }
  }

  /**
   * Internal lock acquisition
   */
  private async lock(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    
    // Wait in queue
    await new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  /**
   * Internal lock release
   */
  private unlock(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  /**
   * Check if the mutex is currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get the current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * Typed ReadWrite Lock with separate read and write levels
 * Allows multiple concurrent readers but exclusive writer
 */
export class TypedReadWriteLock<
  Name extends string,
  ReadLevelNum extends LockLevel,
  WriteLevelNum extends LockLevel = ReadLevelNum
> {
  private name: Name;
  private readLevel: ReadLevelNum;
  private writeLevel: WriteLevelNum;
  
  private readers: number = 0;
  private writer: boolean = false;
  private readQueue: Array<() => void> = [];
  private writeQueue: Array<() => void> = [];

  constructor(name: Name, readLevel: ReadLevelNum, writeLevel?: WriteLevelNum) {
    this.name = name;
    this.readLevel = readLevel;
    this.writeLevel = (writeLevel ?? readLevel) as WriteLevelNum;
  }

  /**
   * Acquire a read lock
   */
  async read<THeld extends readonly LockLevel[], T>(
    context: CanAcquire<THeld, ReadLevelNum> extends true
      ? LockContext<any, THeld>
      : `Cannot acquire read lock ${Name} at level ${ReadLevelNum}`,
    fn: (ctx: LockContext<Locked<`${Name}:read`>, readonly [...THeld, ReadLevelNum]>) => Promise<T>
  ): Promise<T> {
    const ctx = context as LockContext<any, THeld>;
    
    // Acquire read lock
    await this.lockRead();
    
    // Create new context
    const newContext = ctx.acquire(this.readLevel, `${this.name}:read` as any);
    
    try {
      return await fn(newContext as any);
    } finally {
      this.unlockRead();
    }
  }

  /**
   * Acquire a write lock
   */
  async write<THeld extends readonly LockLevel[], T>(
    context: CanAcquire<THeld, WriteLevelNum> extends true
      ? LockContext<any, THeld>
      : `Cannot acquire write lock ${Name} at level ${WriteLevelNum}`,
    fn: (ctx: LockContext<Locked<`${Name}:write`>, readonly [...THeld, WriteLevelNum]>) => Promise<T>
  ): Promise<T> {
    const ctx = context as LockContext<any, THeld>;
    
    // Acquire write lock
    await this.lockWrite();
    
    // Create new context
    const newContext = ctx.acquire(this.writeLevel, `${this.name}:write` as any);
    
    try {
      return await fn(newContext as any);
    } finally {
      this.unlockWrite();
    }
  }

  /**
   * Internal read lock acquisition
   */
  private async lockRead(): Promise<void> {
    if (!this.writer && this.writeQueue.length === 0) {
      this.readers++;
      return;
    }
    
    await new Promise<void>(resolve => {
      this.readQueue.push(resolve);
    });
  }

  /**
   * Internal read lock release
   */
  private unlockRead(): void {
    this.readers--;
    
    if (this.readers === 0 && this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      this.writer = true;
      next();
    }
  }

  /**
   * Internal write lock acquisition
   */
  private async lockWrite(): Promise<void> {
    if (!this.writer && this.readers === 0) {
      this.writer = true;
      return;
    }
    
    await new Promise<void>(resolve => {
      this.writeQueue.push(resolve);
    });
  }

  /**
   * Internal write lock release
   */
  private unlockWrite(): void {
    this.writer = false;
    
    // Give priority to waiting writers
    if (this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      this.writer = true;
      next();
    } else if (this.readQueue.length > 0) {
      // Grant all waiting readers
      const readers = [...this.readQueue];
      this.readQueue = [];
      this.readers = readers.length;
      readers.forEach(resolve => resolve());
    }
  }

  /**
   * Get lock statistics
   */
  getStats(): {
    readers: number;
    writer: boolean;
    readQueue: number;
    writeQueue: number;
  } {
    return {
      readers: this.readers,
      writer: this.writer,
      readQueue: this.readQueue.length,
      writeQueue: this.writeQueue.length
    };
  }
}

// Helper type for context requirements
export type RequireContext<RequiredLock extends string> = 
  LockContext<Locked<RequiredLock>, any>;

// Helper type for context with specific level or lower
export type RequireLevel<MaxLevel extends number> = 
  LockContext<any, MaxLevel>;

// Export type for backwards compatibility
export type { CanAcquire };
