// Test: Can we build complex lock unions incrementally?

import { 
  createLockContext, 
  LOCK_1,
  LOCK_2,
  LOCK_3,
  type LockLevel 
} from './src/lib/server/typedLocks';
import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Helper type for creating unions of exact lock patterns
type ExactLockUnion<Locks extends readonly LockLevel[][]> = {
  [K in keyof Locks]: IronGuardLockContext<readonly [...Locks[K]]>
}[number];

// ===== Building up incrementally =====

// Level 1: Just LOCK_1
type Has1 = IronGuardLockContext<readonly [1]>;

// Level 2: Add LOCK_2 - either [1] OR [2]
type Has2 = 
  | Has1                                    // Previous level
  | IronGuardLockContext<readonly [2]>;    // New lock

// Alternative using helper:
type Has2_Alt = ExactLockUnion<[[1], [2]]>;

// Level 3: Add LOCK_3 - either [1] OR [2] OR [3] OR [1,3] OR [2,3]
type Foo3 = 
  | Has2                                    // [1] or [2]
  | IronGuardLockContext<readonly [3]>     // [3] alone
  | IronGuardLockContext<readonly [1, 3]>  // [1,3] combo
  | IronGuardLockContext<readonly [2, 3]>; // [2,3] combo

// Alternative using helper:
type Foo3_Alt = ExactLockUnion<[
  [1], 
  [2], 
  [3], 
  [1, 3], 
  [2, 3]
]>;

// ===== More complex: All single locks up to 3 =====
type AnySingleLockUpTo3 = 
  | IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>;

// ===== All combinations with LOCK_3 =====
type AnyWithLock3 = 
  | IronGuardLockContext<readonly [3]>      // Just 3
  | IronGuardLockContext<readonly [1, 3]>   // 1+3
  | IronGuardLockContext<readonly [2, 3]>   // 2+3
  | IronGuardLockContext<readonly [1, 2, 3]>; // 1+2+3

// ===== TEST FUNCTIONS =====

function acceptsHas1(context: Has1): void {
  console.log('✅ Has1: Accepts [1]');
}

function acceptsHas2(context: Has2): void {
  console.log('✅ Has2: Accepts [1] OR [2]');
}

function acceptsFoo3(context: Foo3): void {
  console.log('✅ Foo3: Accepts [1] OR [2] OR [3] OR [1,3] OR [2,3]');
}

function acceptsAnySingleLockUpTo3(context: AnySingleLockUpTo3): void {
  console.log('✅ Any single lock: [1] OR [2] OR [3]');
}

function acceptsAnyWithLock3(context: AnyWithLock3): void {
  console.log('✅ Any combination with LOCK_3');
}

