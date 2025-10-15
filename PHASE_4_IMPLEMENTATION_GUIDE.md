# Phase 4-7 Implementation Guide

## Current Status

### ✅ Completed (Phases 0-3 + worldRepoV2)
- Phase 0: Preparation and documentation
- Phase 1: ironGuardV2.ts, ironGuardTypesV2.ts
- Phase 2: lockHelpers.ts with 23 passing tests
- Phase 3: TypedCacheManagerV2 fully implemented
- **Phase 4 (Partial)**: worldRepoV2.ts complete

### 🔄 Remaining Work

#### Phase 4: Repository Layer (4 remaining)
1. **userRepoV2.ts** (~80 lines needed)
2. **messagesRepoV2.ts** (~100 lines needed)
3. **battleRepoV2.ts** (~120 lines needed)  
4. **techRepoV2.ts** (~60 lines needed)

#### Phase 5: Service Layer (4 files)
1. **battleServiceV2.ts** (~200 lines)
2. **worldDomainV2.ts** (if needed)
3. **userDomainV2.ts** (if needed)

#### Phase 6: API Routes (13+ routes)
All routes in `src/app/api/` need context threading

#### Phase 7: Cleanup
- Remove old files
- Rename V2 → primary
- Update all imports

## Implementation Pattern (Established)

### Public API Functions (No Context Parameter)

```typescript
export async function operationName(
  param1: Type1,
  param2: Type2
): Promise<ReturnType> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  const ctx = createLockContext();
  
  return withRequiredLock(ctx, async (lockCtx) => {
    return cacheManager.operationUnsafe(param1, param2, lockCtx);
  });
}
```

### Advanced API Functions (Accept Context)

```typescript
export async function operationWithContext<THeld extends readonly LockLevel[]>(
  param1: Type1,
  context: ValidLockContext<THeld>
): Promise<ReturnType> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cacheManager.operationUnsafe(param1, context as any);
}
```

### Internal Functions (No Migration)

Database I/O functions that are called internally by cache manager don't need migration:
- `loadXFromDb(db, ...)`
- `saveXToDb(db, ...)`

## Detailed Migration Steps

### Step 1: userRepoV2.ts

**Functions to migrate:**
- `getUserById()` → Create own context, use `withUserLock`
- `getUserByUsername()` → Already handled by cacheManager
- `createUser()` → Create own context, use `withUserLock` + `withDatabaseLock`
- `updateUser()` → Create own context, use `withUserLock`
- `deleteUser()` → Create own context, use `withUserLock` + `withDatabaseLock`

**Functions NOT to migrate (internal):**
- `getUserByIdFromDb()` - Called by cache manager
- `getUserByUsernameFromDb()` - Called by cache manager
- `userFromRow()` - Helper function

**Example:**
```typescript
export async function getUserById(id: number): Promise<User | null> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // Try cache-only first (may be already loaded)
  return await cacheManager.loadUserIfNeeded(id);
}
```

### Step 2: messagesRepoV2.ts

**Lock Requirements:**
- Read operations: `LOCK_MESSAGE_READ (40)`
- Write operations: `LOCK_MESSAGE_WRITE (41)`

**Functions to migrate:**
- `getMessagesForUser()` → Use `withMessageReadLock`
- `markMessageAsRead()` → Use `withMessageWriteLock`
- `sendMessage()` → Use `withMessageWriteLock`
- `deleteMessage()` → Use `withMessageWriteLock`

**Note:** Messages may need MESSAGE operations added to TypedCacheManagerV2

### Step 3: battleRepoV2.ts

**Lock Requirements:**
- Battle operations: `LOCK_BATTLE (50)`

**Functions to migrate:**
- `getBattle()` → Use `withBattleLock`
- `createBattle()` → Use `withBattleLock` + `withDatabaseLock`
- `updateBattle()` → Use `withBattleLock`
- `deleteBattle()` → Use `withBattleLock` + `withDatabaseLock`

**Example:**
```typescript
export async function getBattle(battleId: number): Promise<Battle | null> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  return await cacheManager.loadBattleIfNeeded(battleId);
}
```

### Step 4: techRepoV2.ts

**Lock Requirements:**
- Tech tree operations: `LOCK_USER (30)` (since tech is user-specific)

**Functions to migrate:**
- `getTechTree()` → Use `withUserLock`
- `updateTechTree()` → Use `withUserLock`

This is the simplest repository.

### Step 5: Service Layer Migration

**battleServiceV2.ts:**
- All functions accept context from API routes
- Thread context through to repository calls
- Example:
```typescript
export async function startBattle<THeld extends readonly LockLevel[]>(
  attackerId: number,
  defenderId: number,
  context: ValidBattleLockContext<THeld>
): Promise<Battle> {
  // Use existing context, acquire additional locks as needed
  return withBattleLock(context, async (battleCtx) => {
    return withUserLock(battleCtx, async (userCtx) => {
      // Access user and battle data
    });
  });
}
```

