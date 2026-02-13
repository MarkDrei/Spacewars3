# Development Plan: Time Multiplier (Turbo Mode)

**Status**: ✅ Finalized by Navigator  
**Ready for Implementation**: Yes  
**Human Review**: Approved for implementation

## Vision

As a game admin, I want to activate a time multiplier (e.g. 10x for 5 minutes) that accelerates all game-time-based calculations — including iron production, research, builds, defense regeneration, battle cooldowns, and physics — so that I can test end-game progression quickly without waiting real-time durations. The multiplier is stored in-memory on the server (no DB), synchronized to clients via the existing `/api/user-stats` polling, and controlled through the admin page UI.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL (not used for multiplier storage)
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively (`import`/`export` only, no CommonJS)
- **Lock System**: IronGuard TypeScript Locks for compile-time deadlock prevention

## Project Structure

- `src/app/` — Next.js App Router pages and API routes
- `src/lib/client/` — Client-side code (hooks, services, game engine)
- `src/lib/server/` — Server-side code (database, typed locks, cache)
- `src/shared/` — Shared types and utilities
- `src/__tests__/` — Test files
- `doc/architecture/` — Arc42 architecture documentation

---

## Goals

### Goal 1: Server-Side TimeMultiplierService

**Description**: Create a lightweight in-memory singleton service that stores the current time multiplier, its expiration time, and provides a clean API for reading and setting the multiplier. This is the single source of truth for the multiplier value.

**Quality Requirements**: Must auto-expire after the configured duration. Must be safe for concurrent access (single-threaded Node.js, so no locking needed). Must not persist to DB. Must be testable (resettable for tests).

#### Task 1.1: Create TimeMultiplierService singleton

**Action**: Create a new module with a `TimeMultiplierService` class/object that holds multiplier state in memory.

**Files**:
- `src/lib/server/timeMultiplier.ts` — New file

**Design**:
- Export a singleton instance (similar pattern to other singletons in the project)
- State: `multiplier: number` (default 1), `expiresAt: number | null` (Unix ms), `activatedAt: number | null` (Unix ms)
- `getMultiplier(): number` — returns current multiplier, auto-resets to 1 if expired
- `setMultiplier(value: number, durationMinutes: number): void` — sets multiplier with expiration
- `getStatus(): { multiplier: number, expiresAt: number | null, activatedAt: number | null, remainingSeconds: number }` — for admin UI
- `reset(): void` — for testing, resets to default state
- Validation: multiplier must be >= 1, durationMinutes must be > 0

#### Task 1.2: Unit tests for TimeMultiplierService

**Action**: Write comprehensive tests for the service.

**Files**:
- `src/__tests__/lib/timeMultiplier.test.ts` — New file

**Test cases**:
- `getMultiplier_noMultiplierSet_returns1`
- `setMultiplier_validValues_storesMultiplierAndExpiration`
- `getMultiplier_afterExpiry_returns1`
- `getMultiplier_beforeExpiry_returnsSetValue`
- `getStatus_activeMultiplier_returnsCorrectRemainingSeconds`
- `setMultiplier_invalidValues_throwsOrRejectsGracefully`
- `reset_afterSet_returns1`

---

### Goal 2: Apply Multiplier to Server-Side Game Logic

**Description**: Integrate the time multiplier into all server-side time-based calculations so that game progression is accelerated. Real timestamps (messages, DB sync, auditing) remain unaffected.

**Inputs**: `TimeMultiplierService.getMultiplier()` value
**Quality Requirements**: No changes to real-time timestamps. All delta-based calculations must be multiplied. Build queue must adjust completion estimates. Battle cooldowns must be shortened.

#### Sub-Goal 2.1: Accelerate User Stats (Iron + Research + Defense Regen)

##### Task 2.1.1: Multiply elapsed time in User.updateStats()

**Action**: Import `TimeMultiplierService` and multiply the `elapsed` delta by the current multiplier before using it for iron calculation and research progress.

**Files**:
- `src/lib/server/user/user.ts` — Modify `updateStats()` method (line ~193)

**Change detail**:
- After `const elapsed = now - this.last_updated`, add: `const gameElapsed = elapsed * TimeMultiplierService.getMultiplier()`
- Replace all uses of `elapsed` with `gameElapsed` for iron calculation and `updateTechTree()` calls
- `this.last_updated = now` stays as real time (anchor for next delta)

##### Task 2.1.2: Multiply elapsed time in User.updateDefenseValues()

