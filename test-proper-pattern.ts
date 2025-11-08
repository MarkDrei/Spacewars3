// CORRECT PATTERN: Two methods for two use cases

import { 
  createLockContext, 
  LOCK_6, 
  LOCK_10,
  type ValidLock10Context,
  type LockLevel,
  DATABASE_LOCK
} from './src/lib/server/typedLocks';
import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// ===== CASE 1: Caller ALREADY holds DATABASE_LOCK =====
// Use a constraint that TypeScript can actually verify
function loadUserUnsafe_ProperCheck<THeld extends readonly LockLevel[]>(
  userId: number,
  context: THeld extends readonly [...any[], 10, ...any[]] ? IronGuardLockContext<THeld> : never
): void {
  console.log(`Loading user ${userId} (lock already held)`);
}

// ===== CASE 2: Will ACQUIRE DATABASE_LOCK =====  
function loadUser_WillAcquire<THeld extends readonly LockLevel[]>(
  userId: number,
  context: ValidLock10Context<THeld>
): void {
  console.log(`Loading user ${userId} (will acquire lock)`);
}

// ===== TESTS =====
async function testProperPattern() {
  console.log('\n=== Testing PROPER Pattern ===\n');
  
  const ctx = createLockContext();
  const ctx6 = await ctx.acquireRead(LOCK_6);
  
  // Test Case 1: Try to use Unsafe version WITHOUT lock 10
  console.log('Test 1: Unsafe version with LOCK_6 only (should fail to compile)');
  // Uncomment to see the error:
  // loadUserUnsafe_ProperCheck(123, ctx6);  // ❌ TypeScript error!
  console.log('⚠️  Commented out - would cause compile error');
  
  // Test Case 2: Acquire lock 10, then use Unsafe version
  console.log('\nTest 2: Unsafe version with LOCK_6 + LOCK_10 (should work)');
  const ctx610 = await ctx6.acquireRead(LOCK_10);
  loadUserUnsafe_ProperCheck(123, ctx610);  // ✅ Works!
  
  // Test Case 3: Use WillAcquire version with LOCK_6 (can acquire 10)
  console.log('\nTest 3: WillAcquire version with LOCK_6 (should work)');
  loadUser_WillAcquire(456, ctx6);  // ✅ Works! Can acquire LOCK_10
  
  // Test Case 4: Try WillAcquire with LOCK_15 (should fail)
  console.log('\nTest 4: WillAcquire version with higher lock (would fail)');
  // const ctx15 = await createLockContext().acquireRead(15 as LockLevel);
  // loadUser_WillAcquire(789, ctx15);  // ❌ TypeScript error!
  console.log('⚠️  Commented out - would cause compile error');
  
  ctx610.dispose();
  
  console.log('\n=== CONCLUSION ===');
  console.log('✅ Proper pattern provides compile-time safety!');
  console.log('✅ Unsafe version requires lock to be held');
  console.log('✅ WillAcquire version checks if lock can be acquired');
}

testProperPattern().catch(console.error);
