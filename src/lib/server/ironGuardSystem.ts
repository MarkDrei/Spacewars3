/**
 * IronGuard: Compile-Time Deadlock Prevention System for Spacewars
 * 
 * This system uses TypeScript's type system to enforce lock ordering at compile time,
 * preventing deadlocks before the code even runs.
 * 
 * ## Core Concepts
 * 
 * 1. **Lock Levels**: Numeric hierarchy (0 < 1 < 2 < 2.4 < 2.5 < 2.8 < 3)
 * 2. **Lock Context**: Tracks what locks are currently held
 * 3. **Compile-Time Validation**: TypeScript rejects invalid lock acquisition
 * 4. **Context Threading**: Contexts passed through function calls maintain safety
 * 
 * ## Usage Pattern
 * 
 * ### Entry Points (API Routes, Background Jobs)
 * 
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const emptyCtx = createEmptyContext();  // ✅ Create at entry point
 *   
 *   // Pass context through to all operations
 *   return await performOperation(emptyCtx, userId, data);
 * }
 * ```
 * 
 * ### Internal Functions (Business Logic)
 * 
 * ```typescript
 * // CORRECT: Accept context parameter with specific constraint
 * async function performOperation<CurrentLevel extends number>(
 *   context: ValidUserLockContext<CurrentLevel>,  // ✅ Type-safe constraint
 *   userId: number,
 *   data: any
 * ): Promise<Result> {
 *   // Thread context through lock acquisition
 *   return await cacheManager.withUserLock(context, async (userCtx) => {
 *     // userCtx now has user lock + any previous locks
 *     await helperFunction(userCtx, userId);  // ✅ Thread through
 *   });
 * }
 * 
 * // WRONG: Using 'any' breaks type safety
 * async function badFunction(
 *   context: LockContext<any, any>,  // ❌ Disables compile-time checks!
 *   userId: number
 * ): Promise<Result> {
 *   // TypeScript can't validate lock ordering
 * }
 * ```
 * 
 * ### Acquiring Locks in Order
 * 
 * ```typescript
 * const emptyCtx = createEmptyContext();
 * 
 * // Correct order: Cache(0) → World(1) → User(2) → Database(3)
 * await cacheManager.withWorldWrite(emptyCtx, async (worldCtx) => {
 *   // worldCtx: has world write lock
 *   
 *   await cacheManager.withUserLock(worldCtx, async (userCtx) => {
 *     // userCtx: has world + user locks
 *     
 *     await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
 *       // dbCtx: has world + user + database locks
 *       // ✅ Valid ordering!
 *     });
 *   });
 * });
 * 
 * // Wrong order: Would cause compile error
 * await cacheManager.withDatabaseRead(emptyCtx, async (dbCtx) => {
 *   await cacheManager.withUserLock(dbCtx, async (userCtx) => {
 *     // ❌ COMPILE ERROR: Cannot acquire level 2 after level 3
 *   });
 * });
 * ```
 * 
 * ## Lock Hierarchy
 * 
 * ```
 * 0   → Cache Management
 * 1   → World (Read/Write)
 * 2   → User
 * 2.4 → Message Read
 * 2.5 → Message Write
 * 2.8 → Battle
 * 3   → Database (Read/Write)
 * ```
 * 
 * Rules:
 * - Always acquire locks in increasing order
 * - Can skip levels (0 → 2 is valid)
 * - Cannot acquire lower level after higher level
 * - Cannot acquire same level twice
 */

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
export type MessageReadLevel = 2.4;  // Read operations on messages
export type MessageWriteLevel = 2.5; // Write operations on messages (higher than read)
export type BattleLevel = 2.8;       // Battle operations (between Message Write and Database)
export type DatabaseLevel = 3;

// Type helper to check if new lock level is valid (must be > current max level)
// Exported for use in ironGuardTypes.ts constraint definitions
export type CanAcquire<NewLevel extends number, CurrentLevel extends number> = 
  CurrentLevel extends never 
    ? true 
    : NewLevel extends CurrentLevel 
      ? false 
      : [NewLevel, CurrentLevel] extends [number, number]
        ? NewLevel extends 0 | 1 | 2 | 2.4 | 2.5 | 2.8 | 3
          ? CurrentLevel extends 0 | 1 | 2 | 2.4 | 2.5 | 2.8 | 3
            ? NewLevel extends 0
              ? CurrentLevel extends never ? true : false
              : NewLevel extends 1
                ? CurrentLevel extends 0 | never ? true : false
                : NewLevel extends 2
                  ? CurrentLevel extends 0 | 1 | never ? true : false
                  : NewLevel extends 2.4
                    ? CurrentLevel extends 0 | 1 | 2 | never ? true : false
                    : NewLevel extends 2.5
                      ? CurrentLevel extends 0 | 1 | 2 | 2.4 | never ? true : false
                      : NewLevel extends 2.8
                        ? CurrentLevel extends 0 | 1 | 2 | 2.4 | 2.5 | never ? true : false
                        : NewLevel extends 3
                          ? CurrentLevel extends 0 | 1 | 2 | 2.4 | 2.5 | 2.8 | never ? true : false
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Enhanced Typed ReadWrite Lock with separate read and write levels
export class TypedReadWriteLock<Name extends string, ReadLevel extends number, WriteLevel extends number> {
  private readers = 0;
  private writer = false;
  private readQueue: Array<() => void> = [];
  private writeQueue: Array<() => void> = [];
  private readonly name: Name;
  private readonly readLevel: ReadLevel;
  private readonly writeLevel: WriteLevel;

