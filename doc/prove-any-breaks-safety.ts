/**
 * Test demonstrating that current system's use of `any` breaks compile-time checking
 * 
 * This test shows invalid code that SHOULD fail to compile but doesn't.
 */

import { 
  createEmptyContext, 
  type LockContext,
  TypedMutex,
  type UserLevel,
  type DatabaseLevel
} from '../src/lib/server/ironGuardSystem';

// Simulate the current broken pattern
async function needsUserLock(
  userId: number,
  context: LockContext<any, any>  // ❌ Using ANY like current code
): Promise<void> {
  console.log(`Function needs user lock for user ${userId}`);
  console.log(`  Received context with max level: ${typeof context._maxLevel === 'number' ? context._maxLevel : 'none'}`);
  
  // In real code, this would try to acquire user lock (level 2)
  const userLock = new TypedMutex('user', 2 as UserLevel);
  await userLock.acquire(context, async (userCtx) => {
    console.log(`  ✅ Acquired user lock (level 2)`);
  });
}

async function runTest() {
  console.log('=== Demonstrating Compile-Time Safety Failure ===\n');

  console.log('Test 1: Valid case (should work)');
  const emptyCtx = createEmptyContext();
  await needsUserLock(123, emptyCtx);
  console.log('✅ Worked as expected\n');

  console.log('Test 2: INVALID case - holding database lock (level 3), trying to acquire user lock (level 2)');
  console.log('This SHOULD be a compile error, but ANY makes it compile!\n');

  // Create context with database lock (level 3)
  const dbCtx: LockContext<any, 3> = {
    _state: 'locked:database' as any,
    _maxLevel: 3
  };

  console.log('Calling needsUserLock with database context (level 3)...');
  try {
    // THIS COMPILES! But it's WRONG - violates lock ordering
    // Should not be able to acquire level 2 lock when holding level 3
    await needsUserLock(123, dbCtx);
    console.log('❌ Function executed (should have failed at compile time!)');
  } catch (error) {
    console.log('💥 Runtime error (as expected):', error);
  }

  console.log('\n=== Analysis ===');
  console.log('❌ The function accepts LockContext<any, any>');
  console.log('❌ ANY disables all type checking');
  console.log('❌ Invalid lock ordering compiles fine');
  console.log('❌ Error only caught at runtime (if at all)');
  console.log('\n🔧 FIX: Use specific type constraints instead of ANY');
  console.log('   Example: context: ValidUserLockContext<THeld>');
}

runTest();
