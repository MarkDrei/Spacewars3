# Development Plan: Afterburner Active Ability

## Vision

As a player, I can activate an afterburner ability that temporarily boosts my ship's speed beyond the normal maximum, with a cooldown period before I can use it again. The afterburner is gated by three researches: Duration (unlock + duration length), Cooldown (cooldown reduction), and Speed Increase (boost magnitude). Both duration and cooldown are affected by the global timeMultiplier. The existing passive "Afterburner" research is removed and replaced entirely by this active ability system.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL (but afterburner state is in-memory only)
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively
- **Lock System**: IronGuard TypeScript Locks

## Project Structure

Follows existing project layout — see `copilot-instructions.md`.

---

## Goals

### Goal 1: Refactor Research Definitions

**Description**: Replace the passive `Afterburner` research with three active-ability researches matching the user's specifications. Add a new `AfterburnerCooldown` research type.

**Quality Requirements**: All existing tests pass. Research page displays correctly. No breaking changes to users with existing tech trees (backward-compatible defaults).

#### Task 1.1: Add `AfterburnerCooldown` to `ResearchType` enum

**Action**: Add `AfterburnerCooldown = 'afterburnerCooldown'` to the `ResearchType` enum.

**Files**:

- `src/shared/src/types/gameTypes.ts` — add enum value

#### Task 1.2: Update `AllResearches` definitions

**Action**: Modify the three existing afterburner research entries and add the new `AfterburnerCooldown` research.

Changes to `AllResearches`:

**Remove** the base `Afterburner` research entry entirely (lines 71-82 currently). It is no longer a standalone research.

**Modify `AfterburnerDuration`**:

- `level: 0` (starts locked — level 0 means no afterburner available)
- `baseUpgradeCost: 2000`
- `baseUpgradeDuration: 45`
- `baseValue: 30` (30 seconds at level 1)
- `baseValueIncrease: { type: 'constant', value: 10 }` (+10 seconds per level)
- `upgradeCostIncrease`: keep existing or adjust
- `unit: 'seconds'`
- `description`: "Unlocks the afterburner and increases its active duration."

**Add `AfterburnerCooldown`**:

- `type: ResearchType.AfterburnerCooldown`
- `name: 'Afterburner Cooldown'`
- `level: 1` (starts researched at 1 hour cooldown)
- `baseUpgradeCost: 2000`
- `baseUpgradeDuration: 45`
- `baseValue: 3600` (1 hour = 3600 seconds at level 1)
- `baseValueIncrease: { type: 'factor', value: 0.9 }` (-10% per level — each level multiplies by 0.9)
- `upgradeCostIncrease`: same pattern as other afterburner researches
- `unit: 'seconds'`
- `description`: "Reduces the cooldown time between afterburner activations."
- `treeKey: 'afterburnerCooldown'`

**Modify `AfterburnerSpeedIncrease`**:

- `level: 1` (starts at 50% speed boost — unchanged)
- `baseUpgradeCost: 2000`
- `baseUpgradeDuration: 45`
- `baseValue: 50` (50% at level 1 — unchanged)
- `baseValueIncrease: { type: 'constant', value: 25 }` (+25% per level — changed from +10)
- `unit: '%'`

**Files**:

- `src/lib/server/techs/techtree.ts` — modify `AllResearches` map entries

#### Task 1.3: Update `TechTree` interface and related functions

**Action**:

- Remove `afterburner: number` field from `TechTree` interface
- Add `afterburnerCooldown: number` field to `TechTree` interface
- Keep `afterburnerDuration` and `afterburnerSpeedIncrease` fields
- Update `createInitialTechTree()`: remove `afterburner`, add `afterburnerCooldown: 1`, set `afterburnerDuration: 0` (was 1)
- Update `getResearchLevelFromTree()`: remove `Afterburner` case, add `AfterburnerCooldown` case
- Update `updateTechTree()`: remove `Afterburner` case, add `AfterburnerCooldown` case
- Add `AfterburnerCooldown` to `IMPLEMENTED_RESEARCHES` set
- Add `AfterburnerDuration` to `IMPLEMENTED_RESEARCHES` set (if not already there)
- Add `AfterburnerSpeedIncrease` to `IMPLEMENTED_RESEARCHES` set (if not already there)
- Remove `Afterburner` from `IMPLEMENTED_RESEARCHES` set (if present)

**Files**:

- `src/lib/server/techs/techtree.ts` — interface, createInitialTechTree, switch cases, IMPLEMENTED_RESEARCHES

#### Task 1.4: Update client-side `TechTree` interface

**Action**: Mirror server-side changes: remove `afterburner`, add `afterburnerCooldown`.