**Action**: Apply multiplier to defense regeneration elapsed time.

**Files**:
- `src/lib/server/user/user.ts` — Modify `updateDefenseValues()` method (line ~249)

**Change detail**:
- After `const elapsed = now - this.defenseLastRegen`, add: `const gameElapsed = elapsed * TimeMultiplierService.getMultiplier()`
- Use `gameElapsed` instead of `elapsed` for regen: `this.hullCurrent + gameElapsed`
- `this.defenseLastRegen = now` stays as real time

##### Task 2.1.3: Tests for accelerated user stats

**Action**: Add tests verifying multiplier affects iron production and defense regen rates.

**Files**:
- `src/__tests__/lib/timeMultiplier-user.test.ts` — New file

**Test cases**:
- `updateStats_withMultiplier10_awardsIronAt10xRate`
- `updateStats_withMultiplier10_progressesResearchAt10xRate`
- `updateDefenseValues_withMultiplier10_regeneratesAt10xRate`
- `updateStats_multiplierExpired_usesNormalRate`

#### Sub-Goal 2.2: Accelerate Build Queue

##### Task 2.2.1: Adjust processCompletedBuilds() completion check

**Action**: Modify the completion check to account for the time multiplier by checking `(now - buildStartSec) * multiplier >= buildDuration` instead of `now >= buildStartSec + buildDuration`.

**Files**:
- `src/lib/server/techs/TechService.ts` — Modify `processCompletedBuilds()` (line ~172)

**Change detail**:
- Import `TimeMultiplierService`
- Current logic: `const completionTime = currentBuildStart! + buildTime; if (now >= completionTime)`
- New logic: `if ((now - currentBuildStart!) * TimeMultiplierService.getMultiplier() >= buildTime)`
- When build completes and next item starts, set `user.buildStartSec = now` (real time) — this correctly anchors the next build

##### Task 2.2.2: Adjust getBuildQueue() completion time estimates

**Action**: Modify `getBuildQueue()` so the returned `completionTime` values account for the multiplier, ensuring client countdowns are accurate.

**Files**:
- `src/lib/server/techs/TechService.ts` — Modify `getBuildQueue()` (line ~83)

**Change detail**:
- Import `TimeMultiplierService`
- Current: `completionTime = cumulativeTime + buildTime`
- New: `const effectiveBuildTime = buildTime / TimeMultiplierService.getMultiplier()`
- `completionTime = cumulativeTime + effectiveBuildTime`
- This makes client see shorter remaining times that match actual accelerated completion

**Note on mid-build multiplier changes**: If multiplier changes during an active build, completion estimates will jump. This is acceptable for an admin/debug feature. Activating 10x may cause in-progress builds to complete instantly if enough real time has already passed. Deactivating resets to normal speed with full remaining real duration. This is documented behavior, not a bug.

##### Task 2.2.3: Tests for accelerated build queue

**Action**: Test that builds complete faster with multiplier and that queue estimates are correct.

**Files**:
- `src/__tests__/lib/timeMultiplier-builds.test.ts` — New file

**Test cases**:
- `processCompletedBuilds_withMultiplier10_completesIn1TenthTime`
- `getBuildQueue_withMultiplier10_returnsAdjustedCompletionTimes`
- `processCompletedBuilds_multiplierExpired_usesNormalDuration`

#### Sub-Goal 2.3: Accelerate Battle Cooldowns

##### Task 2.3.1: Shorten weapon cooldowns by multiplier

**Action**: When setting `nextReadyTime` after a weapon fires, divide the cooldown by the multiplier.

**Files**:
- `src/lib/server/battle/battleScheduler.ts` — Modify `fireWeapon()` section where cooldown is set

**Change detail**:
- Import `TimeMultiplierService`
- Current: `const nextReadyTime = currentTime + (weaponData.cooldown || 5)`
- New: `const effectiveCooldown = Math.max(1, Math.ceil((weaponData.cooldown || 5) / TimeMultiplierService.getMultiplier()))`
- `const nextReadyTime = currentTime + effectiveCooldown`
- Minimum cooldown of 1 second to prevent zero-division issues

##### Task 2.3.2: Tests for accelerated battle cooldowns

**Action**: Test that weapon cooldowns are shortened with multiplier.

**Files**:
- `src/__tests__/lib/timeMultiplier-battles.test.ts` — New file

**Test cases**:
- `fireWeapon_withMultiplier10_setsCooldownToOneTenth`
- `fireWeapon_multiplierExpired_usesNormalCooldown`

