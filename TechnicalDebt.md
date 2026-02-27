# Technical Debt

## Missing Test: complete-build cheat mode for user 'q'

**Priority**: Low
**Added**: 2026-02-27
**Component**: `src/app/api/complete-build/route.ts`

### Context

The cheat-mode route grants access to usernames `'a'` and `'q'`. The integration test `completeBuild_userA_canUseCheatMode` verifies the full flow for user 'a'. User 'q' has no equivalent functional test — a placeholder (`expect(true).toBe(true)`) was removed during test pyramid refactoring.

### Proper Solution

Add an integration test that:

1. Seeds user 'q' with enough iron (≥ build cost) via direct SQL
2. Creates a build queue entry for 'q'
3. Calls the complete-build endpoint as 'q'
4. Asserts `200 + success: true + completedItem` is returned

---

## IronCapacity Rename - Remove DB Backward Compatibility Fallback

**Priority**: Low  
**Added**: 2026-02-20  
**Component**: Tech Tree (techtree.ts, ResearchPageClient.tsx)

### Context

`ResearchType.InventoryCapacity` was renamed to `ResearchType.IronCapacity` (enum value changed from `'inventoryCapacity'` to `'ironCapacity'`, display name changed from "Inventory Capacity" to "Iron Capacity"). The TechTree is stored as JSONB in the database. Existing DB records have the old key `inventoryCapacity`; new records use `ironCapacity`.

A backward compatibility fallback was added so old data still works without a migration:

- `TechTree` interface: `inventoryCapacity?: number` is marked `@deprecated` and kept as optional alongside `ironCapacity: number`
- `getResearchLevelFromTree`: reads `tree.ironCapacity ?? tree.inventoryCapacity ?? default`
- `updateTechTree`: uses `(tree.ironCapacity ?? tree.inventoryCapacity ?? default) + 1`
- `ResearchPageClient.tsx` imageMap: maps both `inventoryCapacity` and `ironCapacity` to `'IronCapacity'`

### Proper Solution

Once all existing DB records have been migrated (or reset), remove the fallback:

1. Run SQL migration: `UPDATE users SET tech_tree = jsonb_set(tech_tree - 'inventoryCapacity', '{ironCapacity}', tech_tree->'inventoryCapacity') WHERE tech_tree ? 'inventoryCapacity';`
2. Remove `inventoryCapacity?: number` from `TechTree` interface in `techtree.ts`
3. Simplify `getResearchLevelFromTree` case to `return tree.ironCapacity;`
4. Simplify `updateTechTree` case to `tree.ironCapacity += 1;`
5. Remove `// TECH DEBT` comments from `techtree.ts`
6. Remove `inventoryCapacity: 'IronCapacity'` fallback line from `ResearchPageClient.tsx` imageMap

### Related Files

- `src/lib/server/techs/techtree.ts` - TechTree interface and accessor functions
- `src/app/research/ResearchPageClient.tsx` - imageMap fallback
- `src/shared/src/types/gameTypes.ts` - ResearchType enum

---

## User Object - Automatic Dirty State Tracking

**Priority**: Medium

### Idea

Currently, marking a user as dirty for cache persistence requires explicit calls to cache manager methods after mutating the user object. This is error-prone and can lead to missed updates if callers forget to mark the user as dirty.

**Proposed Solution:**

- Inject a callback into each User object that marks it as dirty in the cache when its state changes.
- Mutating methods and setters in the User class would invoke this callback automatically.
- This ensures that any change to a cached User is tracked for persistence, without requiring manual dirty marking by callers.

**Benefits:**

- Reduces boilerplate and risk of missed updates
- Centralizes dirty state tracking in the domain model
- Makes cache management more robust and maintainable

**Effort Estimate:**

- Medium: Requires refactoring User class and cache manager

**Related Files:**

- src/lib/server/user/user.ts
- src/lib/server/user/userCache.ts

## Battle System - Cache Bypass Issue

**Priority**: ~~High~~ **RESOLVED**  
**Added**: 2025-10-11  
**Resolved**: 2025-11-XX  
**Component**: Battle System (battleScheduler.ts, battleService.ts)

