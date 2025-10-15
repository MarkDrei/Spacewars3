/**
 * IronGuard: Unbreakable Compile-Time Lock Protection System
 * 
 * Rules:
 * - Locks have numeric levels (10, 20, 30, 34, 35, 40)
 * - You can skip locks (10→30 is legal, or directly acquire 30)
 * - Once you hold a lock, you can only acquire higher level locks
 * - You can pass lock contexts to functions with compile-time validation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { LockLevel } from './types';

// Check if a lock is in the held locks array
export type Contains<T extends readonly unknown[], U> = T extends readonly [infer First, ...infer Rest]
  ? First extends U 
    ? true 
    : Contains<Rest, U>
  : false;

// Check if we can acquire a specific lock given current holdings
export type CanAcquire<THeld extends readonly LockLevel[], TLock extends LockLevel> =
  Contains<THeld, TLock> extends true
    ? false  // Already held
    : THeld extends readonly []
      ? true  // No locks held, can acquire any
      : THeld extends readonly [10, ...any[]]
        ? TLock extends 10 ? false : true  // Have 10, can acquire 20-40
        : THeld extends readonly [20, ...any[]] 
          ? TLock extends 10 | 20 ? false : true  // Have 20, can acquire 30-40
          : THeld extends readonly [30, ...any[]]
            ? TLock extends 10 | 20 | 30 ? false : true  // Have 30, can acquire 34-40
            : THeld extends readonly [34, ...any[]]
              ? TLock extends 10 | 20 | 30 | 34 ? false : true  // Have 34, can acquire 35, 40
              : THeld extends readonly [35, ...any[]]
                ? TLock extends 10 | 20 | 30 | 34 | 35 ? false : true  // Have 35, can acquire 40
                : THeld extends readonly [40, ...any[]]
                  ? false  // Have 40, can't acquire anything higher
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

export function createEmptyLockContext(): LockContext<readonly []> {
  return new LockContext([] as const);
}