// ===== DEMONSTRATE INCREMENTAL BUILDING =====
async function testIncrementalUnions() {
  console.log('\n=== Testing Incremental Union Building ===\n');
  
  const ctx = createLockContext();
  
  // Create various contexts
  const ctx1 = await ctx.acquireRead(LOCK_1);
  const ctx2 = await ctx.acquireRead(LOCK_2);
  const ctx3 = await ctx.acquireRead(LOCK_3);
  const ctx13 = await ctx1.acquireRead(LOCK_3);
  const ctx23 = await ctx2.acquireRead(LOCK_3);
  const ctx12 = await ctx1.acquireRead(LOCK_2);
  const ctx123 = await ctx12.acquireRead(LOCK_3);

  console.log('Created contexts:');
  console.log('  ctx1:   [1]');
  console.log('  ctx2:   [2]');
  console.log('  ctx3:   [3]');
  console.log('  ctx13:  [1, 3]');
  console.log('  ctx23:  [2, 3]');
  console.log('  ctx123: [1, 2, 3]\n');
  
  // ===== TEST HAS1 =====
  console.log('--- Testing Has1 (only [1]) ---');
  acceptsHas1(ctx1);
  console.log('Rejects: ctx2, ctx3, ctx13, ctx23, ctx123\n');
  
  // ===== TEST HAS2 =====
  console.log('--- Testing Has2 (incremental: [1] OR [2]) ---');
  acceptsHas2(ctx1);
  acceptsHas2(ctx2);
  console.log('Rejects: ctx3, ctx13, ctx23, ctx123\n');
  
  // ===== TEST FOO3 =====
  console.log('--- Testing Foo3 (incremental: [1] OR [2] OR [3] OR [1,3] OR [2,3]) ---');
  acceptsFoo3(ctx1);
  acceptsFoo3(ctx2);
  acceptsFoo3(ctx3);
  acceptsFoo3(ctx13);
  acceptsFoo3(ctx23);
  console.log('Rejects: ctx123 (because [1,2,3] not in union)\n');
  
  // Try invalid - uncomment to see error:
  // acceptsFoo3(ctx123);
  console.log('⚠️  ctx123 would cause compile error\n');
  
  // ===== TEST SINGLE LOCKS =====
  console.log('--- Testing AnySingleLockUpTo3 ([1] OR [2] OR [3]) ---');
  acceptsAnySingleLockUpTo3(ctx1);
  acceptsAnySingleLockUpTo3(ctx2);
  acceptsAnySingleLockUpTo3(ctx3);
  console.log('Rejects: ctx13, ctx23, ctx123 (multi-lock contexts)\n');
  
  // ===== TEST WITH LOCK 3 =====
  console.log('--- Testing AnyWithLock3 (any combo including 3) ---');
  acceptsAnyWithLock3(ctx3);
  acceptsAnyWithLock3(ctx13);
  acceptsAnyWithLock3(ctx23);
  acceptsAnyWithLock3(ctx123);
  console.log('Rejects: ctx1, ctx2 (no LOCK_3)\n');
  
  // Cleanup
  ctx1.dispose();
  ctx2.dispose();
  ctx3.dispose();
  ctx13.dispose();
  ctx23.dispose();
  ctx123.dispose();
  
  console.log('=== EXPLOSION ANALYSIS ===\n');
  
  console.log('For N locks, number of possible combinations:');
  console.log('  - Single locks: N');
  console.log('  - Pairs: N * (N-1) / 2');
  console.log('  - Triples: N * (N-1) * (N-2) / 6');
  console.log('  - All subsets: 2^N - 1 (excluding empty)\n');
  
  console.log('Concrete numbers:');
  console.log('  N=1:  1 combination   (just [1])');
  console.log('  N=2:  3 combinations  ([1], [2], [1,2])');
  console.log('  N=3:  7 combinations  ([1], [2], [3], [1,2], [1,3], [2,3], [1,2,3])');
  console.log('  N=4:  15 combinations');
  console.log('  N=5:  31 combinations');
  console.log('  N=10: 1023 combinations 💥\n');
  
  console.log('So yes, it WORKS but EXPLODES exponentially!');
  console.log('Foo10 would need 1023 union members! 😱\n');
  
  console.log('=== PRACTICAL STRATEGIES ===\n');
  
  console.log('1️⃣  Define only what you need:');
  console.log('   type DatabaseOps = IronGuardLockContext<readonly [10]> | IronGuardLockContext<readonly [6, 10]>');
  console.log('   (Don\'t enumerate all 1023 combinations)\n');
  
  console.log('2️⃣  Use Contains pattern for "has lock X" (any combo):');
  console.log('   function foo<T>(ctx: Contains<T, 10> extends true ? LockContext<T> : never)');
  console.log('   (Accepts any context containing LOCK_10)\n');
  
  console.log('3️⃣  Use ValidLockXContext for "can acquire lock X":');
  console.log('   function foo<T>(ctx: ValidLock10Context<T>)');
  console.log('   (Accepts contexts that can acquire LOCK_10)\n');
  
  console.log('4️⃣  Group by use case with type aliases:');
  console.log('   type ReadOnlyDB = IronGuardLockContext<readonly [10]>');
  console.log('   type UserTransaction = IronGuardLockContext<readonly [6, 10]>');
  console.log('   type FullTransaction = IronGuardLockContext<readonly [4, 6, 10]>');
  console.log('   type AnyDBAccess = ReadOnlyDB | UserTransaction | FullTransaction');
}

testIncrementalUnions().catch(console.error);
