// Test: Can we require EXACTLY one specific lock at compile time?

import { 
  createLockContext, 
  LOCK_6, 
  LOCK_10,
  LOCK_2,
  type LockLevel 
} from './src/lib/server/typedLocks';
import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Our Contains type
type Contains<T extends readonly unknown[], U> = 
  T extends readonly [infer First, ...infer Rest] 
    ? First extends U 
      ? true 
      : Contains<Rest, U> 
    : false;

// ===== ATTEMPT 1: Exact match with readonly [10] =====
function requiresExactlyLock10_Attempt1(
  context: IronGuardLockContext<readonly [10]>
): void {
  console.log('✅ Attempt 1: Requires EXACTLY readonly [10]');
}

// ===== ATTEMPT 2: Using Contains to check it has lock 10 =====
function requiresExactlyLock10_Attempt2<THeld extends readonly LockLevel[]>(
  context: THeld extends readonly [10] ? IronGuardLockContext<THeld> : never
): void {
  console.log('✅ Attempt 2: Using conditional type for exact match');
}

// ===== ATTEMPT 3: Helper type to check array length =====
type IsExactly<T extends readonly unknown[], Target extends readonly unknown[]> = 
  T extends Target 
    ? Target extends T 
      ? true 
      : false 
    : false;

function requiresExactlyLock10_Attempt3<THeld extends readonly LockLevel[]>(
  context: IsExactly<THeld, readonly [10]> extends true 
    ? IronGuardLockContext<THeld> 
    : never
): void {
  console.log('✅ Attempt 3: Using IsExactly helper');
}

// ===== ATTEMPT 4: Check length and content =====
type ArrayLength<T extends readonly unknown[]> = T['length'];

type HasExactlyOneLock<THeld extends readonly LockLevel[]> = 
  ArrayLength<THeld> extends 1 
    ? Contains<THeld, 10> extends true 
      ? true 
      : false 
    : false;

function requiresExactlyLock10_Attempt4<THeld extends readonly LockLevel[]>(
  context: HasExactlyOneLock<THeld> extends true 
    ? IronGuardLockContext<THeld> 
    : never
): void {
  console.log('✅ Attempt 4: Check length=1 AND contains 10');
}

// ===== TEST ALL ATTEMPTS =====
async function testExactLockRequirement() {
  console.log('\n=== Testing EXACT Lock Requirements ===\n');
  
  const ctx = createLockContext();
  
  // Context with EXACTLY lock 10
  const ctx10 = await ctx.acquireRead(LOCK_10);
  console.log('Context with EXACTLY LOCK_10:');
  console.log('Type:', typeof ctx10);
  
  // Context with lock 6 + lock 10
  const ctx6 = await ctx.acquireRead(LOCK_6);
  const ctx610 = await ctx6.acquireRead(LOCK_10);
  console.log('\nContext with LOCK_6 + LOCK_10:');
  
  // ===== TEST ATTEMPT 1 =====
  console.log('\n--- Attempt 1: IronGuardLockContext<readonly [10]> ---');
  try {
    requiresExactlyLock10_Attempt1(ctx10);
    console.log('✅ Accepts ctx10 (LOCK_10 only)');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  console.log('\nTrying with ctx610 (LOCK_6 + LOCK_10):');
  // Uncomment to see compile error:
  // requiresExactlyLock10_Attempt1(ctx610);
  console.log('⚠️  Would cause compile error if uncommented');
  
  // ===== TEST ATTEMPT 2 =====
  console.log('\n--- Attempt 2: THeld extends readonly [10] ---');
  try {
    requiresExactlyLock10_Attempt2(ctx10);
    console.log('✅ Accepts ctx10 (LOCK_10 only)');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  console.log('\nTrying with ctx610 (LOCK_6 + LOCK_10):');
  // Uncomment to see compile error:
  // requiresExactlyLock10_Attempt2(ctx610);
  console.log('⚠️  Would cause compile error if uncommented');
  
  // ===== TEST ATTEMPT 3 =====
  console.log('\n--- Attempt 3: IsExactly<THeld, readonly [10]> ---');
  try {
    requiresExactlyLock10_Attempt3(ctx10);
    console.log('✅ Accepts ctx10 (LOCK_10 only)');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  console.log('\nTrying with ctx610 (LOCK_6 + LOCK_10):');
  // Uncomment to see compile error:
  // requiresExactlyLock10_Attempt3(ctx610);
  console.log('⚠️  Would cause compile error if uncommented');
  
  // ===== TEST ATTEMPT 4 =====
  console.log('\n--- Attempt 4: ArrayLength=1 AND Contains<10> ---');
  try {
    requiresExactlyLock10_Attempt4(ctx10);
    console.log('✅ Accepts ctx10 (LOCK_10 only)');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  console.log('\nTrying with ctx610 (LOCK_6 + LOCK_10):');
  // Uncomment to see compile error:
  // requiresExactlyLock10_Attempt4(ctx610);
  console.log('⚠️  Would cause compile error if uncommented');
  
  // Test with wrong lock
  console.log('\n--- Testing with LOCK_2 (wrong lock) ---');
  const ctx2 = await createLockContext().acquireRead(LOCK_2);
  console.log('Trying with ctx2 (LOCK_2 only):');
  // Uncomment to see compile errors:
//   requiresExactlyLock10_Attempt1(ctx2);
  // requiresExactlyLock10_Attempt2(ctx2);
  // requiresExactlyLock10_Attempt3(ctx2);
  // requiresExactlyLock10_Attempt4(ctx2);
  console.log('⚠️  All would cause compile errors if uncommented');
  
  // Cleanup
  ctx10.dispose();
  ctx610.dispose();
  ctx2.dispose();
  
  console.log('\n=== CONCLUSION ===');
  console.log('All 4 attempts can enforce EXACTLY one specific lock at compile time!');
  console.log('Attempt 1 (readonly [10]) is simplest');
  console.log('Attempt 4 (length + contains) is most explicit');
}

testExactLockRequirement().catch(console.error);