#### Sub-Goal 2.4: Accelerate Physics (Object Movement)

##### Task 2.4.1: Add multiplier parameter to shared physics functions

**Action**: Add an optional `timeMultiplier` parameter to `updateObjectPosition()`, `updateAllObjectPositions()`, `updateObjectPositionWithTimeCorrection()`, and `updateAllObjectPositionsWithTimeCorrection()`. Default to 1 for backward compatibility.

**Files**:
- `src/shared/src/physics.ts` — Modify all 4 functions

**Change detail**:
- `updateObjectPosition(obj, currentTime, worldBounds, factor=50, timeMultiplier=1)`: multiply `elapsedMs` by `timeMultiplier`
- `updateAllObjectPositions(objects, currentTime, worldBounds, factor=50, timeMultiplier=1)`: pass multiplier through
- Same for `WithTimeCorrection` variants: multiply `correctedElapsedMs` by `timeMultiplier`
- All existing callers pass no multiplier argument → default 1 → no behavior change

##### Task 2.4.2: Pass multiplier on server-side physics calls

**Action**: When the server updates physics, pass the current multiplier from `TimeMultiplierService`.

**Files**:
- `src/lib/server/world/worldCache.ts` — Modify `getWorldFromCache()` (line ~137) to pass multiplier
- `src/lib/server/world/world.ts` — Modify `updatePhysics()` to accept and forward multiplier
- `src/app/api/world/route.ts` — Modify to pass multiplier when calling `updatePhysics()`

**Change detail**:
- `world.updatePhysics(context, currentTime)` → `world.updatePhysics(context, currentTime, TimeMultiplierService.getMultiplier())`
- `updatePhysics` passes multiplier to `updateAllObjectPositions()`

##### Task 2.4.3: Tests for accelerated physics

**Action**: Test that physics functions correctly apply the time multiplier.

**Files**:
- `src/__tests__/shared/physics-multiplier.test.ts` — New file (or add to existing physics tests)

**Test cases**:
- `updateObjectPosition_withMultiplier10_movesObjectTenTimesAsFar`
- `updateObjectPosition_withMultiplier1_behavesUnchanged`

---

### Goal 3: Admin API Endpoint

**Description**: Create a REST API endpoint for reading and setting the time multiplier, restricted to admin users.

**Quality Requirements**: Admin-only access (users 'a' and 'q'). Proper error handling. JSON request/response.

#### Task 3.1: Create GET/POST /api/admin/time-multiplier endpoint

**Action**: Create a new API route that handles reading (GET) and setting (POST) the time multiplier.

**Files**:
- `src/app/api/admin/time-multiplier/route.ts` — New file

**GET response**:
```
{ multiplier: number, expiresAt: number | null, activatedAt: number | null, remainingSeconds: number }
```

**POST request body**:
```
{ multiplier: number, durationMinutes: number }
```

**POST response**:
```
{ success: true, multiplier: number, expiresAt: number, durationMinutes: number }
```

**Implementation**:
- Import session/auth pattern from existing admin route (`src/app/api/admin/database/route.ts`)
- Check `session.username === 'a' || session.username === 'q'`
- GET: return `TimeMultiplierService.getStatus()`
- POST: validate body, call `TimeMultiplierService.setMultiplier(value, duration)`, return confirmation

#### Task 3.2: Tests for admin time-multiplier API

**Action**: Test the API endpoint for auth, GET, POST, validation.

**Files**:
- `src/__tests__/api/time-multiplier-api.test.ts` — New file

**Test cases**:
- `GET_authenticated_returnsCurrentStatus`
- `POST_validInput_setsMultiplier`
- `POST_invalidMultiplier_returns400`
- `POST_unauthenticated_returns401`
- `POST_nonAdmin_returns403`
- `GET_afterExpiry_returnsMultiplier1`

---

### Goal 4: Client-Side Multiplier Synchronization

**Description**: Synchronize the time multiplier from server to client via the existing `/api/user-stats` polling mechanism. Store the multiplier in a shared client-side module so all hooks can access it without additional API calls.

#### Sub-Goal 4.1: Server-Side — Add Multiplier to user-stats Response

##### Task 4.1.1: Return timeMultiplier in /api/user-stats

**Action**: Add `timeMultiplier` field to the user-stats API response.

**Files**:
- `src/app/api/user-stats/route.ts` — Modify `processUserStats()` response

