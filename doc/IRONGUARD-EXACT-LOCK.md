# IronGuard: Requiring EXACTLY One Specific Lock

## Summary

**YES! You can require EXACTLY one specific lock at compile time** with TypeScript.

## Three Working Approaches

### 1️⃣ SIMPLEST: Direct Type Match (Recommended)

```typescript
function requiresExactlyLock10(
  context: IronGuardLockContext<readonly [10]>
): void {
  // Context must have EXACTLY lock 10, no more, no less
}
```

**Pros:**
- ✅ Simplest syntax
- ✅ Clear intent
- ✅ Compile-time enforced
- ✅ No helper types needed

**Cons:**
- ⚠️ Not generic (can't return different types based on held locks)

### 2️⃣ GENERIC: With Type Constraint

```typescript
function requiresExactlyLock10_Generic<THeld extends readonly [10]>(
  context: IronGuardLockContext<THeld>
): void {
  // Generic but constrained to exactly [10]
}
```

**Pros:**
- ✅ Still simple
- ✅ Generic (can use THeld in return types)
- ✅ Compile-time enforced

**Cons:**
- ⚠️ Slightly more verbose

### 3️⃣ EXPLICIT: Custom Type Check

```typescript
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
  // Explicit length check + lock presence check
}
```

**Pros:**
- ✅ Most explicit about requirements
- ✅ Reusable for any lock level
- ✅ Self-documenting

**Cons:**
- ❌ Most complex
- ❌ Resolves to `never` on mismatch (worse error messages)

## Compile-Time Verification

All three approaches **successfully reject** invalid contexts at compile time:

```typescript
const ctx10 = await ctx.acquireRead(LOCK_10);        // LockContext<readonly [10]>
const ctx610 = await ctx6.acquireRead(LOCK_10);      // LockContext<readonly [6, 10]>
const ctx2 = await createLockContext().acquireRead(LOCK_2);  // LockContext<readonly [2]>

// ✅ ACCEPTS: Context with EXACTLY lock 10
requiresExactlyLock10(ctx10);        // OK
requiresExactlyLock10_Generic(ctx10); // OK
requiresExactlyLock10_Explicit(ctx10); // OK

// ❌ REJECTS: Context with multiple locks
requiresExactlyLock10(ctx610);
// Error: Argument of type 'LockContext<readonly [6, 10]>' 
//        is not assignable to parameter of type 'LockContext<readonly [10]>'

// ❌ REJECTS: Wrong lock
requiresExactlyLock10(ctx2);
// Error: Argument of type 'LockContext<readonly [2]>' 
//        is not assignable to parameter of type 'LockContext<readonly [10]>'
```

## Comparison: Exact vs Contains vs ValidLock

| Pattern | Accepts | Use Case |
|---------|---------|----------|
| `IronGuardLockContext<readonly [10]>` | **ONLY** `[10]` | Private methods that need pure isolation |
| `Contains<THeld, 10> extends true ? ... : never` | `[10]`, `[6,10]`, `[2,6,10]`, etc. | Methods requiring lock 10 **already held** |
| `ValidLock10Context<THeld>` | Empty, `[1-9]`, `[10]`, `[6,10]`, etc. | Methods that **will acquire** lock 10 |
| `IronGuardLockContext<readonly LockLevel[]>` | **ANY** combination | No compile-time checking (runtime only) |

## Real-World Use Cases for EXACT Lock Requirement

### When to use `readonly [10]`:

1. **Pure database operations** that should ONLY interact with DB, not other locks:
   ```typescript
   // Repository layer - should only access database
   function executeSqlQuery(
     query: string,
     context: IronGuardLockContext<readonly [10]>  // ONLY database lock
   ): Promise<any> {
     // Ensures this function ONLY has database access
     // Cannot accidentally access cache, world, or user data
   }
   ```

2. **Isolation testing** - ensure a function only uses one specific resource:
   ```typescript
   // Test that function doesn't leak into other systems
   function pureBusinessLogic(
     data: Data,
     context: IronGuardLockContext<readonly [5]>  // ONLY business lock
   ): Result {
     // Guaranteed not to touch database, cache, or network
   }
   ```

3. **Strict layering** - enforce architectural boundaries:
   ```typescript
   // Data access layer - can ONLY hold database lock
   class DataAccessLayer {
     query(
       sql: string,
       context: IronGuardLockContext<readonly [10]>
     ): Promise<Row[]> {
       // Architectural enforcement: DAL cannot hold other locks
     }
   }
   ```

### When NOT to use `readonly [10]`:

- ❌ When function is part of a larger transaction (use `Contains`)
- ❌ When function needs to coordinate with other systems (use `ValidLock`)
- ❌ When lock is acquired internally (use `ValidLock`)

## Recommendation for Spacewars3

Based on our codebase analysis, we should use:

1. **`ValidLock10Context<THeld>`** - For public APIs that acquire lock internally
2. **`Contains<THeld, 10> extends true ? ... : never`** - For internal methods in transactions
3. **`IronGuardLockContext<readonly [10]>`** - For pure repository functions (if we want strict isolation)

Currently we're using `IronGuardLockContext<readonly LockLevel[]>` which provides **zero compile-time safety**. We should migrate to one of the above patterns.

## Code Examples

### Example 1: Repository with EXACT lock requirement

```typescript
// Pure repository - only database operations allowed
export function getUserByIdFromDb_Pure(
  db: sqlite3.Database,
  id: number,
  context: IronGuardLockContext<readonly [10]>  // EXACT: only DATABASE_LOCK
): Promise<User | null> {
  // This function is architecturally isolated
  // Cannot accidentally interact with cache or other systems
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row ? userFromRow(row) : null);
    });
  });
}
```

### Example 2: Transaction with Contains (lock already held)

```typescript
// Part of larger transaction - needs DATABASE_LOCK + USER_LOCK
async function updateUserInTransaction<THeld extends readonly LockLevel[]>(
  userId: number,
  context: Contains<THeld, 10> extends true ? IronGuardLockContext<THeld> : never
): Promise<void> {
  // Caller already holds DATABASE_LOCK (and possibly others)
  // We just use it, don't acquire/release
  const user = await getUserByIdFromDb_Contains(db, userId, context);
  user.update();
  await saveUserToDb(db, user, context);
}
```

### Example 3: Public API with ValidLock (will acquire)

```typescript
// Public API - acquires lock internally
async function loadUserPublic<THeld extends readonly LockLevel[]>(
  userId: number,
  context: ValidLock10Context<THeld>
): Promise<User | null> {
  // Acquire DATABASE_LOCK internally
  const dbCtx = await (context as IronGuardLockContext<THeld>).acquireRead(DATABASE_LOCK);
  try {
    return await getUserByIdFromDb_Pure(db, userId, dbCtx);
  } finally {
    dbCtx.dispose();
  }
}
```

## Conclusion

**YES** - You can require EXACTLY one specific lock at compile time!

The simplest approach is:
```typescript
function myFunction(context: IronGuardLockContext<readonly [10]>): void
```

This provides **strong compile-time guarantees** that the function receives a context with **only and exactly** the specified lock.