**Files**:

- `src/lib/client/services/researchService.ts` — update TechTree interface

#### Task 1.5: Update Research Page display

**Action**:

- Remove `Afterburner` from `researchTypeToKey` mapping
- Add `AfterburnerCooldown` to `researchTypeToKey` mapping (key: `'afterburnerCooldown'`)
- Update `researchHierarchy`: nest Duration, Cooldown, and SpeedIncrease under Ship Speed. The hierarchy should be:
  ```
  Ship > ShipSpeed > [AfterburnerDuration, AfterburnerCooldown, AfterburnerSpeedIncrease]
  ```
- Add research icon image for AfterburnerCooldown (can reuse existing afterburner icon or create a variant)

**Files**:

- `src/app/research/ResearchPageClient.tsx` — researchTypeToKey, researchHierarchy
- `public/assets/images/research/` — add icon for AfterburnerCooldown (optional, can reuse existing)

#### Task 1.6: Update UserBonusCache to remove passive afterburner from maxShipSpeed

**Action**: The current `maxShipSpeed` formula includes `(1 + afterburnerEffect / 100)`. This must be removed since afterburner is no longer passive. New formula:

```
maxShipSpeed = ShipSpeed_effect × levelMultiplier × commanderMultipliers.shipSpeed
```

The afterburner speed boost will be applied dynamically when afterburner is activated, not baked into the permanent maxShipSpeed.

**Files**:

- `src/lib/server/bonus/UserBonusCache.ts` — remove afterburner from maxShipSpeed formula
- `src/lib/server/bonus/userBonusTypes.ts` — update comment on maxShipSpeed field

#### Task 1.7: Write unit tests for research definition changes

**Action**: Test that:

- `AfterburnerCooldown` research exists in `AllResearches` with correct values
- `AfterburnerDuration` starts at level 0 with correct values
- `AfterburnerSpeedIncrease` starts at level 1 with correct values (+25% per level)
- `getResearchEffect()` computes correctly for AfterburnerCooldown (factor-based: 3600 × 0.9^(level-1))
- `createInitialTechTree()` has correct initial values (duration=0, cooldown=1, speedIncrease=1)
- Old `Afterburner` enum value still exists (for backward compat) but is NOT in IMPLEMENTED_RESEARCHES

**Files**:

- `src/__tests__/unit/` — new or extended test file for afterburner research definitions

---

### Goal 2: Afterburner State Management (In-Memory)

**Description**: Create an in-memory store for tracking active afterburner state per player, including activation time, duration, cooldown, and speed restoration.

**Quality Requirements**: Thread-safe in single-threaded Node.js. Properly handles server restarts (state is lost, which is acceptable). Integrates with timeMultiplier.

#### Task 2.1: Create AfterburnerState types

**Action**: Define types for the afterburner state:

```typescript
interface AfterburnerState {
  userId: number;
  activatedAtMs: number; // Date.now() when activated
  durationMs: number; // total duration in ms (from research, NOT time-multiplied — raw)
  cooldownMs: number; // total cooldown in ms (from research, raw)
  boostedSpeed: number; // the speed set during boost
}
```

Note: No pre-activation speed is stored. When the afterburner expires, the ship speed is simply capped at the user's current maxSpeed (from bonuses). Duration and cooldown are stored as raw values. The timeMultiplier is applied when checking elapsed time, not when storing the state. This way, if timeMultiplier changes during an active afterburner, the change takes effect immediately.

**Files**:

- `src/lib/server/afterburner/afterburnerTypes.ts` — new file

#### Task 2.2: Create AfterburnerService

**Action**: Create a service class that manages afterburner state. Singleton pattern matching existing codebase conventions (globalThis-based, resetInstance for tests).

Methods:

- `activate(userId, durationMs, cooldownMs, boostedSpeed): void` — stores state
- `getState(userId): AfterburnerState | null` — returns state if active or on cooldown
- `isActive(userId, timeMultiplier): boolean` — checks if boost is still active (accounting for timeMultiplier)
- `isOnCooldown(userId, timeMultiplier): boolean` — checks if cooldown is still active
- `canActivate(userId, timeMultiplier): boolean` — returns true if not active and not on cooldown
- `getBoostRemainingMs(userId, timeMultiplier): number` — remaining boost time
- `getCooldownRemainingMs(userId, timeMultiplier): number` — remaining cooldown time
- `checkAndExpire(userId, timeMultiplier): { expired: boolean } | null` — checks if boost has expired, returns non-null if expired
- `clearState(userId): void` — removes state (for cleanup)
- `resetInstance(): void` — static, for test isolation