### Problem

The battle system previously bypassed the cache layer and wrote directly to the database, creating cache consistency issues and violating architectural principles.

### Solution Implemented

The battle system has been refactored to use BattleCache as the single source of truth:

1. **BattleCache** (`src/lib/server/battle/BattleCache.ts`):
   - Manages all battle state in memory
   - Single source of truth for ongoing battles
   - Handles background persistence via battleRepo
   - Proper lock hierarchy: BATTLE_LOCK (2) → DATABASE_LOCK_BATTLES (13)

2. **BattleRepo** (`src/lib/server/battle/battleRepo.ts`):
   - Pure database operations (no cache access, no business logic)
   - Called ONLY by BattleCache for persistence
   - Clean separation of concerns

3. **BattleScheduler** (`src/lib/server/battle/battleScheduler.ts`):
   - Uses BattleCache for all state access and updates
   - Coordinates with UserCache and MessageCache via dependency injection
   - No direct database writes

**Status**: ✅ Refactored - single source of truth, proper cache architecture

---

## Defense Value Regeneration in Attack Route

**Priority**: Low  
**Added**: 2025-10-28  
**Component**: Attack API Route

### Problem

The attack route (`src/app/api/attack/route.ts`) was temporarily modified to call `updateDefenseValues()` and write the results back to cache before initiating battle. This violates the separation of concerns:

- Defense value regeneration should be handled by the **world loop** (periodic background process)
- API routes should not perform world state updates
- This creates duplicate logic and potential race conditions

### Architecture Violation

The world loop is designed to handle all periodic updates including:

- Ship movement
- Defense value regeneration
- Resource regeneration
- Other time-based mechanics

API routes should only:

- Validate requests
- Initiate actions (like battles)
- Return responses

Mixing these concerns makes the system harder to maintain and reason about.

### Temporary Fix Applied

The defense value update was removed from the attack route. The world loop should handle defense regeneration before battles are initiated.

### Proper Solution

Ensure the world loop runs frequently enough to keep defense values up-to-date:

1. Verify world loop interval is appropriate (currently runs every tick)
2. Consider adding "ensure up-to-date" logic in battle initiation that triggers world loop if needed
3. Document clearly that defense values are the responsibility of world loop, not API routes

### Related Files

- `src/app/api/attack/route.ts` - Attack API route
- `src/lib/server/worldLoop.ts` - World update loop (if exists)
- `src/lib/server/user.ts` - User class with `updateDefenseValues()` method

---

## World Persistence - Missing Dirty State Tracking

**Priority**: Medium  
**Added**: 2025-11-19  
**Component**: World Persistence (world.ts, userWorldCache.ts)

### Problem

The `saveCallback` passed to the `World` constructor is never triggered. The `World.save()` method exists but is not called in any methods that modify the world state (e.g., `collected()`, `updateSpaceObject()`, `updatePhysics()`). This means world modifications are not marked as dirty in the cache, preventing automatic persistence.

### Architecture Violation

The cache manager relies on dirty flags to know when to persist data:

- World changes (e.g., object positions, additions/removals) should mark `worldDirty = true`
- Background persistence checks this flag to decide whether to save
- Without it, world state drifts out of sync with the database

### Current Behavior

- World loads with `worldDirty = false`
- Modifications occur but don't set the flag
- Persistence skips the world, leading to lost updates

### Proposed Solution

Modify `World` methods to call `await this.saveCallback(this);` after state changes:

- `collected()`: After removing and spawning objects
- `updateSpaceObject()`: After updating object properties (make async if needed)
- `updatePhysics()`: If position changes require immediate persistence (consider batching for performance)

This ensures the cache is notified of changes and can persist them.

### Benefits

- Automatic persistence of world changes
- Prevents data loss from unpersisted modifications
- Aligns with the callback pattern already in place

### Effort Estimate

- **Medium**: Requires updating World methods and ensuring async handling

### Related Files

- `src/lib/server/world/world.ts` - World class with save() method
- `src/lib/server/world/worldCache.ts` - Cache manager with worldDirty flag