**Change detail**:
- Import `TimeMultiplierService`
- Add to `responseData`: `timeMultiplier: TimeMultiplierService.getMultiplier()`
- Response becomes: `{ iron, ironPerSecond, last_updated, maxIronCapacity, xp, level, xpForNextLevel, timeMultiplier }`

#### Sub-Goal 4.2: Client-Side — Store and Distribute Multiplier

##### Task 4.2.1: Create client-side timeMultiplier module

**Action**: Create a simple module-level store for the latest known multiplier. Other hooks import and read from it.

**Files**:
- `src/lib/client/timeMultiplier.ts` — New file

**Design**:
- `let currentMultiplier = 1`
- `export function getTimeMultiplier(): number` — returns current value
- `export function setTimeMultiplier(value: number): void` — called by useIron on each poll
- Simple module state — no React context needed (updates propagate at next interpolation tick)

##### Task 4.2.2: Update useIron hook to store multiplier

**Action**: When `useIron` receives the user-stats response, extract `timeMultiplier` and store it in the client module.

**Files**:
- `src/lib/client/hooks/useIron/useIron.ts` — Modify `fetchIron()` callback
- `src/lib/client/services/userStatsService.ts` — Ensure response type includes `timeMultiplier`

**Change detail**:
- After parsing `result`, call `setTimeMultiplier(result.timeMultiplier ?? 1)`
- Also expose `timeMultiplier` from the hook return value for components that need it (e.g., admin page)

##### Task 4.2.3: Apply multiplier to iron prediction (client)

**Action**: Multiply `ironPerSecond` by the time multiplier in the client-side iron prediction formula.

**Files**:
- `src/lib/client/hooks/useIron/ironCalculations.ts` — Modify `calculatePredictedIron()`

**Change detail**:
- Add `timeMultiplier` parameter (default 1): `calculatePredictedIron(data, currentTime, timeMultiplier = 1)`
- Formula: `predictedIron = serverAmount + (secondsElapsed * ironPerSecond * timeMultiplier)`
- Caller in `useIron.ts` passes `getTimeMultiplier()` when calling

##### Task 4.2.4: Apply multiplier to defense interpolation (client)

**Action**: Multiply `regenRate` by the time multiplier in the defense value interpolation.

**Files**:
- `src/lib/client/hooks/useDefenseValues.ts` — Modify `updateDisplayValues()` callback

**Change detail**:
- Import `getTimeMultiplier` from client module
- Change: `defense.current + (secondsElapsed * defense.regenRate)` → `defense.current + (secondsElapsed * defense.regenRate * getTimeMultiplier())`

##### Task 4.2.5: Apply multiplier to physics extrapolation (client)

**Action**: Pass the time multiplier to client-side physics functions for optimistic position updates.

**Files**:
- `src/lib/client/hooks/useWorldData.ts` — Modify `updateOptimisticPositions()` and `fetchWorldData()`

**Change detail**:
- Import `getTimeMultiplier` from client module
- In `updateOptimisticPositions`: `updateAllObjectPositions(data.spaceObjects, now, data.worldSize, 50, getTimeMultiplier())`
- In `fetchWorldData`: `updateAllObjectPositionsWithTimeCorrection(...args, 50, getTimeMultiplier())`

##### Task 4.2.6: Tests for client-side multiplier integration

**Action**: Test client-side iron prediction and defense interpolation with multiplier.

**Files**:
- `src/__tests__/hooks/useIron-timeMultiplier.test.ts` — New file (or extend existing)
- `src/__tests__/lib/timeMultiplier-client.test.ts` — New file for client module

**Test cases**:
- `calculatePredictedIron_withMultiplier10_predictsAt10xRate`
- `calculatePredictedIron_withMultiplier1_behavesUnchanged`
- `getTimeMultiplier_afterSet_returnsSetValue`
- `getTimeMultiplier_default_returns1`

---

### Goal 5: Admin Page UI for Time Multiplier Control

**Description**: Add a "Time Multiplier" control section to the admin page that shows the current multiplier status and allows activating/deactivating turbo mode.

**Quality Requirements**: Clear display of active state, countdown, and controls. Consistent styling with existing admin page. Auto-refresh status.

#### Task 5.1: Add Time Multiplier UI section to admin page

**Action**: Add a new section at the top of the admin page (before the stat cards) that displays multiplier status and provides controls.

**Files**:
- `src/app/admin/page.tsx` — Add new state, fetch logic, and UI section