**Time multiplier integration pattern**: Instead of storing wallclock end times, store raw durations and activation time. Compute elapsed effective time as:

```
effectiveElapsedMs = (Date.now() - activatedAtMs) × timeMultiplier
```

Then compare against raw durationMs/cooldownMs.

**Files**:

- `src/lib/server/afterburner/AfterburnerService.ts` — new file

#### Task 2.3: Write unit tests for AfterburnerService

**Action**: Test all AfterburnerService methods:

- `activate_storesState_stateRetrievable`
- `isActive_withinDuration_returnsTrue`
- `isActive_afterDuration_returnsFalse`
- `isOnCooldown_afterDurationBeforeCooldownEnd_returnsTrue`
- `isOnCooldown_afterCooldownEnd_returnsFalse`
- `canActivate_noState_returnsTrue`
- `canActivate_duringBoost_returnsFalse`
- `canActivate_duringCooldown_returnsFalse`
- `canActivate_afterCooldownEnd_returnsTrue`
- `checkAndExpire_boostExpired_returnsNonNull`
- `checkAndExpire_boostNotExpired_returnsNull`
- `timeMultiplier_doublesEffectiveElapsedTime`
- `timeMultiplier_changesMidBoost_affectsRemainingTime`
- `clearState_removesState`

**Files**:

- `src/__tests__/unit/afterburner/AfterburnerService.test.ts` — new file

---

### Goal 3: Afterburner API Endpoint

**Description**: Create a POST `/api/afterburner` endpoint that activates the afterburner for the current user.

**Quality Requirements**: Proper authentication, input validation, lock ordering, error handling.

#### Task 3.1: Create POST `/api/afterburner` route

**Action**: Create the API endpoint with:

1. **Authentication**: Use session middleware to verify user is logged in
2. **Lock acquisition**: Acquire USER_LOCK and WORLD_LOCK (follow existing lock ordering patterns)
3. **Validation**:
   - Check `AfterburnerDuration` research level ≥ 1 (must have researched duration to unlock)
   - Check afterburner is not already active and not on cooldown (via AfterburnerService)
4. **Compute values**:
   - `durationMs = getResearchEffectFromTree(techTree, AfterburnerDuration) × 1000`
   - `cooldownMs = getResearchEffectFromTree(techTree, AfterburnerCooldown) × 1000` (always valid since AfterburnerCooldown starts at level 1)
   - `speedIncreasePercent = getResearchEffectFromTree(techTree, AfterburnerSpeedIncrease)`
   - `maxSpeed = bonuses.maxShipSpeed` (from UserBonusCache)
   - `boostedSpeed = maxSpeed × (1 + speedIncreasePercent / 100)`
   - `preActivationSpeed = playerShip.speed` (current ship speed)
5. **Apply boost**:
   - Set `playerShip.speed = boostedSpeed` in the world
   - Call `AfterburnerService.activate(userId, durationMs, cooldownMs, boostedSpeed)` to store state
6. **Return response**:
   ```json
   {
     "success": true,
     "boostedSpeed": 75.0,
     "previousSpeed": 25.0,
     "durationMs": 30000,
     "cooldownMs": 3600000,
     "maxSpeed": 25.0
   }
   ```

**Note**: AfterburnerCooldown starts at level 1, so `getResearchEffect` always returns a valid value (3600s at level 1, decreasing by 10% per level).

**Files**:

- `src/app/api/afterburner/route.ts` — new file

#### Task 3.2: Integrate afterburner expiration into world physics update

**Action**: When `world.updatePhysics()` is called, check all players with active afterburners via `AfterburnerService`. For each expired afterburner:

1. Call `checkAndExpire(userId, timeMultiplier)`
2. If expired, cap ship speed at the user's normal maxSpeed: `playerShip.speed = min(playerShip.speed, bonuses.maxShipSpeed)` — this brings the speed back down to normal max if it was boosted, but preserves any manual speed reduction
3. Clear the afterburner state

This requires the world update to have access to AfterburnerService. The cleanest approach is to call afterburner expiration checks in the same place where `updatePhysics` is called.

**Note on split-physics**: PR #22 did a complex split-physics calculation (move to cooldown point, restore speed, continue). For simplicity in the initial implementation, we check expiration at each physics tick. If the tick interval is small enough (polling-based updates), the error is negligible. If needed, split-physics can be added later.

**Files**:

- `src/lib/server/world/world.ts` — add afterburner expiration check in or around `updatePhysics()`
- Alternatively, the expiration check can be in the WorldCache layer that calls `updatePhysics()`

#### Task 3.3: Extend ship-stats API with afterburner status

