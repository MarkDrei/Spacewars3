# Phase 6: API Routes Migration Guide

## Overview

Phase 6 involves migrating 21 API routes from the old lock system to IronGuard V2. This guide provides patterns and examples for systematic migration.

## Migration Strategy

### Approach: In-Place Migration

Update existing route files to use V2 systems:
- Import from `ironGuardV2.ts` instead of `ironGuardSystem.ts`
- Import from `typedCacheManagerV2.ts` instead of `typedCacheManager.ts`
- Import from `lockHelpers.ts` for lock acquisition
- Use V2 repository functions where applicable

### Benefits

- No need to create duplicate routes
- Gradual migration route by route
- Can test each route independently
- V2 repositories coexist with old ones

## API Routes Inventory

Total: 21 routes

### User/Auth Routes (Low Priority - No Lock Migration Needed)
1. `/api/login` - Authentication
2. `/api/logout` - Authentication
3. `/api/register` - User registration
4. `/api/session` - Session management

### Game State Routes (High Priority)
5. `/api/user-stats` - User statistics ⭐
6. `/api/ship-stats` - Ship information ⭐
7. `/api/world` - World data ⭐

### Game Action Routes (High Priority)
8. `/api/collect-typed` - Collection operations ⭐
9. `/api/navigate-typed` - Navigation ⭐
10. `/api/navigate` - Navigation (old)
11. `/api/harvest` - Resource harvesting ⭐

### Battle Routes (High Priority)
12. `/api/attack` - Battle initiation ⭐
13. `/api/battle-status` - Battle state ⭐

### Tech/Building Routes (Medium Priority)
14. `/api/build-item` - Tech building
15. `/api/build-status` - Build queue status
16. `/api/complete-build` - Build completion
17. `/api/techtree` - Tech tree access
18. `/api/tech-catalog` - Tech catalog
19. `/api/trigger-research` - Research operations

### Message Routes (Medium Priority)
20. `/api/messages` - Messaging

### Admin Routes (Low Priority)
21. `/api/admin/database` - Database admin

## Migration Patterns

### Pattern 1: Simple Data Fetch (user-stats, ship-stats)

**Before (Old System):**
```typescript
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { createEmptyContext } from '@/lib/server/ironGuardSystem';

export async function GET(request: NextRequest) {
  const cacheManager = getTypedCacheManager();
  await cacheManager.initialize();
  const emptyCtx = createEmptyContext();
  
  return await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
    const user = cacheManager.getUserUnsafe(userId, userCtx);
    // ...
  });
}
```

**After (V2 System):**
```typescript
import { getTypedCacheManagerV2 } from '@/lib/server/typedCacheManagerV2';
import { createLockContext } from '@/lib/server/ironGuardV2';
import { withUserLock } from '@/lib/server/lockHelpers';

export async function GET(request: NextRequest) {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  const ctx = createLockContext();
  
  return await withUserLock(ctx, async (userCtx) => {
    const user = await cacheManager.loadUserIfNeeded(userId);
    // ...
  });
}
```

### Pattern 2: Multi-Lock Operations (ship-stats with world + user)

**Before (Old System):**
```typescript
return await cacheManager.withWorldRead(emptyCtx, async (worldCtx) => {
  return await cacheManager.withUserLock(worldCtx, async (userCtx) => {
    const world = cacheManager.getWorldUnsafe(userCtx);
    const user = cacheManager.getUserUnsafe(userId, userCtx);
    // ...
  });
});
```

**After (V2 System):**
```typescript
return await withWorldLock(ctx, async (worldCtx) => {
  return await withUserLock(worldCtx, async (userCtx) => {
    const world = cacheManager.getWorldUnsafe(worldCtx);
    const user = await cacheManager.loadUserIfNeeded(userId);
    // ...
  });
});
```

### Pattern 3: Battle Operations (attack, battle-status)

**Before (Old System):**
```typescript
import { BattleService } from '@/lib/server/battleService';

// Battle operations using old service
const battle = await BattleService.initiateBattle(attacker, attackee);
```

**After (V2 System):**
```typescript
import * as BattleServiceV2 from '@/lib/server/battleServiceV2';

// Battle operations using V2 service
const battle = await BattleServiceV2.initiateBattle(attacker, attackee);
```

### Pattern 4: Write Operations (collect, navigate, harvest)

**Before (Old System):**
```typescript
return await cacheManager.withWorldWrite(emptyCtx, async (worldCtx) => {
  return await cacheManager.withUserLock(worldCtx, async (userCtx) => {
    // Modify world and user
  });
});
```

**After (V2 System):**
```typescript
return await withWorldLock(ctx, async (worldCtx) => {
  return await withUserLock(worldCtx, async (userCtx) => {
    // Modify world and user
    // Note: World lock is always acquired before User lock
  });
});
```

## Lock Ordering Rules

