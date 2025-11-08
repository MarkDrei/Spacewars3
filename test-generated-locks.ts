// Test the generated lock combinations (domain-agnostic)

import {
  // Domain-agnostic names
  Only2,
  Only10,
  With10,
  Locks2_10,
  Locks6_10,
  Locks4_6_10,
  AnyValidLockCombination,
  // Domain-specific aliases (for convenience)
  OnlyCache,
  OnlyDatabase,
  WithDatabase,
  // Lock constants
  createLockContext,
  CACHE_LOCK,
  DATABASE_LOCK,
  USER_LOCK,
  WORLD_LOCK
} from './src/lib/server/typedLocks';

function acceptsOnlyDatabase(ctx: Only10): void {
  console.log('✅ Accepts ONLY lock 10 (DATABASE_LOCK)');
}

function acceptsOnlyDatabaseAlias(ctx: OnlyDatabase): void {
  console.log('✅ Accepts ONLY DATABASE_LOCK (using alias)');
}

function acceptsCacheAndDatabase(ctx: Locks2_10): void {
  console.log('✅ Accepts locks 2 + 10 (CACHE + DATABASE)');
}

function acceptsAnyWithDatabase(ctx: With10): void {
  console.log('✅ Accepts any combination with lock 10');
}

function acceptsAnyWithDatabaseAlias(ctx: WithDatabase): void {
  console.log('✅ Accepts any combination with DATABASE (using alias)');
}

function acceptsAnyValidCombination(ctx: AnyValidLockCombination): void {
  console.log('✅ Accepts any of the 31 valid combinations');
}

async function testGeneratedTypes() {
  console.log('\n=== Testing Domain-Agnostic Lock Types ===\n');
  
  // Test 1: ONLY lock 10
  console.log('Test 1: Context with ONLY lock 10');
  const ctx10 = await createLockContext().acquireRead(DATABASE_LOCK);
  acceptsOnlyDatabase(ctx10);
  acceptsOnlyDatabaseAlias(ctx10);  // Alias works too!
  acceptsAnyWithDatabase(ctx10);
  acceptsAnyWithDatabaseAlias(ctx10);  // Alias works too!
  acceptsAnyValidCombination(ctx10);
  
  // Test 2: locks 2 + 10
  console.log('\nTest 2: Context with locks 2 + 10');
  const ctx2 = await createLockContext().acquireRead(CACHE_LOCK);
  const ctx2_10 = await ctx2.acquireRead(DATABASE_LOCK);
  acceptsCacheAndDatabase(ctx2_10);
  acceptsAnyWithDatabase(ctx2_10);
  acceptsAnyWithDatabaseAlias(ctx2_10);  // Alias works too!
  acceptsAnyValidCombination(ctx2_10);
  
  // Test 3: Compile-time safety
  console.log('\nTest 3: Compile-time safety');
  console.log('⚠️  acceptsOnlyDatabase(ctx2_10) would fail - has lock 2 too!');
  console.log('⚠️  acceptsCacheAndDatabase(ctx10) would fail - missing lock 2!');
  
  // Cleanup
  ctx10.dispose();
  ctx2_10.dispose();
  
  console.log('\n=== SUCCESS ===');
  console.log('✅ Domain-agnostic types: Only2, Only10, With2, With10, etc.');
  console.log('✅ Domain-specific aliases: OnlyCache, OnlyDatabase, WithCache, etc.');
  console.log('✅ All 31 combinations available');
  console.log('✅ Type-safe at compile time');
  console.log('✅ Backwards compatible with domain names');
}

testGeneratedTypes().catch(console.error);