**Action**: Add afterburner status to the ship-stats response:

```json
{
  "afterburner": {
    "isActive": true,
    "boostRemainingMs": 15000,
    "cooldownRemainingMs": 0,
    "canActivate": false,
    "durationResearchLevel": 2,
    "boostedSpeed": 75.0
  }
}
```

This allows the client to display afterburner state without a separate API call.

**Files**:

- `src/app/api/ship-stats/route.ts` — add afterburner status to response

#### Task 3.4: Write unit tests for afterburner API

**Action**: Tests for the API route:

- `POST_noAuth_returns401`
- `POST_noDurationResearch_returns400`
- `POST_alreadyActive_returns400`
- `POST_onCooldown_returns400`
- `POST_success_returnsBoostData`
- `POST_success_setsShipSpeed`

**Files**:

- `src/__tests__/unit/api/afterburner-api.test.ts` — new file

#### Task 3.5: Write integration tests for afterburner flow

**Action**: End-to-end integration tests:

- `afterburner_activateAndExpire_speedRestored`
- `afterburner_activateWhileOnCooldown_rejected`
- `afterburner_durationResearchLevel0_cannotActivate`
- `afterburner_withTimeMultiplier_durationExpiresEarlier`

**Files**:

- `src/__tests__/integration/afterburner.test.ts` — new file

---

### Goal 4: Game Page UI — Afterburner Button

**Description**: Add an afterburner activation button to the game page with real-time status display.

**Quality Requirements**: Responsive, clear state indication, accessible.

#### Task 4.1: Create afterburner client service

**Action**: Create a client-side service for afterburner API calls:

- `activateAfterburner(): Promise<AfterburnerResponse>` — calls POST `/api/afterburner`
- Type-safe request/response interfaces

**Files**:

- `src/lib/client/services/afterburnerService.ts` — new file

#### Task 4.2: Add afterburner UI to GamePageClient

**Action**: Add afterburner button and status display to the game page. Button states:

1. **Available** (duration level ≥ 1, not active, not on cooldown): Orange button "🔥 Activate Afterburner"
2. **Active** (boost running): Pulsing/glowing button showing remaining duration "⚡ Active (15s)"
3. **Cooldown** (cooling down): Gray button showing remaining cooldown "Cooldown (45:30)"
4. **Not Researched** (duration level 0): Gray disabled button "Afterburner (Not Researched)"

State management:

- Poll afterburner status from ship-stats response (already fetched periodically)
- Local countdown timer for smooth UI updates between polls
- Refresh ship data after activation

**Files**:

- `src/app/game/GamePageClient.tsx` — add afterburner button and state

#### Task 4.3: Write UI tests for afterburner button

**Action**: Test button rendering in different states.

**Files**:

- `src/__tests__/ui/afterburner-button.test.tsx` — new file

---

### Goal 5: Cleanup and Backward Compatibility

**Description**: Ensure existing users with old tech trees are handled gracefully, remove dead code.

#### Task 5.1: Handle legacy tech trees

**Action**: When `userFromRow()` deserializes a tech tree that has the old `afterburner` field but no `afterburnerCooldown`:

- The `createInitialTechTree()` merge pattern in `userFromRow()` already handles this — new fields get default values from `createInitialTechTree()`
- Verify this works by checking the merge logic in `userFromRow()`
- The old `afterburner` field in the JSON will be ignored (no corresponding TechTree property)

**Files**:

- `src/lib/server/user/userRepo.ts` — verify merge logic handles new/removed fields

#### Task 5.2: Remove `ResearchType.Afterburner` enum value

**Action**: Decision needed — the `Afterburner` enum value is referenced in multiple places. Two options:

1. **Keep the enum value** but remove from `AllResearches` and `IMPLEMENTED_RESEARCHES` — simplest, no breaking changes
2. **Remove entirely** — cleaner but requires updating all references

**Recommendation**: Keep the enum value for now, mark with a comment `/** @deprecated — replaced by AfterburnerDuration/Cooldown/SpeedIncrease */`. Remove from `AllResearches` map. This avoids breaking serialized data that may reference it.

Actually, the `AllResearches` map must include ALL `ResearchType` values because `researchTypeToKey` is `Record<ResearchType, keyof TechTree>`. If we remove `Afterburner` from the enum, we also remove it from the record. If we keep it in the enum but remove from `AllResearches`, code that does `AllResearches[ResearchType.Afterburner]` will fail.