**Always follow this hierarchy:**
```
CACHE(10) < WORLD(20) < USER(30) < MESSAGE_READ(40) < 
MESSAGE_WRITE(41) < BATTLE(50) < DATABASE(60)
```

**Common patterns by route type:**
- User stats: USER(30)
- Ship stats: WORLD(20) → USER(30)
- World operations: WORLD(20)
- Battle operations: Use battleServiceV2 (handles locks internally)
- Messages: MESSAGE_WRITE(41)

## Migration Checklist

For each route:

1. [ ] Update imports
   - `ironGuardSystem` → `ironGuardV2`
   - `typedCacheManager` → `typedCacheManagerV2`
   - Add `lockHelpers` imports

2. [ ] Update context creation
   - `createEmptyContext()` → `createLockContext()`

3. [ ] Update lock acquisition
   - `cacheManager.withXLock()` → `withXLock()` from helpers

4. [ ] Update repository calls
   - Use V2 repositories where available
   - Use cache manager's `loadXIfNeeded()` methods

5. [ ] Test the route
   - Manual testing
   - Check TypeScript compilation
   - Verify lock ordering

6. [ ] Update route documentation (if any)

## Testing Strategy

### Per-Route Testing

After migrating each route:

```bash
# 1. Check compilation
npx tsc --noEmit

# 2. Run relevant tests
npm test -- <route-test-file>

# 3. Manual test with curl/Postman
# Example:
curl -X GET http://localhost:3000/api/user-stats \
  -H "Cookie: session=..."
```

### Integration Testing

After migrating a group of related routes:

```bash
# Run full test suite
npm test -- --run

# Check linting
npm run lint

# Run dev server and test manually
npm run dev
```

## Priority Order

### Phase 6.1: Core Game State (Priority 1)
1. `/api/user-stats` - User data
2. `/api/ship-stats` - Ship data
3. `/api/world` - World data

### Phase 6.2: Game Actions (Priority 2)
4. `/api/collect-typed` - Collection
5. `/api/navigate-typed` - Navigation
6. `/api/harvest` - Harvesting

### Phase 6.3: Battle System (Priority 3)
7. `/api/attack` - Battle initiation
8. `/api/battle-status` - Battle state

### Phase 6.4: Tech System (Priority 4)
9. `/api/build-item` - Building
10. `/api/complete-build` - Build completion
11. `/api/techtree` - Tech tree
12. `/api/trigger-research` - Research

### Phase 6.5: Messages (Priority 5)
13. `/api/messages` - Messaging

### Phase 6.6: Remaining Routes (Priority 6)
14. Other routes as needed

## Time Estimates

- Core routes (3): ~2 hours (45 min each with testing)
- Action routes (3): ~2 hours  
- Battle routes (2): ~1.5 hours
- Tech routes (4): ~2 hours
- Messages (1): ~1 hour
- Testing & validation: ~1 hour

**Total Estimated Time: 9-10 hours**

## Common Issues & Solutions

### Issue 1: Lock Order Violations

**Problem:** TypeScript error when acquiring locks in wrong order
```typescript
// ❌ ERROR: USER(30) before WORLD(20)
withUserLock(ctx, async (userCtx) => {
  withWorldLock(userCtx, async (worldCtx) => { ... });
});
```

**Solution:** Reverse the order
```typescript
// ✅ CORRECT: WORLD(20) before USER(30)
withWorldLock(ctx, async (worldCtx) => {
  withUserLock(worldCtx, async (userCtx) => { ... });
});
```

### Issue 2: Missing Context Parameters

**Problem:** Function expects context but doesn't have it
```typescript
const user = cacheManager.getUserUnsafe(userId, userCtx);
// Error: userCtx not defined
```

**Solution:** Ensure you're inside the lock callback
```typescript
return await withUserLock(ctx, async (userCtx) => {
  const user = cacheManager.getUserUnsafe(userId, userCtx);
  // Now userCtx is defined
});
```

### Issue 3: Repository Not Available in V2

**Problem:** Some operations don't have V2 versions yet
```typescript
// ❌ No battleRepoV2.someMethod()
```

**Solution:** Use existing repository with proper locks
```typescript
// ✅ Use old repo temporarily
import { BattleRepo } from '@/lib/server/battleRepo';
// This will work until Phase 7 migration
```

## Validation

Before marking Phase 6 complete:

- [ ] All priority routes migrated
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Tests pass: `npm test -- --run`
- [ ] Linting passes: `npm run lint`
- [ ] Manual testing completed for all routes
- [ ] No lock ordering violations
- [ ] Documentation updated

## Next Steps After Phase 6

Phase 7 (Cleanup) will:
1. Migrate any deferred routes
2. Migrate battleScheduler (if needed)
3. Remove old lock system files
4. Rename V2 files to primary
5. Update all imports
6. Final validation

## Notes

- API routes are entry points - they create lock contexts
- Service functions (battleServiceV2) create their own contexts
- Repository functions use contexts passed to them
- Cache manager methods that end with "Unsafe" require proper lock context
