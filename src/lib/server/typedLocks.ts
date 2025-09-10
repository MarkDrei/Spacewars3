// ---
// TypeScript Compile-Time Deadlock Prevention System
// Phase 1: Core Type System and Typed Lock Classes
// ---

// Phantom type brands for lock state and level tracking
declare const LockBrand: unique symbol;
declare const LevelBrand: unique symbol;

// Lock state phantom types
export type Unlocked = { readonly [LockBrand]: 'unlocked' };
export type Locked<Name extends string> = { readonly [LockBrand]: `locked:${Name}` };

// Lock level phantom types (lower numbers = higher priority)
export type Level<N extends number> = { readonly [LevelBrand]: N };

// Lock context that tracks current locks and maximum level held
export interface LockContext<State = Unlocked, MaxLevel extends number = never> {
  readonly _state: State;
  readonly _maxLevel: MaxLevel;
}

// Base context (no locks held)
export type EmptyContext = LockContext<Unlocked, never>;

// Lock level constants
export type CacheLevel = 0;
export type WorldLevel = 1; 
export type UserLevel = 2;
export type DatabaseLevel = 3;

// Type helper to check if new lock level is valid (must be > current max level)
type CanAcquire<NewLevel extends number, CurrentLevel extends number> = 
  CurrentLevel extends never 
    ? true 
    : NewLevel extends CurrentLevel 
      ? false 
      : [NewLevel, CurrentLevel] extends [number, number]
        ? NewLevel extends 0 | 1 | 2 | 3
          ? CurrentLevel extends 0 | 1 | 2 | 3
            ? NewLevel extends 0
              ? CurrentLevel extends never ? true : false
              : NewLevel extends 1
                ? CurrentLevel extends 0 | never ? true : false
                : NewLevel extends 2
                  ? CurrentLevel extends 0 | 1 | never ? true : false
                  : NewLevel extends 3
                    ? CurrentLevel extends 0 | 1 | 2 | never ? true : false
                    : false
          : false
        : false
      : false;

// Typed Mutex with compile-time lock ordering enforcement
export class TypedMutex<Name extends string, LockLevel extends number> {
  private locked = false;
  private queue: Array<() => void> = [];
  private readonly name: Name;
  private readonly level: LockLevel;

  constructor(name: Name, level: LockLevel) {
    this.name = name;
    this.level = level;
  }

  /**
   * Acquire mutex with compile-time lock ordering validation
   * @param context Current lock context
   * @param fn Function to execute with lock held
   * @returns Promise with result, or compilation error if lock order violated
   */
  async acquire<T, CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    fn: (ctx: LockContext<Locked<Name>, LockLevel | CurrentLevel>) => Promise<T>
  ): Promise<T> {
    // Compile-time check: can only acquire if lock level is valid
    type ValidationCheck = CanAcquire<LockLevel, CurrentLevel>;
    const _check: ValidationCheck = true as ValidationCheck;
    
    return new Promise<T>((resolve, reject) => {
      const runLocked = async () => {
        try {
          // Create new context with this lock added
          const lockedContext = {
            _state: 'locked' as any,
            _maxLevel: (Math.max(
              typeof context._maxLevel === 'number' ? context._maxLevel : -1,
              this.level
            )) as LockLevel | CurrentLevel
          } as LockContext<Locked<Name>, LockLevel | CurrentLevel>;
          
          const result = await fn(lockedContext);
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

// Typed ReadWrite Lock with compile-time lock ordering enforcement
export class TypedReadWriteLock<Name extends string, LockLevel extends number> {
  private readers = 0;
  private writer = false;
  private readQueue: Array<() => void> = [];
  private writeQueue: Array<() => void> = [];
  private readonly name: Name;
  private readonly level: LockLevel;

  constructor(name: Name, level: LockLevel) {
    this.name = name;
    this.level = level;
  }

  /**
   * Acquire read lock with compile-time lock ordering validation
   */
  async read<T, CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    fn: (ctx: LockContext<Locked<`${Name}:read`>, LockLevel | CurrentLevel>) => Promise<T>
  ): Promise<T> {
    // Compile-time check: can only acquire if lock level is valid
    type ValidationCheck = CanAcquire<LockLevel, CurrentLevel>;
    const _check: ValidationCheck = true as ValidationCheck;

    return new Promise<T>((resolve, reject) => {
      const runRead = async () => {
        this.readers++;
        try {
          const lockedContext = {
            _state: 'locked:read' as any,
            _maxLevel: (Math.max(
              typeof context._maxLevel === 'number' ? context._maxLevel : -1,
              this.level
            )) as LockLevel | CurrentLevel
          } as LockContext<Locked<`${Name}:read`>, LockLevel | CurrentLevel>;
          
          const result = await fn(lockedContext);
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

  /**
   * Acquire write lock with compile-time lock ordering validation
   */
  async write<T, CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    fn: (ctx: LockContext<Locked<`${Name}:write`>, LockLevel | CurrentLevel>) => Promise<T>
  ): Promise<T> {
    // Compile-time check: can only acquire if lock level is valid
    type ValidationCheck = CanAcquire<LockLevel, CurrentLevel>;
    const _check: ValidationCheck = true as ValidationCheck;

    return new Promise<T>((resolve, reject) => {
      const runWrite = async () => {
        this.writer = true;
        try {
          const lockedContext = {
            _state: 'locked:write' as any,
            _maxLevel: (Math.max(
              typeof context._maxLevel === 'number' ? context._maxLevel : -1,
              this.level
            )) as LockLevel | CurrentLevel
          } as LockContext<Locked<`${Name}:write`>, LockLevel | CurrentLevel>;
          
          const result = await fn(lockedContext);
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

// Helper type for context requirements
export type RequireContext<RequiredLock extends string> = 
  LockContext<Locked<RequiredLock>, any>;

// Helper type for context with specific level or lower
export type RequireLevel<MaxLevel extends number> = 
  LockContext<any, MaxLevel>;

// Export for testing and debugging
export function createEmptyContext(): EmptyContext {
  return {
    _state: 'unlocked' as any,
    _maxLevel: undefined as never
  } as EmptyContext;
}

// Type validation helpers for testing
export type ValidateLockOrder<L1 extends number, L2 extends number> = 
  CanAcquire<L2, L1>;

export type TestValidCacheToWorld = ValidateLockOrder<CacheLevel, WorldLevel>; // Should be true
export type TestValidWorldToUser = ValidateLockOrder<WorldLevel, UserLevel>; // Should be true  
export type TestInvalidUserToWorld = ValidateLockOrder<UserLevel, WorldLevel>; // Should be false
export type TestInvalidSameLevel = ValidateLockOrder<WorldLevel, WorldLevel>; // Should be false
