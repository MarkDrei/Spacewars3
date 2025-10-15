/**
 * IronGuard: Compile-Time Lock Protection System
 * 
 * Rules:
 * - Locks have numeric levels (10, 20, 30, 34, 35, 40)
 * - You can skip locks (10→30 is legal, or directly acquire 30)
 * - Once you hold a lock, you can only acquire higher level locks
 * - You can pass lock contexts to functions with compile-time validation
 */

import type { LockLevel } from './types';

// Check if a lock is in the held locks array
type Contains<T extends readonly unknown[], U> = T extends readonly [infer First, ...infer Rest]
  ? First extends U 
    ? true 
    : Contains<Rest, U>
  : false;

// Get the maximum value from an array of lock levels
type MaxLock<T extends readonly LockLevel[]> = T extends readonly []
  ? 0
  : T extends readonly [infer First extends LockLevel, ...infer Rest extends readonly LockLevel[]]
    ? First extends LockLevel
      ? Rest extends readonly LockLevel[]
        ? MaxLock<Rest> extends infer M extends number
          ? First extends number
            ? M extends number
              ? First extends M
                ? First
                : M extends First
                  ? M
                  : First extends 10 | 20 | 30 | 34 | 35 | 40
                    ? M extends 10 | 20 | 30 | 34 | 35 | 40
                      ? First extends 40 ? First
                        : M extends 40 ? M
                        : First extends 35 ? First
                        : M extends 35 ? M
                        : First extends 34 ? First
                        : M extends 34 ? M
                        : First extends 30 ? First
                        : M extends 30 ? M
                        : First extends 20 ? First
                        : M extends 20 ? M
                        : First extends 10 ? First
                        : M extends 10 ? M
                        : never
                      : never
                    : never
              : never
            : never
          : never
        : never
      : never
    : never;

// Check if we can acquire a specific lock given current holdings
type CanAcquire<THeld extends readonly LockLevel[], TLock extends LockLevel> =
  Contains<THeld, TLock> extends true
    ? false  // Already held
    : THeld extends readonly []
      ? true  // No locks held, can acquire any
      : MaxLock<THeld> extends infer M extends number
        ? TLock extends number
          ? M extends number
            ? TLock extends M
              ? false  // Same as max - can't acquire
              : M extends 0
                ? true  // No locks (max is 0), can acquire any
                : M extends 10
                  ? TLock extends 20 | 30 | 34 | 35 | 40 ? true : false
                  : M extends 20
                    ? TLock extends 30 | 34 | 35 | 40 ? true : false
                    : M extends 30
                      ? TLock extends 34 | 35 | 40 ? true : false
                      : M extends 34
                        ? TLock extends 35 | 40 ? true : false
                        : M extends 35
                          ? TLock extends 40 ? true : false
                          : M extends 40
                            ? false  // Have 40 (max), can't acquire anything higher
                            : false
            : false
          : false
        : false;

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
      return `Lock ${lock} already held` as never;
    }
    
    const maxHeld = Math.max(0, ...this.heldLocks);
    if (lock <= maxHeld && maxHeld > 0) {
      return `Cannot acquire lock ${lock} - violates ordering (max held: ${maxHeld})` as never;
    }
    
    return new LockContext([...this.heldLocks, lock] as const) as never;
  }

  // Use a lock - must be currently held
  useLock<TLock extends LockLevel>(
    lock: TLock,
    operation: () => void
  ): Contains<THeldLocks, TLock> extends true 
    ? void 
    : `Lock ${TLock} not held` {
    
    if (!this.heldLocks.includes(lock)) {
      return `Lock ${lock} not held` as never;
    }
    
    operation();
    return undefined as never;
  }

  // Check if a specific lock is held
  hasLock<TLock extends LockLevel>(
    lock: TLock
  ): Contains<THeldLocks, TLock> {
    return this.heldLocks.includes(lock) as Contains<THeldLocks, TLock>;
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

// Alias for compatibility with old API
export function createEmptyContext(): LockContext<readonly []> {
  return createLockContext();
}

export type {
  Contains,
  CanAcquire
};