**Revised approach**: Keep `ResearchType.Afterburner` in the enum. Keep it in `AllResearches` but mark as deprecated/hidden. Remove from `IMPLEMENTED_RESEARCHES` (already not there). Remove from `researchHierarchy` so it doesn't appear in the research page. Keep in `researchTypeToKey` for type safety. The TechTree interface still needs to handle legacy data gracefully — add `afterburner?: number` as an optional deprecated field or remove it and rely on merge logic.

**Simplest approach**:

- Keep `ResearchType.Afterburner` in enum
- Keep definition in `AllResearches` (but NOT in `IMPLEMENTED_RESEARCHES`)
- Remove `afterburner` from `TechTree` interface
- Remove from `researchHierarchy` (already not shown if not in IMPLEMENTED)
- Update `researchTypeToKey`: map `Afterburner` to a dummy/ignored key or handle specially
- Update `getResearchLevelFromTree`: return 0 for `Afterburner` always
- `UserBonusCache`: remove afterburner effect from maxShipSpeed formula (already in Task 1.6)

**Files**:

- Various files as listed in Tasks 1.2–1.6

#### Task 5.3: Verify and run all tests

**Action**: Run `npm test` and `npm run lint` and `npm run build` to verify nothing is broken.

**Files**: No file changes — verification step.

---

## Dependencies

No new npm packages required. All functionality uses existing libraries (iron-session, Next.js, React).

## Arc42 Documentation Updates

**Proposed Changes**:

- Update `doc/architecture/arc42-architecture.md` — add Afterburner subsystem as a new building block if architecturally significant. Given that it's an in-memory cache + API route + UI button, it may be too small for Arc42. **Recommendation**: Skip Arc42 update unless the pattern is novel.

## Architecture Notes

### Key Design Decisions

1. **In-memory state**: Afterburner state is NOT persisted to database. Server restart clears all active afterburners. This is acceptable because:
   - Afterburner duration is short (30s+)
   - Server restarts are infrequent
   - Users can simply re-activate after restart
2. **TimeMultiplier integration**: Raw durations are stored; timeMultiplier is applied when computing effective elapsed time. This means a timeMultiplier change mid-boost takes effect immediately.

3. **Speed restoration**: When afterburner expires, current speed is capped at normal maxSpeed: `newSpeed = Math.min(ship.speed, bonuses.maxShipSpeed)`. No old speed is stored. This means:
   - If player manually reduced speed during boost, the lower speed is kept (since it's ≤ maxSpeed)
   - If player was at full boosted speed, it's capped back to normal maxSpeed
   - Simple, no pre-activation state tracking needed

4. **Cooldown always available**: `AfterburnerCooldown` starts at level 1 (1 hour base cooldown). `getResearchEffect()` always returns a valid value. No special handling for level 0 needed.

5. **No passive afterburner in maxShipSpeed**: The existing `(1 + afterburnerEffect / 100)` factor is removed from `UserBonusCache.maxShipSpeed`. Afterburner only applies during active boost.

6. **Research hierarchy**: Duration is the "unlock" research (level 0 = locked). SpeedIncrease starts at level 1 (always has a boost %). Cooldown starts at level 1 (1 hour base, reduces with upgrades).

### Lock Ordering for Afterburner API

Following existing patterns:

1. Session authentication (no lock)
2. Acquire USER_LOCK (LOCK_4) via UserCache
3. Read user data, compute bonuses
4. Acquire WORLD_LOCK (LOCK_6) via WorldCache
5. Find player ship, apply speed boost
6. Store state in AfterburnerService (no lock needed — atomic Map operation)

## Agent Decisions

1. **In-memory over DB**: User explicitly chose in-memory storage. Simplifies implementation — no schema migration, no DB writes during activation/expiration.

2. **Replace passive afterburner**: User chose to remove the passive permanent speed boost entirely. The three active-ability researches are the only afterburner mechanics.

3. **Speed restoration = cap current speed at maxSpeed**: User specified no need to store old speed. When afterburner expires, just cap current speed at the user's research-based maxSpeed: `min(currentSpeed, bonuses.maxShipSpeed)`.

4. **Both duration and cooldown affected by timeMultiplier**: User confirmed both should be accelerated.

5. **Keeping ResearchType.Afterburner enum value**: For backward compatibility with serialized data and type safety. Marked as deprecated, not shown in UI, not in IMPLEMENTED_RESEARCHES.

6. **Simple expiration check (no split-physics)**: PR #22 used complex split-physics for mid-update expiration. We start with simple per-tick expiration checks. Can enhance later if needed.

7. **AfterburnerCooldown starts at level 1**: Always provides a valid cooldown value. No need for hardcoded defaults.

8. **No admin page changes**: User explicitly stated "No content to the admin page."

## Open Questions

_No open questions remain. All decisions have been resolved with user input._
