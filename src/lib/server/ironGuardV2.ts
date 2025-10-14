/**
 * IronGuard: Unbreakable Compile-Time Lock Protection System (Spacewars Edition)
 * 
 * Rules:
 * - Locks have numeric levels (10, 20, 30, 40, 41, 50, 60)
 * - You can skip locks (10→30 is legal, or directly acquire 50)
 * - Once you hold a lock, you can only acquire higher level locks
 * - You can pass lock contexts to functions with compile-time validation
 * 
 * Lock Hierarchy:
 * - LOCK_CACHE = 10          (Cache management)
 * - LOCK_WORLD = 20          (World operations)
 * - LOCK_USER = 30           (User operations)
 * - LOCK_MESSAGE_READ = 40   (Message reading)
 * - LOCK_MESSAGE_WRITE = 41  (Message writing)
 * - LOCK_BATTLE = 50         (Battle operations)
 * - LOCK_DATABASE = 60       (Database access)
 */

export type LockLevel = 10 | 20 | 30 | 40 | 41 | 50 | 60;

export const LOCK_CACHE = 10 as const;
export const LOCK_WORLD = 20 as const;
export const LOCK_USER = 30 as const;
export const LOCK_MESSAGE_READ = 40 as const;
export const LOCK_MESSAGE_WRITE = 41 as const;
export const LOCK_BATTLE = 50 as const;
export const LOCK_DATABASE = 60 as const;

// Check if a lock is in the held locks array
export type Contains<T extends readonly unknown[], U> = T extends readonly [infer First, ...infer Rest]
  ? First extends U 
    ? true 
    : Contains<Rest, U>
  : false;

// Check if we can acquire a specific lock given current holdings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CanAcquire<THeld extends readonly LockLevel[], TLock extends LockLevel> =
  Contains<THeld, TLock> extends true
    ? false  // Already held
    : THeld extends readonly []
      ? true  // No locks held, can acquire any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : THeld extends readonly [10, ...any[]]
        ? TLock extends 10 ? false : true  // Have 10, can acquire 20-60
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : THeld extends readonly [20, ...any[]] 
          ? TLock extends 10 | 20 ? false : true  // Have 20, can acquire 30-60
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : THeld extends readonly [30, ...any[]]
            ? TLock extends 10 | 20 | 30 ? false : true  // Have 30, can acquire 40-60
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : THeld extends readonly [40, ...any[]]
              ? TLock extends 10 | 20 | 30 | 40 ? false : true  // Have 40, can acquire 41, 50-60
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              : THeld extends readonly [41, ...any[]]
                ? TLock extends 10 | 20 | 30 | 40 | 41 ? false : true  // Have 41, can acquire 50-60
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                : THeld extends readonly [50, ...any[]]
                  ? TLock extends 10 | 20 | 30 | 40 | 41 | 50 ? false : true  // Have 50, can acquire 60
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  : THeld extends readonly [60, ...any[]]
                    ? false  // Have 60, can't acquire anything higher
                    : true;  // Fallback

export class LockContext<THeldLocks extends readonly LockLevel[] = readonly []> {
  private heldLocks: THeldLocks;

  constructor(heldLocks: THeldLocks) {
    this.heldLocks = heldLocks;
  }

  // Acquire a lock - enforces ordering at compile time
  acquire<TLock extends LockLevel>(
    lock: TLock
  ): CanAcquire<THeldLocks, TLock> extends true
    ? LockContext<readonly [...THeldLocks, TLock]>
    : `Cannot acquire lock ${TLock}` {
    
    // Runtime validation
    if (this.heldLocks.includes(lock)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `Lock ${lock} already held` as any;
    }
    
    const maxHeld = Math.max(0, ...this.heldLocks);
    if (lock <= maxHeld && maxHeld > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `Cannot acquire lock ${lock} - violates ordering (max held: ${maxHeld})` as any;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new LockContext([...this.heldLocks, lock] as const) as any;
  }

  // Release a lock - returns context without this lock
  release<TLock extends LockLevel>(
    lock: TLock
  ): Contains<THeldLocks, TLock> extends true
    ? LockContext<Exclude<THeldLocks[number], TLock> extends never ? readonly [] : readonly Exclude<THeldLocks[number], TLock>[]>
    : `Lock ${TLock} not held` {
    
    if (!this.heldLocks.includes(lock)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `Lock ${lock} not held` as any;
    }
    
    const newLocks = this.heldLocks.filter(l => l !== lock);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new LockContext(newLocks as any) as any;
  }

  // Use a lock - must be currently held
  useLock<TLock extends LockLevel>(
    lock: TLock,
    operation: () => void
  ): Contains<THeldLocks, TLock> extends true 
    ? void 
    : `Lock ${TLock} not held` {
    
    if (!this.heldLocks.includes(lock)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `Lock ${lock} not held` as any;
    }
    
    operation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return undefined as any;
  }

  // Check if a specific lock is held
  hasLock<TLock extends LockLevel>(
    lock: TLock
  ): Contains<THeldLocks, TLock> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.heldLocks.includes(lock) as any;
  }

  getHeldLocks(): THeldLocks {
    return this.heldLocks;
  }

  toString(): string {
    return `LockContext[${this.heldLocks.join(', ')}]`;
  }
}

export function createLockContext(): LockContext<readonly []> {
  return new LockContext([] as const);
}