**UI Design**:
- **Status display**: "Time Multiplier: 10x" (green badge when active, gray when inactive/1x)
- **Countdown**: "Expires in: 4:32" (live countdown timer, updated every second)
- **Activated at**: "Activated: 14:23:05" (human-readable time)
- **Quick-action buttons**: "10x for 5 min", "10x for 15 min", "50x for 5 min" — pre-configured presets
- **Custom form**: Input fields for custom multiplier value and duration, with "Activate" button
- **Deactivate button**: "Reset to 1x" — sets multiplier to 1 immediately

**Implementation**:
- New state: `multiplierStatus` with `{ multiplier, expiresAt, activatedAt, remainingSeconds }`
- Fetch from `GET /api/admin/time-multiplier` on mount and every 5 seconds (while multiplier is active)
- POST to `/api/admin/time-multiplier` on button click
- Local countdown timer (decrement `remainingSeconds` every second) for smooth display between polls

#### Task 5.2: Add CSS styles for time multiplier section

**Action**: Add styles for the new multiplier control section, consistent with existing dark-theme admin page.

**Files**:
- `src/app/admin/AdminPage.css` — Add new CSS classes

**Styles needed**:
- `.time-multiplier-section` — container with distinct visual prominence (bordered, maybe highlighted background)
- `.multiplier-badge` — green/large badge showing current multiplier value
- `.multiplier-active` / `.multiplier-inactive` — active (green glow) vs inactive (gray) states
- `.multiplier-countdown` — countdown display
- `.multiplier-controls` — flexbox row of preset buttons
- `.multiplier-preset-btn` — styled preset buttons (consistent with admin theme)
- `.multiplier-custom-form` — inline form for custom values
- `.multiplier-reset-btn` — red/warning styled deactivate button

---

## What Should NOT Be Accelerated

The following use real wall-clock time and must remain unaffected by the multiplier:

| Location | Usage | Reason |
|---|---|---|
| `MessageCache.createMessage()` | `created_at: Date.now()` | Messages show real time |
| `BattleCache.createBattle()` | `battleStartTime` | Battle records are historical |
| `BattleCache.endBattle()` | `battleEndTime` | Battle records are historical |
| Background persistence timers | 30s intervals | Infrastructure, not game logic |
| Battle scheduler interval | 1s `setInterval` | Scheduler tick rate (cooldowns are accelerated, not the tick) |
| Client polling intervals | Various `setInterval` | Network timing, not game timing |
| DB `last_updated` column | Used as sync anchor | Must stay in real time for delta calculations |
| `userRepo.createUserWithShip()` | Initial timestamps | Account creation is real-time |
| `seedData.ts` | Space object timestamps | Seeding is real-time |
| Message cleanup cutoff | `olderThanDays` | Real-time retention |

---

## Dependencies

No new npm packages required. All implementation uses existing project dependencies.

---

## Arc42 Documentation Updates

**Proposed Changes**: Minor update to [doc/architecture/arc42-architecture.md](doc/architecture/arc42-architecture.md)

- Add `TimeMultiplierService` as a lightweight in-memory singleton in the "Runtime View" or "Building Block View" section
- Note that it is NOT a cache (no DB persistence) but follows the singleton pattern of other server services
- Document that it integrates at the calculation layer (User, TechService, BattleScheduler, Physics) rather than at the time-provider layer

---

## Architecture Notes

### Design Pattern: Multiplied Deltas

The core pattern is **multiplying time deltas** rather than creating a "virtual game clock":
- Server stores `last_updated` / `defenseLastRegen` / `buildStartSec` in **real time**
- When calculating `elapsed = now - lastTime`, multiply: `gameElapsed = elapsed * multiplier`
- Use `gameElapsed` for all game logic (iron, research, defenses, cooldowns)
- Update timestamps back to **real time**: `lastTime = now`

This avoids a "virtual clock" that would diverge from real time and complicate DB timestamps, session management, and debugging.

### Build Queue: Absolute Timestamp Adjustment

The build queue uses absolute timestamps (`completionTime = buildStartSec + buildDuration`). For the multiplier:
- **Completion check**: `(now - buildStartSec) * multiplier >= buildDuration`
- **Client display**: `effectiveCompletionTime = buildStartSec + buildDuration / multiplier`

Mid-build multiplier changes cause a discontinuity (builds may complete instantly or slow down). This is acceptable for an admin/debug feature.

### Client Sync: Module-Level State

