// Verify compile-time errors for EXACT lock requirement

import { 
  createLockContext, 
  LOCK_6, 
  LOCK_10,
  LOCK_2,
  type LockLevel 
} from './src/lib/server/typedLocks';
import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// ===== THE SIMPLEST: Exact type match =====
function requiresExactlyLock10(
  context: IronGuardLockContext<readonly [10]>
): void {
  console.log('Has EXACTLY lock 10');
}

// ===== MORE FLEXIBLE: Generic with constraint =====
function requiresExactlyLock10_Generic<THeld extends readonly [10]>(
  context: IronGuardLockContext<THeld>
): void {
  console.log('Has EXACTLY lock 10 (generic)');
}

// ===== EXPLICIT CHECK: Length + Contains =====
type Contains<T extends readonly unknown[], U> = 
  T extends readonly [infer First, ...infer Rest] 
    ? First extends U ? true : Contains<Rest, U> 
    : false;

type HasExactlyOneLock<THeld extends readonly LockLevel[], Lock extends LockLevel> = 
  THeld['length'] extends 1 
    ? Contains<THeld, Lock> extends true ? true : false 
    : false;

function requiresExactlyLock10_Explicit<THeld extends readonly LockLevel[]>(
  context: HasExactlyOneLock<THeld, 10> extends true 
    ? IronGuardLockContext<THeld> 
    : never
): void {
  console.log('Has EXACTLY lock 10 (explicit check)');
}

async function demonstrateCompileTimeChecks() {
  const ctx = createLockContext();
  
  // ✅ VALID: Context with EXACTLY lock 10
  const ctx10 = await ctx.acquireRead(LOCK_10);
  requiresExactlyLock10(ctx10);
  requiresExactlyLock10_Generic(ctx10);
  requiresExactlyLock10_Explicit(ctx10);
  console.log('✅ All three accept ctx10 (LOCK_10 only)\n');
  
  // ❌ INVALID: Context with multiple locks
  const ctx6 = await ctx.acquireRead(LOCK_6);
  const ctx610 = await ctx6.acquireRead(LOCK_10);
  
  // Uncomment these lines to see TypeScript compile errors:
  
  // requiresExactlyLock10(ctx610);
  // ❌ Error: Argument of type 'LockContext<readonly [6, 10]>' 
  //           is not assignable to parameter of type 'LockContext<readonly [10]>'
  
  // requiresExactlyLock10_Generic(ctx610);
  // ❌ Error: Type 'readonly [6, 10]' does not satisfy the constraint 'readonly [10]'
  
  // requiresExactlyLock10_Explicit(ctx610);
  // ❌ Error: Argument of type 'LockContext<readonly [6, 10]>' 
  //           is not assignable to parameter of type 'never'
  
  // ❌ INVALID: Wrong lock
  const ctx2 = await createLockContext().acquireRead(LOCK_2);
  
  // requiresExactlyLock10(ctx2);
  // ❌ Error: Argument of type 'LockContext<readonly [2]>' 
  //           is not assignable to parameter of type 'LockContext<readonly [10]>'
  
  console.log('⚠️  Multiple compile errors would occur if invalid calls were uncommented');
  
  // Cleanup
  ctx10.dispose();
  ctx610.dispose();
  ctx2.dispose();
}

demonstrateCompileTimeChecks().catch(console.error);
