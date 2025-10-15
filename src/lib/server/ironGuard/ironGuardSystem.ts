/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * IronGuard: Unbreakable Compile-Time Lock Protection System
 * 
 * Rules:
 * - Locks have numeric levels (1, 2, 3, 4, 5)
 * - You can skip locks (1→3 is legal, or directly acquire 3)
 * - Once you hold a lock, you can only acquire higher level locks
 * - You can pass lock contexts to functions with compile-time validation
 */

import type { LockLevel } from './ironGuardTypes';

const LOCK_1 = 1 as const;
const LOCK_2 = 2 as const;
const LOCK_3 = 3 as const;
const LOCK_4 = 4 as const;
const LOCK_5 = 5 as const;

// Check if a lock is in the held locks array
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

class LockContext<THeldLocks extends readonly LockLevel[] = readonly []> {
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
      return `Lock ${lock} already held` as any;
    }
    
    const maxHeld = Math.max(0, ...this.heldLocks);
    if (lock <= maxHeld && maxHeld > 0) {
      return `Cannot acquire lock ${lock} - violates ordering (max held: ${maxHeld})` as any;
    }
    
    return new LockContext([...this.heldLocks, lock] as const) as any;
  }

  // Use a lock - must be currently held
  useLock<TLock extends LockLevel>(
    lock: TLock,
    operation: () => void
  ): Contains<THeldLocks, TLock> extends true 
    ? void 
    : `Lock ${TLock} not held` {
    
    if (!this.heldLocks.includes(lock)) {
      return `Lock ${lock} not held` as any;
    }
    
    operation();
    return undefined as any;
  }

  // Check if a specific lock is held
  hasLock<TLock extends LockLevel>(
    lock: TLock
  ): Contains<THeldLocks, TLock> {
    return this.heldLocks.includes(lock) as any;
  }

  getHeldLocks(): THeldLocks {
    return this.heldLocks;
  }

  toString(): string {
    return `LockContext[${this.heldLocks.join(', ')}]`;
  }
}

function createLockContext(): LockContext<readonly []> {
  return new LockContext([] as const);
}

export {
  LockContext,
  createLockContext,
  LOCK_1,
  LOCK_2,
  LOCK_3,
  LOCK_4,
  LOCK_5
};

export type {
  LockLevel,
  Contains,
  CanAcquire
};