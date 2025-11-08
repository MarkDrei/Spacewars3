// Test to understand what IronGuardLockContext<readonly LockLevel[]> accepts

import { 
  createLockContext, 
  LOCK_6, 
  LOCK_10, 
  LOCK_2,
  type LockContext, 
  type LockLevel 
} from './src/lib/server/typedLocks';
import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Pattern 3: Simple type (what we're currently using)
function requiresLock10_Simple(
  context: IronGuardLockContext<readonly LockLevel[]>
): void {
  console.log('✅ Simple pattern accepted context');
}

// Test: What does IronGuardLockContext<readonly LockLevel[]> accept?
async function testWhatIsAccepted() {
  console.log('\n=== Testing IronGuardLockContext<readonly LockLevel[]> ===\n');
  
  const ctx = createLockContext();
  
  // Test 1: Empty context (no locks held)
  console.log('Test 1: Empty context (no locks)');
  try {
    requiresLock10_Simple(ctx);
    console.log('✅ ACCEPTS empty context - NO COMPILE ERROR');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  // Test 2: Context with only LOCK_2 (not LOCK_10)
  console.log('\nTest 2: Context with LOCK_2 (not LOCK_10)');
  const ctx2 = await ctx.acquireRead(LOCK_2);
  try {
    requiresLock10_Simple(ctx2);
    console.log('✅ ACCEPTS context with LOCK_2 - NO COMPILE ERROR');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  // Test 3: Context with LOCK_6 only (not LOCK_10)
  console.log('\nTest 3: Context with LOCK_6 (not LOCK_10)');
  const ctx6 = await ctx.acquireRead(LOCK_6);
  try {
    requiresLock10_Simple(ctx6);
    console.log('✅ ACCEPTS context with LOCK_6 - NO COMPILE ERROR');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  // Test 4: Context with LOCK_10 only
  console.log('\nTest 4: Context with LOCK_10');
  const ctx10 = await createLockContext().acquireRead(LOCK_10);
  try {
    requiresLock10_Simple(ctx10);
    console.log('✅ ACCEPTS context with LOCK_10 - NO COMPILE ERROR');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  // Test 5: Context with LOCK_6 + LOCK_10
  console.log('\nTest 5: Context with LOCK_6 + LOCK_10');
  const ctx610 = await ctx6.acquireRead(LOCK_10);
  try {
    requiresLock10_Simple(ctx610);
    console.log('✅ ACCEPTS context with LOCK_6 + LOCK_10 - NO COMPILE ERROR');
  } catch (e) {
    console.log('❌ Runtime error:', e);
  }
  
  console.log('\n=== CONCLUSION ===');
  console.log('IronGuardLockContext<readonly LockLevel[]> accepts ANY context');
  console.log('It does NOT check if LOCK_10 is held!');
  console.log('It\'s equivalent to "any lock combination" - no compile-time safety');
  
  // Cleanup
  ctx610.dispose();
  ctx10.dispose();
  ctx2.dispose();
}

testWhatIsAccepted().catch(console.error);
