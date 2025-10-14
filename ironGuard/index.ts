/**
 * IronGuard System Demo
 * 
 * This demonstrates a compile-time lock ordering system that allows:
 * 1. Skipping locks (1→3, 1→5, direct acquisition of any lock)
 * 2. Passing lock contexts between functions with validation
 * 3. Compile-time prevention of lock ordering violations
 */

import { 
  createLockContext, 
  LOCK_1, 
  LOCK_2, 
  LOCK_3, 
  LOCK_4, 
  LOCK_5 
} from './ironGuardSystem';

import {
  functionRequiringLock2,
  demonstrateLockSkipping,
  flexibleLock3Function
} from './examples';

function main(): void {
  console.log('�️ IronGuard System\n');
  console.log('This system demonstrates compile-time lock ordering validation');
  console.log('with unbreakable protection and flexible acquisition patterns.\n');
  
  // Basic lock operations
  console.log('=== Basic Lock Operations ===');
  
  // Show valid acquisitions
  const ctx1 = createLockContext();
  const withLock1 = ctx1.acquire(LOCK_1);
  const withLock1And4 = withLock1.acquire(LOCK_4);
  const directLock3 = createLockContext().acquire(LOCK_3);
  
  console.log(`✅ Empty → Lock 1: ${withLock1.toString()}`);
  console.log(`✅ Lock 1 → Lock 4: ${withLock1And4.toString()}`);
  console.log(`✅ Direct Lock 3: ${directLock3.toString()}`);
  
  // Function parameter validation
  console.log('\n=== Function Parameter Validation ===');
  
  const ctxWithLock2 = createLockContext().acquire(LOCK_2);
  console.log('Calling function that requires lock 2:');
  functionRequiringLock2(ctxWithLock2);
  
  // Flexible lock 3 function examples
  console.log('\n=== Flexible Lock 3 Function ===');
  
  const emptyCtx = createLockContext();
  const flexCtxWithLock1 = createLockContext().acquire(LOCK_1);
  const flexCtxWithLock3 = createLockContext().acquire(LOCK_3);
  
  console.log('Different scenarios:');
  flexibleLock3Function(emptyCtx);          // Acquires lock 3
  flexibleLock3Function(flexCtxWithLock1);  // Acquires lock 3 
  flexibleLock3Function(flexCtxWithLock3);  // Uses existing lock 3
  
  // More examples
  demonstrateLockSkipping();
  
  console.log('\n=== Key Benefits ===');
  console.log('✓ Compile-time lock ordering validation');
  console.log('✓ Flexible lock acquisition patterns');
  console.log('✓ Type-safe function parameter constraints');
  console.log('✓ Zero runtime overhead');
  
  console.log('\n💡 Try uncommenting invalid operations in the source files');
  console.log('   to see TypeScript prevent lock ordering violations!');
}

// Run the demo
if (require.main === module) {
  main();
}

export { main };