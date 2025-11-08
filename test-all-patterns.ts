// Practical Example: All Three Lock Patterns in Action

import { 
  createLockContext, 
  LOCK_6, 
  LOCK_10,
  DATABASE_LOCK,
  USER_LOCK,
  type LockLevel,
  type Contains,
  type ValidLock10Context
} from './src/lib/server/typedLocks';
import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// ===== PATTERN 1: EXACT - Pure repository layer =====
// Use case: Architectural isolation, can ONLY access database
class PureRepository {
  queryUser(
    userId: number,
    context: IronGuardLockContext<readonly [10]>  // EXACT: only DATABASE_LOCK
  ): Promise<string> {
    console.log('  🗄️  Pure repository: Querying database (EXACT lock 10)');
    // Architectural guarantee: this function CANNOT access cache, user data, etc.
    return Promise.resolve(`User ${userId} from DB`);
  }
}

// ===== PATTERN 2: CONTAINS - Internal transaction method =====
// Use case: Part of larger operation, lock already held
class TransactionService {
  async updateUserTransaction<THeld extends readonly LockLevel[]>(
    userId: number,
    context: Contains<THeld, 10> extends true ? IronGuardLockContext<THeld> : never
  ): Promise<void> {
    console.log('  📦 Transaction service: Using already-held lock');
    // Assumes caller already holds DATABASE_LOCK (and possibly others)
    // We just use it, don't acquire/release
    const repo = new PureRepository();
    await repo.queryUser(userId, context as IronGuardLockContext<readonly [10]>);
    console.log('  📦 Transaction service: Updating data');
  }
}

// ===== PATTERN 3: VALIDLOCK - Public API =====
// Use case: Public method that acquires lock internally
class PublicAPI {
  async loadUser<THeld extends readonly LockLevel[]>(
    userId: number,
    context: ValidLock10Context<THeld>  // Can acquire lock 10
  ): Promise<string> {
    console.log('🌐 Public API: Acquiring DATABASE_LOCK');
    
    // Acquire DATABASE_LOCK internally
    const dbCtx = await (context as IronGuardLockContext<THeld>).acquireRead(DATABASE_LOCK);
    try {
      const repo = new PureRepository();
      const user = await repo.queryUser(userId, dbCtx);
      return user;
    } finally {
      dbCtx.dispose();
      console.log('🌐 Public API: Released DATABASE_LOCK');
    }
  }
}

// ===== DEMONSTRATION =====
async function demonstrateAllPatterns() {
  console.log('\n=== Demonstrating All Three Lock Patterns ===\n');
  
  const repo = new PureRepository();
  const transactionService = new TransactionService();
  const publicAPI = new PublicAPI();
  
  // ===== SCENARIO 1: Using Public API (VALIDLOCK pattern) =====
  console.log('📋 Scenario 1: External caller using public API');
  console.log('Caller has no locks, API handles everything\n');
  
  const ctx = createLockContext();
  const result1 = await publicAPI.loadUser(123, ctx);
  console.log(`✅ Result: ${result1}\n`);
  
  // ===== SCENARIO 2: Complex Transaction (CONTAINS pattern) =====
  console.log('📋 Scenario 2: Complex transaction with multiple operations');
  console.log('Need to hold DATABASE_LOCK across multiple calls\n');
  
  const userCtx = await ctx.acquireRead(USER_LOCK);
  console.log('🔐 Acquired USER_LOCK');
  
  const dbCtx = await userCtx.acquireRead(DATABASE_LOCK);
  console.log('🔐 Acquired DATABASE_LOCK');
  
  try {
    // Multiple operations under same lock
    await transactionService.updateUserTransaction(123, dbCtx);
    await transactionService.updateUserTransaction(456, dbCtx);
    console.log('✅ Transaction complete\n');
  } finally {
    dbCtx.dispose();
    console.log('🔓 Released DATABASE_LOCK');
  }
  
  userCtx.dispose();
  console.log('🔓 Released USER_LOCK\n');
  
  // ===== SCENARIO 3: Direct repository access (EXACT pattern) =====
  console.log('📋 Scenario 3: Direct repository access for testing');
  console.log('Test needs isolation - ONLY database access\n');
  
  const pureDbCtx = await createLockContext().acquireRead(DATABASE_LOCK);
  console.log('🔐 Acquired EXACTLY DATABASE_LOCK (no other locks)');
  
  const result3 = await repo.queryUser(789, pureDbCtx);
  console.log(`✅ Result: ${result3}`);
  
  pureDbCtx.dispose();
  console.log('🔓 Released DATABASE_LOCK\n');
  
  // ===== COMPILE-TIME SAFETY DEMONSTRATION =====
  console.log('📋 Compile-time safety checks:\n');
  
  console.log('✅ VALID calls:');
  console.log('  - publicAPI.loadUser(ctx) - can acquire lock');
  console.log('  - transactionService.updateUserTransaction(dbCtx) - already has lock');
  console.log('  - repo.queryUser(pureDbCtx) - exactly lock 10\n');
  
  console.log('❌ INVALID calls (would fail at compile time):');
  console.log('  - repo.queryUser(dbCtx) - has [6, 10], needs [10]');
  console.log('  - transactionService.updateUserTransaction(userCtx) - missing lock 10');
  console.log('  - publicAPI.loadUser(dbCtx) - already has lock 10, can\'t acquire again');
  
  console.log('\n=== SUMMARY ===');
  console.log('1️⃣  EXACT (readonly [10]): Pure isolation, architecture enforcement');
  console.log('2️⃣  CONTAINS: Transactions, lock already held');
  console.log('3️⃣  VALIDLOCK: Public APIs, will acquire lock');
}

demonstrateAllPatterns().catch(console.error);
