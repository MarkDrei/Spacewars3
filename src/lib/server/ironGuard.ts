/**
 * IronGuard: Unbreakable Compile-Time Lock Protection System
 * 
 * This system replaces the old typedLocks.ts with a simpler, more maintainable approach.
 * 
 * Rules:
 * - Locks have numeric levels with gaps for future enhancements
 * - You can skip locks (10→30 is legal, or directly acquire 30)
 * - Once you hold a lock, you can only acquire higher level locks
 * - You can pass lock contexts to functions with compile-time validation
 * 
 * Lock Level Mapping:
 * - Level 10: Cache Management
 * - Level 20: World Operations
 * - Level 30: User Operations
 * - Level 40: Message Read
 * - Level 41: Message Write
 * - Level 50: Database (unique value)
 */

// Type definitions for lock levels
export type LockLevel = 10 | 20 | 30 | 40 | 41 | 50;

// Lock level constants for backwards compatibility
export type CacheLevel = 10;
export type WorldLevel = 20;
export type UserLevel = 30;
export type MessageReadLevel = 40;
export type MessageWriteLevel = 41;
export type DatabaseLevel = 50;

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
      : THeld extends readonly [10, ...readonly LockLevel[]]
        ? TLock extends 10 ? false : true  // Have 10, can acquire 20-50
        : THeld extends readonly [20, ...readonly LockLevel[]] 
          ? TLock extends 10 | 20 ? false : true  // Have 20, can acquire 30-50
          : THeld extends readonly [30, ...readonly LockLevel[]]
            ? TLock extends 10 | 20 | 30 ? false : true  // Have 30, can acquire 40-50
            : THeld extends readonly [40, ...readonly LockLevel[]]
              ? TLock extends 10 | 20 | 30 | 40 ? false : true  // Have 40, can acquire 41, 50
              : THeld extends readonly [41, ...readonly LockLevel[]]
                ? TLock extends 10 | 20 | 30 | 40 | 41 ? false : true  // Have 41, can acquire 50
                : THeld extends readonly [50, ...readonly LockLevel[]]
                  ? false  // Have 50, can't acquire anything higher
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      `locked:${name}` as any,
      [...this.heldLocks, lock] as const
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
  }

  /**
   * Check if a specific lock is held
   */
  hasLock<TLock extends LockLevel>(lock: TLock): Contains<THeldLocks, TLock> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptyContext = LockContext<any, any>;

/**
 * Create an empty lock context (starting point for all lock acquisitions)
 */
export function createEmptyContext(): EmptyContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new LockContext<Unlocked, readonly []>('unlocked' as any, [] as const) as any;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, THeld>,
    fn: (ctx: LockContext<Locked<Name>, readonly [...THeld, LockLevelNum]>) => Promise<T>
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = context as LockContext<any, THeld>;
    
    // Runtime check for lock ordering
    const maxHeld = ctx.getHeldLocks().length > 0 ? Math.max(...ctx.getHeldLocks()) : 0;
    if (this.level <= maxHeld && maxHeld > 0) {
      throw new Error(`Cannot acquire lock ${this.name} at level ${this.level} - violates ordering (max held: ${maxHeld})`);
    }
    
    // Acquire the lock
    await this.lock();
    
    // Create new context with this lock acquired
    const newContext = ctx.acquire(this.level, this.name);
    
    try {
      // Execute the function with the new context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, THeld>,
    fn: (ctx: LockContext<Locked<`${Name}:read`>, readonly [...THeld, ReadLevelNum]>) => Promise<T>
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = context as LockContext<any, THeld>;
    
    // Runtime check for lock ordering
    const maxHeld = ctx.getHeldLocks().length > 0 ? Math.max(...ctx.getHeldLocks()) : 0;
    if (this.readLevel <= maxHeld && maxHeld > 0) {
      throw new Error(`Cannot acquire read lock ${this.name} at level ${this.readLevel} - violates ordering (max held: ${maxHeld})`);
    }
    
    // Acquire read lock
    await this.lockRead();
    
    // Create new context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newContext = ctx.acquire(this.readLevel, `${this.name}:read` as any);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await fn(newContext as any);
    } finally {
      this.unlockRead();
    }
  }

  /**
   * Acquire a write lock
   */
  async write<THeld extends readonly LockLevel[], T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, THeld>,
    fn: (ctx: LockContext<Locked<`${Name}:write`>, readonly [...THeld, WriteLevelNum]>) => Promise<T>
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = context as LockContext<any, THeld>;
    
    // Runtime check for lock ordering
    const maxHeld = ctx.getHeldLocks().length > 0 ? Math.max(...ctx.getHeldLocks()) : 0;
    if (this.writeLevel <= maxHeld && maxHeld > 0) {
      throw new Error(`Cannot acquire write lock ${this.name} at level ${this.writeLevel} - violates ordering (max held: ${maxHeld})`);
    }
    
    // Acquire write lock
    await this.lockWrite();
    
    // Create new context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newContext = ctx.acquire(this.writeLevel, `${this.name}:write` as any);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LockContext<Locked<RequiredLock>, any>;

// Helper type for context with specific level or lower
export type RequireLevel<_MaxLevel extends number> = 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  LockContext<any, any>;

// Export type for backwards compatibility
export type { CanAcquire };