Rather than React Context (which would require provider wrappers), the client stores the multiplier in a simple module-level variable (`src/lib/client/timeMultiplier.ts`). This is updated every 5s by `useIron` and read by other hooks during their interpolation ticks. The 5s max staleness is acceptable — the multiplier changes rarely (admin action), and the server is authoritative.

### Existing TimeProvider Pattern

The `TimeProvider` interface in `battleSchedulerUtils.ts` exists for **test injection** (controlling clock in tests). The time multiplier is a **game feature** and intentionally NOT integrated with `TimeProvider` — they serve different purposes. `TimeProvider.now()` continues to return real time; the multiplier scales elapsed deltas at the calculation layer.

---

## Agent Decisions

1. **In-memory singleton vs global variable**: Chose singleton class pattern (consistent with `UserCache`, `WorldCache`, `MessageCache`, `BattleCache` patterns) over a plain module variable.

2. **Delta multiplication vs virtual clock**: Chose to multiply deltas at each calculation site rather than creating a central "game clock" that diverges from real time. Rationale: simpler, no DB schema changes, timestamps remain debuggable.

3. **Build queue: delta check vs remaining-duration tracking**: Chose `(now - buildStartSec) * multiplier >= buildDuration` formula over refactoring the build queue to delta-based (like research uses `remainingDuration`). Rationale: much smaller code change, acceptable mid-change behavior for admin feature.

4. **Client sync via module state vs React Context**: Chose module-level variable over React Context. Rationale: no provider wrapping needed, all hooks already use module-level imports, 5s staleness is acceptable for a rarely-changing admin value.

5. **Physics acceleration: yes** (per user request). Objects move faster on screen with multiplier. This may make the game harder to play at high multipliers — documented as expected behavior.

6. **Client sync endpoint: piggybacked on /api/user-stats** (per user preference). Avoids extra API calls. Multiplier field added to existing response.

7. **Admin UI: preset buttons + custom form**: Provides quick access to common scenarios (10x/5min) while allowing flexibility for custom values.

---

## Summary of Files

### New Files (7)

| File | Purpose |
|---|---|
| `src/lib/server/timeMultiplier.ts` | TimeMultiplierService singleton |
| `src/lib/client/timeMultiplier.ts` | Client-side multiplier state module |
| `src/app/api/admin/time-multiplier/route.ts` | Admin API for GET/POST multiplier |
| `src/__tests__/lib/timeMultiplier.test.ts` | TimeMultiplierService unit tests |
| `src/__tests__/lib/timeMultiplier-user.test.ts` | User stats with multiplier tests |
| `src/__tests__/lib/timeMultiplier-builds.test.ts` | Build queue with multiplier tests |
| `src/__tests__/api/time-multiplier-api.test.ts` | Admin API endpoint tests |

### Modified Files (12)

| File | Change |
|---|---|
| `src/lib/server/user/user.ts` | Multiply elapsed in `updateStats()` and `updateDefenseValues()` |
| `src/lib/server/techs/TechService.ts` | Multiply elapsed in `processCompletedBuilds()` and `getBuildQueue()` |
| `src/lib/server/battle/battleScheduler.ts` | Divide weapon cooldowns by multiplier |
| `src/shared/src/physics.ts` | Add `timeMultiplier` parameter to all 4 functions |
| `src/lib/server/world/world.ts` | Forward multiplier to physics |
| `src/lib/server/world/worldCache.ts` | Pass multiplier to `updatePhysics()` |
| `src/app/api/user-stats/route.ts` | Add `timeMultiplier` to response |
| `src/app/api/world/route.ts` | Pass multiplier to physics calls |
| `src/lib/client/hooks/useIron/useIron.ts` | Store multiplier from response, pass to prediction |
| `src/lib/client/hooks/useIron/ironCalculations.ts` | Add multiplier param to `calculatePredictedIron()` |
| `src/lib/client/hooks/useDefenseValues.ts` | Apply multiplier to regen interpolation |
| `src/lib/client/hooks/useWorldData.ts` | Pass multiplier to physics extrapolation |
| `src/app/admin/page.tsx` | Add time multiplier control UI section |
| `src/app/admin/AdminPage.css` | Add styles for multiplier controls |

### Possibly Modified (test extensions)

| File | Change |
|---|---|
| `src/__tests__/shared/physics.test.ts` | Add multiplier parameter tests (if exists) |
| `src/__tests__/hooks/useIron.test.ts` | Extend with multiplier prediction tests |
| `src/lib/client/services/userStatsService.ts` | Ensure response type includes `timeMultiplier` |
