# Incremental Union Building for Lock Types

## YES! It Works in Principle

You can absolutely build up type aliases incrementally:

```typescript
// Level 1: Just [1]
type Has1 = IronGuardLockContext<readonly [1]>;

// Level 2: Add [2] - now accepts [1] OR [2]
type Has2 = 
  | Has1                                  // Reuse previous
  | IronGuardLockContext<readonly [2]>;  // Add new

// Level 3: Add [3] and combinations
type Foo3 = 
  | Has2                                    // [1] or [2]
  | IronGuardLockContext<readonly [3]>     // [3] alone
  | IronGuardLockContext<readonly [1, 3]>  // [1,3] combo
  | IronGuardLockContext<readonly [2, 3]>; // [2,3] combo
```

## ✅ Compile-Time Verification Works

```typescript
const ctx1 = await ctx.acquireRead(LOCK_1);    // [1]
const ctx2 = await ctx.acquireRead(LOCK_2);    // [2]
const ctx3 = await ctx.acquireRead(LOCK_3);    // [3]
const ctx13 = await ctx1.acquireRead(LOCK_3);  // [1, 3]
const ctx23 = await ctx2.acquireRead(LOCK_3);  // [2, 3]

function acceptsFoo3(context: Foo3): void { }

acceptsFoo3(ctx1);   // ✅ OK - [1] is in union
acceptsFoo3(ctx2);   // ✅ OK - [2] is in union
acceptsFoo3(ctx3);   // ✅ OK - [3] is in union
acceptsFoo3(ctx13);  // ✅ OK - [1,3] is in union
acceptsFoo3(ctx23);  // ✅ OK - [2,3] is in union
```

## ⚠️ BUT... It EXPLODES Exponentially!

### The Combinatorial Explosion

For N locks, the number of possible combinations is **2^N - 1** (all subsets except empty):

| Locks | Combinations | Formula |
|-------|--------------|---------|
| 1 | 1 | [1] |
| 2 | 3 | [1], [2], [1,2] |
| 3 | 7 | [1], [2], [3], [1,2], [1,3], [2,3], [1,2,3] |
| 4 | 15 | All singles + pairs + triples + quad |
| 5 | 31 | 💥 Getting big |
| 10 | **1,023** | 💥💥💥 TypeScript will cry |
| 15 | **32,767** | 💀 Don't even try |

### What Foo10 Would Look Like

```typescript
type Foo10 = 
  | IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [4]>
  | IronGuardLockContext<readonly [5]>
  | IronGuardLockContext<readonly [6]>
  | IronGuardLockContext<readonly [7]>
  | IronGuardLockContext<readonly [8]>
  | IronGuardLockContext<readonly [9]>
  | IronGuardLockContext<readonly [10]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [1, 4]>
  | IronGuardLockContext<readonly [1, 5]>
  // ... 1,013 more lines ...
  | IronGuardLockContext<readonly [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]>;
```

**1,023 union members!** 😱

### Real-World Impact

- ⏱️ **Compilation Time**: TypeScript will slow to a crawl
- 💾 **Memory Usage**: IDE will consume gigabytes
- 🐛 **Error Messages**: Impossible to read (shows entire union)
- 👨‍💻 **Developer Experience**: Nightmare

## 🎯 Practical Solutions

Instead of enumerating all combinations, use these patterns:

### 1️⃣ Define Only What You Actually Need

```typescript
// Don't enumerate everything - just your use cases
type DatabaseAccess = 
  | IronGuardLockContext<readonly [10]>        // Pure DB
  | IronGuardLockContext<readonly [6, 10]>     // User + DB
  | IronGuardLockContext<readonly [4, 6, 10]>; // World + User + DB

// 3 patterns instead of 1,023!
```

### 2️⃣ Use `Contains` for "Has Lock X" (Any Combination)

```typescript
// Accepts ANY context containing LOCK_10
function databaseOp<THeld extends readonly LockLevel[]>(
  context: Contains<THeld, 10> extends true ? LockContext<THeld> : never
): void {
  // Works with [10], [6,10], [4,6,10], etc.
  // No need to enumerate all combinations!
}
```

### 3️⃣ Use `ValidLockXContext` for "Can Acquire Lock X"

```typescript
// Accepts contexts that can acquire LOCK_10
function loadUser<THeld extends readonly LockLevel[]>(
  context: ValidLock10Context<THeld>
): Promise<User> {
  // Works with empty context, [1-9], [6], etc.
  // Automatically handles all valid cases!
}
```

### 4️⃣ Group by Semantic Meaning

```typescript
// Name types by what they DO, not what locks they hold
type ReadOnlyDatabase = IronGuardLockContext<readonly [10]>;
type UserTransaction = IronGuardLockContext<readonly [6, 10]>;
type FullTransaction = IronGuardLockContext<readonly [4, 6, 10]>;

type AnyDatabaseOperation = 
  | ReadOnlyDatabase 
  | UserTransaction 
  | FullTransaction;

// Self-documenting and maintainable!
```

## Summary

### The Question

> Can we build up type aliases incrementally like:
> ```
> Has1 = IronGuardLockContext<readonly [1]>
> Has2 = Has1 | IronGuardLockContext<readonly [2]>
> Foo3 = Has2 | ...
> ```

### The Answer

**YES!** ✅ It works in principle - TypeScript handles it perfectly.

**BUT!** ⚠️ It explodes exponentially:
- Foo3: 7 combinations ✅ Fine
- Foo4: 15 combinations ✅ Still OK
- Foo5: 31 combinations ⚠️ Getting unwieldy
- Foo10: 1,023 combinations 💥 TypeScript nightmare
- Foo15: 32,767 combinations 💀 Don't even try

### The Recommendation

**Don't enumerate all combinations!** Instead:

1. ✅ Define **only the patterns you need** (3-5 use cases)
2. ✅ Use **`Contains<THeld, X>`** for "must have lock X"
3. ✅ Use **`ValidLockXContext<THeld>`** for "can acquire lock X"
4. ✅ Name types by **semantic meaning** (ReadOnly, Transaction, etc.)

This gives you:
- ✅ Full type safety
- ✅ Fast compilation
- ✅ Readable error messages
- ✅ Maintainable code
- ✅ Happy developers

**In principle**: Yes, incremental building works!  
**In practice**: Use smarter patterns that don't explode!
