# Development Plan

## Vision

As an admin, I want buttons on the admin page to spawn and remove space objects (asteroids, shipwrecks, escape pods) so I can control world density for testing and gameplay tuning — without affecting player ships.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively (`import`/`export` only, no CommonJS)
- **Lock System**: IronGuard TypeScript Locks for compile-time deadlock prevention

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/lib/client/` - Client-side code (hooks, services, game engine)
- `src/lib/server/` - Server-side code (database, typed locks, cache)
- `src/shared/` - Shared types and utilities
- `src/__tests__/` - Test files
- `doc/architecture/` - Arc42 architecture documentation

## Goals

### Goal 1: Add public spawn/remove methods to the World class

**Description**: The `World` class in `src/lib/server/world/world.ts` has a private `spawnRandomObject` method. We need to expose public methods for spawning multiple objects and removing non-ship objects so the admin API can call them.

**Quality Requirements**: Methods must require Lock6 context (type-safe lock enforcement). Must not affect existing `collected` → `spawnRandomObject` flow.

#### Task 1.1: Add public `spawnObjects` method to World class

**Action**: Add a public async method `spawnObjects(context, count)` to the `World` class that spawns `count` random collectible objects. Reuse the same randomization logic from the existing private `spawnRandomObject` method (60% asteroid / 30% shipwreck / 10% escape pod, random position within `worldSize`, speed ±25% variation, random angle). Call the existing `spawnRandomObject` method `count` times in a loop.

**Files**:

- `src/lib/server/world/world.ts` — add `spawnObjects` public method

**Quality Requirements**: Method signature must accept Lock6 context for type-safe lock enforcement. Return the count of spawned objects.

#### Task 1.2: Add public `removeCollectibles` method to World class

**Action**: Add a public async method `removeCollectibles(context, count)` to the `World` class. This method filters `this.spaceObjects` to only collectible types (`asteroid`, `shipwreck`, `escape_pod`) — excluding `player_ship`. Then removes up to `count` of them from both the in-memory array and the database (using `deleteSpaceObject`). The simplest selection: take the first `count` matching objects.

**Files**:

- `src/lib/server/world/world.ts` — add `removeCollectibles` public method

**Quality Requirements**: Must never remove `player_ship` objects. Return the actual count removed (may be less than requested if fewer collectibles exist).

#### Task 1.3: Unit tests for spawn/remove methods

**Action**: Add tests for `spawnObjects` and `removeCollectibles` methods. Test scenarios:

- `spawnObjects_count10_adds10ObjectsToWorld`
- `spawnObjects_count0_addsNoObjects`
- `removeCollectibles_count5_removes5Collectibles`
- `removeCollectibles_moreRequestedThanExist_removesOnlyAvailable`
- `removeCollectibles_onlyShipsExist_removesNone`
- `removeCollectibles_mixedObjects_neverRemovesPlayerShip`

**Files**:

- `src/__tests__/api/world-api.test.ts` — add new test cases (or create a dedicated test file if world-api tests are unrelated)

**Quality Requirements**: Use transaction-based isolation. Follow `whatIsTested_scenario_expectedOutcome` naming.

---

### Goal 2: Create admin API route for space object management

**Description**: Add a new admin API route at `src/app/api/admin/space-objects/route.ts` following the existing admin API pattern (authentication, admin-only authorization, lock acquisition).

**Inputs**: Existing admin API pattern from `time-multiplier/route.ts`
**Quality Requirements**: Same auth/admin checks as existing admin routes. Proper lock ordering (USER_LOCK → WORLD_LOCK).

#### Task 2.1: Create POST endpoint for spawning space objects

**Action**: Create `src/app/api/admin/space-objects/route.ts` with a `POST` handler:

1. Authenticate via iron-session, call `requireAuth(session.userId)`
2. Acquire `LOCK_4` (USER_LOCK), verify admin user (`username === 'a' || username === 'q'`)
3. Parse request body: `{ count: number }` — validate `count` is 1–100
4. Acquire `LOCK_6` (WORLD_LOCK) inside `LOCK_4` context (correct lock ordering)
5. Call `world.spawnObjects(worldContext, count)` on the cached World instance
6. Return JSON with `{ success: true, spawned: count }`

**Files**:

- `src/app/api/admin/space-objects/route.ts` — create new file

#### Task 2.2: Create DELETE endpoint for removing space objects

**Action**: Add a `DELETE` handler to the same route file:

1. Same authentication and admin authorization as POST
2. Parse request body: `{ count: number }` — validate `count` is 1–100
3. Acquire locks in same order (USER_LOCK → WORLD_LOCK)
4. Call `world.removeCollectibles(worldContext, count)` on the cached World instance
5. Return JSON with `{ success: true, removed: actualCount }`

**Files**:

- `src/app/api/admin/space-objects/route.ts` — add DELETE handler

#### Task 2.3: Integration tests for admin space-objects API

**Action**: Create integration tests for the new API route:

- `adminSpaceObjects_spawnPost_addsObjects`
- `adminSpaceObjects_deletePost_removesCollectibles`
- `adminSpaceObjects_unauthorizedUser_returns403`
- `adminSpaceObjects_unauthenticated_returns401`
- `adminSpaceObjects_invalidCount_returns400`

**Files**:

- `src/__tests__/api/admin-space-objects-api.test.ts` — new test file

**Quality Requirements**: Use `withTransaction`, `initializeIntegrationTestServer`, follow existing test patterns in `src/__tests__/api/`.

---

### Goal 3: Add spawn/remove UI controls to admin page

**Description**: Add a new section to the admin page with preset buttons for spawning (10, 20, 30 objects) and removing (10, 20, 30 objects) space objects. Follow the existing time multiplier section's UI pattern.

#### Task 3.1: Add space object controls section to admin page

**Action**: Add a new section to `src/app/admin/page.tsx` after the time multiplier section and before the stats cards. The section includes:

1. **Section header**: "Space Objects Control" (with appropriate icon)
2. **Current count display**: Show `adminData.totalObjects` as a status badge
3. **Spawn buttons row**: Three buttons — "Spawn 10", "Spawn 20", "Spawn 30"
   - Each calls `POST /api/admin/space-objects` with the corresponding count
   - Disabled while loading
   - Use `multiplier-preset-btn` CSS class (green buttons)
4. **Remove buttons row**: Three buttons — "Remove 10", "Remove 20", "Remove 30"
   - Each calls `DELETE /api/admin/space-objects` with the corresponding count
   - Disabled while loading
   - Use a red button style similar to `multiplier-reset-btn`
5. **Loading state**: Disable buttons during API calls
6. **After action**: Refresh admin data (`fetchAdminData()`) to update the space objects table and count

**Files**:

- `src/app/admin/page.tsx` — add new section component and state/handlers

#### Task 3.2: Add CSS styles for space object controls

**Action**: Add CSS styles to `src/app/admin/AdminPage.css` for the new section. Reuse existing patterns:

- Section container: follow `time-multiplier-section` pattern
- Spawn buttons: reuse `multiplier-preset-btn` (green)
- Remove buttons: style similar to `multiplier-reset-btn` (red/destructive)
- Button rows: flex layout with gap
- Status badge: follow `multiplier-badge` pattern

**Files**:

- `src/app/admin/AdminPage.css` — add new styles

---

## Dependencies

None — no new npm packages required.

## Arc42 Documentation Updates

**Proposed Changes**: None — this is an admin tooling addition within existing architecture. No new architectural layers or patterns introduced.

## Architecture Notes

- **Lock ordering**: The admin API must acquire locks in correct order: USER_LOCK (4) → WORLD_LOCK (6). This matches the established convention.
- **World mutation**: The World class's in-memory `spaceObjects` array and database must both be updated. Using `insertSpaceObject`/`deleteSpaceObject` from `worldRepo.ts` ensures DB consistency. The in-memory array is modified in-place (push/splice).
- **Persistence**: The WorldCache's background persistence timer (30s) will handle flushing position updates. However, insert/delete operations go directly to DB via the repo functions, so they are immediately persisted.
- **Simplest removal strategy**: Remove the first N collectibles found in the `spaceObjects` array. This avoids complexity of random selection, oldest-first, etc.

## Agent Decisions

1. **Reuse `spawnRandomObject` via loop**: Rather than duplicating the randomization logic, `spawnObjects` will call the existing private `spawnRandomObject` method N times. This ensures the same probability distribution and avoids code duplication.

2. **Simplest removal selection**: Remove the first N collectibles from the array (filtered to exclude `player_ship`). This is the simplest approach that guarantees ships are never removed.

3. **Single API route with POST/DELETE**: One route file handles both operations, matching REST semantics. POST to create, DELETE to remove.

4. **Count validation 1–100**: Upper bound of 100 prevents accidental mass-spawning. The world is 5000×5000, so 100 objects at a time is reasonable.

5. **No type selection for spawning**: The user said to reuse existing spawn logic, so spawned objects follow the same random distribution (60/30/10) as the game's natural respawn. This keeps it simple.

6. **Refresh data after action**: After spawn/remove, the UI calls `fetchAdminData()` to refresh the space objects table and total count, giving immediate visual feedback.

## User decision which changes above plan. To be considered by the Navigator, then remove this section before implementation.

The cap at 100 is not reasonable. Do not add a cap at all. The admin should be able to spawn or remove as many objects as they want in one action, even if that means 1000 or more. The world can handle it, and it's an admin tool for testing/tuning, so flexibility is more important than preventing accidental mass actions. Remove the count validation that limits to 100. Just ensure it's a positive integer.
