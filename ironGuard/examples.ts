/**
 * Core examples demonstrating the flexible lock system
 */

import { 
  LockContext, 
  createLockContext, 
  LOCK_1, 
  LOCK_2, 
  LOCK_3, 
  LOCK_4, 
  LOCK_5,
  type Contains
} from './ironGuardSystem';

import type { LockLevel, ValidLock3Context } from './ironGuardTypes';

// Example 1: Function that requires a specific lock
function functionRequiringLock2<THeld extends readonly LockLevel[]>(
  context: Contains<THeld, 2> extends true ? LockContext<THeld> : 'Function requires lock 2'
): void {
  const ctx = context as LockContext<THeld>;
  console.log(`Function requiring lock 2: ${ctx.toString()}`);
  
  ctx.useLock(LOCK_2, () => {
    console.log('  → Using lock 2');
  });
}

// Example 2: Demonstrating lock skipping patterns
function demonstrateLockSkipping(): void {
  console.log('\n=== Lock Skipping Patterns ===');
  
  // Direct acquisition of any lock
  const direct1 = createLockContext().acquire(LOCK_1);
  const direct3 = createLockContext().acquire(LOCK_3);
  const direct5 = createLockContext().acquire(LOCK_5);
  
  console.log(`  Direct lock 1: ${direct1.toString()}`);
  console.log(`  Direct lock 3: ${direct3.toString()}`);
  console.log(`  Direct lock 5: ${direct5.toString()}`);
  
  // Skipping intermediate locks
  const skip1to4 = createLockContext().acquire(LOCK_1).acquire(LOCK_4);
  const skip2to5 = createLockContext().acquire(LOCK_2).acquire(LOCK_5);
  
  console.log(`  Lock 1 → 4: ${skip1to4.toString()}`);
  console.log(`  Lock 2 → 5: ${skip2to5.toString()}`);
}

// Flexible function that needs lock 3 - can acquire it or use existing
function flexibleLock3Function<THeld extends readonly LockLevel[]>(
  context: ValidLock3Context<THeld>
): void {
  const ctx = context as LockContext<THeld>;
  
  // Check if we already have lock 3
  if (ctx.getHeldLocks().includes(3)) {
    console.log(`Using existing lock 3: ${ctx.toString()}`);
    ctx.useLock(LOCK_3, () => {
      console.log('  → Performing operation with existing lock 3');
    });
  } else {
    // Try to acquire lock 3
    const withLock3 = ctx.acquire(LOCK_3);
    if (typeof withLock3 !== 'string') {
      console.log(`Acquired lock 3: ${withLock3.toString()}`);
      withLock3.useLock(LOCK_3, () => {
        console.log('  → Performing operation with acquired lock 3');
      });
    }
  }
}

export {
  functionRequiringLock2,
  demonstrateLockSkipping,
  flexibleLock3Function
};