### Step 6: API Route Migration

Each API route should:
1. Create empty context: `const ctx = createLockContext()`
2. Pass context to service/repo functions
3. Let lower layers acquire necessary locks

**Example route:**
```typescript
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.userId) {
    throw new ApiError('Not authenticated', 401);
  }
  
  const ctx = createLockContext();
  
  // Service/repo functions will acquire needed locks
  const data = await serviceFunction(session.userId, ctx);
  
  return NextResponse.json(data);
}
```

### Step 7: Testing Strategy

After each repository migration:
```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Run specific tests
npm test -- userRepo  # or appropriate test file

# 3. Run full test suite
npm test -- --run

# 4. Lint
npm run lint
```

## Common Pitfalls

### 1. Lock Order Violations

**Problem:** Acquiring locks in wrong order
```typescript
// ❌ WRONG: DATABASE before USER
withDatabaseLock(ctx, async (dbCtx) => {
  withUserLock(dbCtx, async (userCtx) => { ... });
});
```

**Solution:** Follow hierarchy (10 < 20 < 30 < 40 < 41 < 50 < 60)
```typescript
// ✅ CORRECT: USER before DATABASE
withUserLock(ctx, async (userCtx) => {
  withDatabaseLock(userCtx, async (dbCtx) => { ... });
});
```

### 2. Re-acquiring Same Lock

**Problem:** Trying to acquire same lock twice
```typescript
// ❌ WRONG: Acquiring USER lock twice
withUserLock(ctx, async (userCtx) => {
  withUserLock(userCtx, async (userCtx2) => { ... });
});
```

**Solution:** Use existing lock context
```typescript
// ✅ CORRECT: Use existing lock
withUserLock(ctx, async (userCtx) => {
  // Just use userCtx, don't re-acquire
  cacheManager.getUserUnsafe(userId, userCtx);
});
```

### 3. Type Assertions

Sometimes TypeScript's inference is too strict. Use `as any` with comment:
```typescript
// Type assertion: we know this is safe because...
// eslint-disable-next-line @typescript-eslint/no-explicit-any
return cacheManager.operationUnsafe(param, context as any);
```

## Validation Checklist

Before marking a phase complete:

- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Tests pass: `npm test -- --run`
- [ ] Linting passes: `npm run lint`
- [ ] No lock order violations detected
- [ ] Functions follow established pattern
- [ ] Documentation updated

## Time Estimates

Based on Phase 3 experience:

| Task | Estimated Time |
|------|----------------|
| userRepoV2.ts | 1.5 hours |
| messagesRepoV2.ts | 2 hours |
| battleRepoV2.ts | 2 hours |
| techRepoV2.ts | 1 hour |
| **Phase 4 Total** | **6.5 hours** |
| battleServiceV2.ts | 3 hours |
| Other services | 2 hours |
| **Phase 5 Total** | **5 hours** |
| API routes (13+) | 8-10 hours |
| **Phase 6 Total** | **8-10 hours** |
| Cleanup & validation | 3 hours |
| **Phase 7 Total** | **3 hours** |
| **Grand Total** | **22.5-24.5 hours** |

## Quick Reference

### Lock Hierarchy
```
LOCK_CACHE    = 10  (Cache management)
LOCK_WORLD    = 20  (World operations)
LOCK_USER     = 30  (User operations)
LOCK_MESSAGE_READ  = 40  (Message reading)
LOCK_MESSAGE_WRITE = 41  (Message writing)
LOCK_BATTLE   = 50  (Battle operations)
LOCK_DATABASE = 60  (Database access)
```

### Import Statements
```typescript
import { createLockContext, type LockLevel } from './ironGuardV2';
import type { ValidUserLockContext } from './ironGuardTypesV2';
import { withUserLock, withDatabaseLock } from './lockHelpers';
import { getTypedCacheManagerV2 } from './typedCacheManagerV2';
```

### Test Pattern
```typescript
describe('Repository V2', () => {
  test('operation_scenario_expectedResult', async () => {
    // Arrange
    const ctx = createLockContext();
    
    // Act
    const result = await operation(param, ctx);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

## Next Steps

1. **Continue Phase 4**: Implement remaining repositories
2. **Phase 5**: Migrate service layer
3. **Phase 6**: Update API routes
4. **Phase 7**: Clean up and finalize

The foundation established in Phases 1-3 makes the remaining work straightforward. Each repository and service follows the same pattern demonstrated in worldRepoV2 and TypedCacheManagerV2.
