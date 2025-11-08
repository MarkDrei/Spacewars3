// Test: Can we accept multiple EXACT lock configurations?

import { 
  createLockContext, 
  LOCK_8,
  LOCK_10,
  LOCK_6,
  type LockLevel 
} from './src/lib/server/typedLocks';
import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// ===== APPROACH 1: Simple Union Type =====
function acceptsLock8Or10_Simple(
  context: IronGuardLockContext<readonly [8]> | IronGuardLockContext<readonly [10]>
): void {
  console.log('✅ Accepts EXACTLY lock 8 OR EXACTLY lock 10');
}

// ===== APPROACH 2: Generic with Constraint =====
function acceptsLock8Or10_Generic<THeld extends readonly [8] | readonly [10]>(
  context: IronGuardLockContext<THeld>
): void {
  console.log('✅ Generic: Accepts EXACTLY lock 8 OR EXACTLY lock 10');
}

// ===== APPROACH 3: More Complex - Multiple locks OR single lock =====
function acceptsMultiplePatterns(
  context: 
    | IronGuardLockContext<readonly [10]>           // EXACTLY lock 10
    | IronGuardLockContext<readonly [8]>            // EXACTLY lock 8
    | IronGuardLockContext<readonly [6, 10]>        // EXACTLY lock 6 + 10
): void {
  console.log('✅ Accepts: [10] OR [8] OR [6,10]');
}

// ===== APPROACH 4: Reusable Type Alias =====
type DatabaseOrMessageLock = 
  | IronGuardLockContext<readonly [10]>   // DATABASE_LOCK only
  | IronGuardLockContext<readonly [8]>;   // MESSAGE_LOCK only

function acceptsEitherLock(context: DatabaseOrMessageLock): void {
  console.log('✅ Accepts DATABASE_LOCK or MESSAGE_LOCK (type alias)');
}

// ===== APPROACH 5: Generic union with type helper =====
type ExactLockUnion<Locks extends readonly LockLevel[][]> = {
  [K in keyof Locks]: IronGuardLockContext<readonly [...Locks[K]]>
}[number];

// Use it: Accept EXACTLY [8] OR EXACTLY [10]
type Lock8Or10 = ExactLockUnion<[[8], [10]]>;

function acceptsLock8Or10_TypeHelper(context: Lock8Or10): void {
  console.log('✅ Type helper: Accepts EXACTLY lock 8 OR EXACTLY lock 10');
}

// ===== TEST ALL APPROACHES =====
async function testMultipleLockTypes() {
  console.log('\n=== Testing Multiple Exact Lock Configurations ===\n');
  
  const ctx = createLockContext();
  
  // Create contexts with different lock combinations
  const ctx8 = await ctx.acquireRead(LOCK_8);      // EXACTLY [8]
  const ctx10 = await ctx.acquireRead(LOCK_10);    // EXACTLY [10]
  const ctx6 = await ctx.acquireRead(LOCK_6);
  const ctx610 = await ctx6.acquireRead(LOCK_10);  // EXACTLY [6, 10]
  
  console.log('Created contexts:');
  console.log('  ctx8:   LockContext<readonly [8]>');
  console.log('  ctx10:  LockContext<readonly [10]>');
  console.log('  ctx610: LockContext<readonly [6, 10]>\n');
  
  // ===== TEST APPROACH 1: Simple Union =====
  console.log('--- Approach 1: Simple Union Type ---');
  
  console.log('Testing with ctx8 (LOCK_8):');
  acceptsLock8Or10_Simple(ctx8);
  
  console.log('Testing with ctx10 (LOCK_10):');
  acceptsLock8Or10_Simple(ctx10);
  
  console.log('Testing with ctx610 (LOCK_6 + LOCK_10):');
  // Uncomment to see compile error:
  // acceptsLock8Or10_Simple(ctx610);
  console.log('⚠️  Would cause compile error - not in union\n');
  
  // ===== TEST APPROACH 2: Generic with Constraint =====
  console.log('--- Approach 2: Generic with Constraint ---');
  
  console.log('Testing with ctx8 (LOCK_8):');
  acceptsLock8Or10_Generic(ctx8);
  
  console.log('Testing with ctx10 (LOCK_10):');
  acceptsLock8Or10_Generic(ctx10);
  
  console.log('Testing with ctx610 (LOCK_6 + LOCK_10):');
  // Uncomment to see compile error:
  // acceptsLock8Or10_Generic(ctx610);
  console.log('⚠️  Would cause compile error - doesn\'t match constraint\n');
  
  // ===== TEST APPROACH 3: Multiple Patterns =====
  console.log('--- Approach 3: Multiple Patterns (including multi-lock) ---');
  
  console.log('Testing with ctx8 (LOCK_8):');
  acceptsMultiplePatterns(ctx8);
  
  console.log('Testing with ctx10 (LOCK_10):');
  acceptsMultiplePatterns(ctx10);
  
  console.log('Testing with ctx610 (LOCK_6 + LOCK_10):');
  acceptsMultiplePatterns(ctx610);
  console.log('✅ Accepts ctx610 because [6,10] is explicitly in the union\n');
  
  // ===== TEST APPROACH 4: Type Alias =====
  console.log('--- Approach 4: Reusable Type Alias ---');
  
  console.log('Testing with ctx8 (LOCK_8):');
  acceptsEitherLock(ctx8);
  
  console.log('Testing with ctx10 (LOCK_10):');
  acceptsEitherLock(ctx10);
  
  console.log('Type alias makes code more readable!\n');
  
  // ===== TEST APPROACH 5: Type Helper =====
  console.log('--- Approach 5: Generic Type Helper ---');
  
  console.log('Testing with ctx8 (LOCK_8):');
  acceptsLock8Or10_TypeHelper(ctx8);
  
  console.log('Testing with ctx10 (LOCK_10):');
  acceptsLock8Or10_TypeHelper(ctx10);
  
  console.log('Type helper allows programmatic union generation\n');
  
  // Cleanup
  ctx8.dispose();
  ctx10.dispose();
  ctx610.dispose();
  
  console.log('=== REAL-WORLD USE CASES ===\n');
  
  console.log('Use Case 1: Repository that works with different lock levels');
  console.log('  - Read-only operations: MESSAGE_LOCK [8]');
  console.log('  - Write operations: DATABASE_LOCK [10]');
  console.log('  Signature: context: IronGuardLockContext<readonly [8]> | IronGuardLockContext<readonly [10]>\n');
  
  console.log('Use Case 2: Service that accepts specific transaction patterns');
  console.log('  - Simple query: DATABASE_LOCK only [10]');
  console.log('  - User query: USER_LOCK + DATABASE_LOCK [6, 10]');
  console.log('  - Full transaction: WORLD + USER + DATABASE [4, 6, 10]');
  console.log('  Signature: context: IronGuardLockContext<readonly [10]> | IronGuardLockContext<readonly [6, 10]> | IronGuardLockContext<readonly [4, 6, 10]>\n');
  
  console.log('Use Case 3: Abstraction over multiple data sources');
  console.log('  - Database: [10]');
  console.log('  - Cache: [2]');
  console.log('  - Message queue: [8]');
  console.log('  Signature: context: IronGuardLockContext<readonly [2]> | IronGuardLockContext<readonly [8]> | IronGuardLockContext<readonly [10]>');
}

testMultipleLockTypes().catch(console.error);
