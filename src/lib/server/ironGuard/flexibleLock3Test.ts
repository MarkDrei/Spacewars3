/**
 * Advanced example: Type-safe function composition with lock constraints
 * 
 * This demonstrates how lock constraints can be composed through multiple
 * function calls while maintaining compile-time safety.
 */

import { createLockContext, LOCK_1, LOCK_2, LOCK_3, LOCK_4, LOCK_5, LockContext } from './ironGuardSystem';
import { flexibleLock3Function } from './examples';
import type { ValidLock3Context } from './ironGuardTypes';

// Intermediate function that passes lock context through with same constraints
function intermediateFunction<THeld extends readonly any[]>(
  context: ValidLock3Context<THeld>
): void {
  console.log(`Intermediate function: ${(context as any).toString()}`);
  flexibleLock3Function(context);
}

console.log('=== Type-Safe Function Composition Demo ===\n');

// ✅ Valid lock combinations that work with both functions
const empty = createLockContext();
const withLock1 = createLockContext().acquire(LOCK_1);
const withLock2 = createLockContext().acquire(LOCK_2);
const withLock3 = createLockContext().acquire(LOCK_3);

console.log('Valid cases - all compile and work:');
intermediateFunction(empty);              // Acquires lock 3
intermediateFunction(withLock1);          // Acquires lock 3  
intermediateFunction(withLock2);          // Acquires lock 3
intermediateFunction(withLock3);          // Uses existing lock 3

// ❌ Invalid cases - these cause compile errors
const withLock4Only = createLockContext().acquire(LOCK_4);
const withLock5Only = createLockContext().acquire(LOCK_5);

console.log('\nInvalid cases (uncomment to see compile errors):');
console.log('// intermediateFunction(withLock4Only);   // ❌ Compile error!');
console.log('// intermediateFunction(withLock5Only);   // ❌ Compile error!');
// intermediateFunction(withLock4Only);
// intermediateFunction(withLock5Only);

console.log('\n✅ All function composition maintains compile-time safety!');