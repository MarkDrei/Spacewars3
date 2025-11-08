# Generated Lock Combinations

## Overview

This project uses a code generator to create all possible lock combinations for the IronGuard lock system. The generator produces type-safe, compile-time verified lock types that enable precise lock requirement specifications.

**Related:** See [Architecture Documentation](./architecture/arc42-architecture.md) section 8.1 (Lock Ordering) for the global lock hierarchy.

## Files

- **Generator**: `scripts/generate-lock-combinations.ts`
- **Generated Output**: `src/lib/server/generatedLockCombinations.ts` (AUTO-GENERATED, DO NOT EDIT)
- **Exports**: `src/lib/server/typedLocks.ts` re-exports all types with convenience aliases

## Lock Configuration

Current locks: `[2, 4, 6, 8, 10]`

Corresponds to:
- Lock 2: CACHE_LOCK
- Lock 4: WORLD_LOCK  
- Lock 6: USER_LOCK
- Lock 8: MESSAGE_LOCK
- Lock 10: DATABASE_LOCK

**Total combinations generated**: 31 (2^5 - 1)

## Generated Types

### Domain-Agnostic Types (Primary)

```typescript
// Individual locks
Only2, Only4, Only6, Only8, Only10

// Specific combinations  
Locks2_4, Locks6_10, Locks2_4_6_8_10, etc.

// Lock-specific unions
With2, With4, With6, With8, With10

// All combinations
AnyValidLockCombination
```

### Domain-Specific Aliases (Convenience)

```typescript
OnlyCache = Only2
OnlyWorld = Only4
OnlyUser = Only6
OnlyMessage = Only8
OnlyDatabase = Only10

WithCache = With2
WithWorld = With4
WithUser = With6
WithMessage = With8
WithDatabase = With10
```

## Usage Patterns

### Exact Lock Requirement
```typescript
// Requires EXACTLY DATABASE_LOCK, no other locks
function pureDbQuery(ctx: Only10): void { }
```

### Multiple Specific Patterns
```typescript
// Accepts [10] OR [6,10] OR [4,6,10]
function dbOperation(ctx: Only10 | Locks6_10 | Locks4_6_10): void { }
```

### Any Combination With Lock
```typescript
// Accepts any of the 16 combinations containing DATABASE_LOCK
function flexibleDbOp(ctx: With10): void { }
```

### Comparison with IronGuard Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `Only10` | Exactly one specific lock | Pure repository layer |
| `With10` | Any combo with lock 10 | Flexible operations |
| `ValidLock10Context<T>` | Can acquire lock 10 | Public APIs (IronGuard) |
| `Contains<T, 10>` | Already has lock 10 | Transaction internals (IronGuard) |

**Key Insight**: Generated types (`Only*`, `With*`) complement IronGuard's `ValidLock*Context` and `Contains<>` patterns by providing exact lock matching for architectural enforcement.

## Regeneration

```bash
npx tsx scripts/generate-lock-combinations.ts
```

Regenerate when:
- Adding/removing locks
- Changing lock numbers
- Updating generator logic

## Design Rationale

**Why generate?**
- 31 combinations: manageable but tedious to write manually
- No typos or missing combinations
- Easy to regenerate if lock configuration changes

**Why domain-agnostic?**
- Generator doesn't need project-specific knowledge
- Reusable across different projects
- Domain aliases added separately for convenience

**Performance impact**: Zero runtime cost (types only), minimal compile time (~2s for all 31 types)