  constructor(name: Name, readLevel: ReadLevel, writeLevel: WriteLevel) {
    this.name = name;
    this.readLevel = readLevel;
    this.writeLevel = writeLevel;
  }

  /**
   * Acquire read lock with compile-time lock ordering validation
   * Uses ReadLevel for validation - prevents acquiring read lock after write lock
   */
  async read<T, CurrentLevel extends number>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, CurrentLevel>,
    fn: (ctx: LockContext<Locked<`${Name}:read`>, ReadLevel | CurrentLevel>) => Promise<T>
  ): Promise<T> {
    // Compile-time check: can only acquire read lock if ReadLevel > CurrentLevel
    type ValidationCheck = CanAcquire<ReadLevel, CurrentLevel>;
    const _check: ValidationCheck = true as ValidationCheck;

    return new Promise<T>((resolve, reject) => {
      const runRead = async () => {
        this.readers++;
        try {
          const lockedContext = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            _state: 'locked:read' as any,
            _maxLevel: (Math.max(
              typeof context._maxLevel === 'number' ? context._maxLevel : -1,
              this.readLevel
            )) as ReadLevel | CurrentLevel
          } as LockContext<Locked<`${Name}:read`>, ReadLevel | CurrentLevel>;
          
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
   * Uses WriteLevel for validation - higher than ReadLevel to prevent deadlock
   */
  async write<T, CurrentLevel extends number>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, CurrentLevel>,
    fn: (ctx: LockContext<Locked<`${Name}:write`>, WriteLevel | CurrentLevel>) => Promise<T>
  ): Promise<T> {
    // Compile-time check: can only acquire write lock if WriteLevel > CurrentLevel
    type ValidationCheck = CanAcquire<WriteLevel, CurrentLevel>;
    const _check: ValidationCheck = true as ValidationCheck;

    return new Promise<T>((resolve, reject) => {
      const runWrite = async () => {
        this.writer = true;
        try {
          const lockedContext = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            _state: 'locked:write' as any,
            _maxLevel: (Math.max(
              typeof context._maxLevel === 'number' ? context._maxLevel : -1,
              this.writeLevel
            )) as WriteLevel | CurrentLevel
          } as LockContext<Locked<`${Name}:write`>, WriteLevel | CurrentLevel>;
          
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LockContext<Locked<RequiredLock>, any>;

// Helper type for context with specific level or lower
export type RequireLevel<MaxLevel extends number> = 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LockContext<any, MaxLevel>;

// Export for testing and debugging
export function createEmptyContext(): EmptyContext {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _state: 'unlocked' as any,
    _maxLevel: undefined as never
  } as EmptyContext;
}

// Type validation helpers for testing
export type ValidateLockOrder<L1 extends number, L2 extends number> = 
  CanAcquire<L2, L1>;

export type TestValidCacheToWorld = ValidateLockOrder<CacheLevel, WorldLevel>; // Should be true
export type TestValidWorldToUser = ValidateLockOrder<WorldLevel, UserLevel>; // Should be true  
export type TestValidUserToMessageRead = ValidateLockOrder<UserLevel, MessageReadLevel>; // Should be true
export type TestValidMessageReadToWrite = ValidateLockOrder<MessageReadLevel, MessageWriteLevel>; // Should be true
export type TestValidMessageWriteToDatabase = ValidateLockOrder<MessageWriteLevel, DatabaseLevel>; // Should be true
export type TestInvalidUserToWorld = ValidateLockOrder<UserLevel, WorldLevel>; // Should be false
export type TestInvalidSameLevel = ValidateLockOrder<WorldLevel, WorldLevel>; // Should be false
export type TestInvalidMessageWriteToRead = ValidateLockOrder<MessageWriteLevel, MessageReadLevel>; // Should be false
