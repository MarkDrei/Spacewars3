# Battle Scheduler Testability Restoration

## Summary

Successfully restored Phase 3 (Battle Scheduler Testability) improvements from the `feat/betterDamage` branch and adapted them to work with the current PostgreSQL-based implementation.

## Commits Restored

- **7579098**: "intermediate for better testability"
- **69196eb**: "Refactor battleScheduler to use injectable dependencies"
- **c36f90d**: "Add stopBattleScheduler call to shutdownIntegrationTestServer"
- **a0184d4**: "Add battleScheduler unit tests"
- **5844904**: "Fix calculateDistance to use toroidal distance and correct world size"

## Files Modified

### 1. `src/lib/server/battle/battleScheduler.ts` (Major Changes)

**Dependency Injection Pattern Added:**
- Added `initializeBattleScheduler(config)` function that accepts:
  - `messageCache`: Required MessageCache instance
  - `timeProvider`: Optional custom time provider (defaults to `realTimeProvider`)
  - `defaultCooldown`: Optional default weapon cooldown (defaults to 5 seconds)
  - `schedulerIntervalMs`: Optional scheduler interval (defaults to 1000ms)
  - `scheduler`: Optional custom setInterval function (for testing)
  - `canceller`: Optional custom clearInterval function (for testing)

- Added `resetBattleScheduler()` function for test cleanup:
  - Stops the scheduler
  - Clears configuration
  - Resets scheduler/canceller functions to defaults

- Module-level state management:
  - `config`: Stores the merged configuration
  - `schedulerInterval`: Tracks the interval handle
  - `schedulerFn`: Stored scheduler function for testability
  - `cancellerFn`: Stored canceller function for testability

**Time Provider Abstraction:**
- Added `getTimeProvider()` helper that returns the configured time provider
- Added `getCurrentTime()` helper that uses the time provider
- Replaced direct `Math.floor(Date.now() / 1000)` calls with `getCurrentTime()`
- Allows tests to inject mock time providers for controlled time testing

**Helper Functions Moved from BattleEngine:**
- `isWeaponReady()`: Check if weapon cooldown has expired
- `getReadyWeapons()`: Get all weapons ready to fire
- `applyDamageWithLock()`: Apply damage directly to user defenses
- `isBattleOver()`: Check if battle has ended
- `getBattleOutcome()`: Determine winner and loser

**Battle Resolution Moved from BattleService:**
- `resolveBattle()`: Complete battle resolution function with proper endStats
- `getShipPosition()`: Get ship position from World cache
- `updateUserBattleState()`: Update user's battle state
- `generateTeleportPosition()`: Generate random teleport position
- `teleportShip()`: Teleport ship to new position
- `getUserShipId()`: Get user's ship ID

**Toroidal Distance Fixes:**
- Added `getWorldSize()` function that returns `{ width: 500, height: 500 }`
  - Matches the actual world size from `src/lib/server/world/world.ts`
  - Previous hardcoded value was 3000x3000 (incorrect)

- Added `getMinTeleportDistance()` function that calculates `world width / 3`
  - Dynamic calculation based on world size (~166.67 for 500x500 world)
  - Previous hardcoded value was 1000 (too large for 500x500 world)

- Updated `generateTeleportPosition()` to use `calculateToroidalDistance`:
  - Imported from `@shared/physics`
  - Properly handles world wrapping for distance calculation
  - Previous implementation used simple Euclidean distance

- Fixed fallback teleport positions:
  - Changed from `{ x: 0 or WORLD_WIDTH, y: 0 or WORLD_HEIGHT }`
  - To `{ x: 0 or worldSize.width - 1, y: 0 or worldSize.height - 1 }`
  - Ensures positions stay within world bounds

**Message Cache Integration:**
- `createMessage()` now uses injected `config.messageCache.createMessage()`
- Falls back gracefully with warning if scheduler not initialized
- Previous implementation used direct `sendMessageToUser()` import

**Scheduler Functions Updated:**
- `startBattleScheduler()`: Now uses `setupBattleScheduler()` with `schedulerFn`
- `stopBattleScheduler()`: Now uses `cancelBattleScheduler()` with `cancellerFn`
- Both functions use the injectable dependencies for testability

### 2. `src/lib/server/main.ts`

**Added Battle Scheduler Initialization:**
```typescript
import { initializeBattleScheduler } from "./battle/battleScheduler";

// After BattleCache initialization:
initializeBattleScheduler({ messageCache });
```

This replaces the previous approach where the scheduler was started directly without dependency injection.

### 3. `src/__tests__/helpers/testServer.ts`

**Added Scheduler Cleanup:**
```typescript
import { stopBattleScheduler } from '@/lib/server/battle/battleScheduler';

export async function shutdownIntegrationTestServer(): Promise<void> {
  // Stop battle scheduler first
  stopBattleScheduler();
  
  // ... rest of shutdown logic
}
```

This ensures the scheduler is properly stopped during test cleanup to prevent background processing and timing issues.

### 4. `src/__tests__/lib/battle/battleScheduler.test.ts`

**Test Structure Updated:**

1. **BattleSchedulerUtils Tests:**
   - `realTimeProvider.now_returnsCurrentTimeInSeconds`: Validates time provider
   - `setupBattleScheduler_callsSchedulerWithCorrectParams`: Tests scheduler setup
   - `setupBattleScheduler_returnsIntervalId`: Validates return value
   - `cancelBattleScheduler_callsCancellerWithIntervalId`: Tests cancellation

2. **BattleScheduler Configuration Tests:**
   - `initializeBattleScheduler_withMinimalConfig_startsScheduler`: Tests default config
   - `initializeBattleScheduler_withCustomInterval_usesCustomInterval`: Tests custom interval
   - `initializeBattleScheduler_withCustomTimeProvider_usesCustomTimeProvider`: Tests time provider injection
   - `resetBattleScheduler_afterInit_callsCanceller`: Tests cleanup
   - `resetBattleScheduler_withoutInit_doesNotThrow`: Tests safe cleanup

3. **Integration Tests:**
   - `processActiveBattles_noActiveBattles_completesWithoutError`: Tests empty state
   - `processActiveBattles_withActiveBattle_processesRound`: Tests battle processing
   - `weaponCooldown_withMockTime_respectsCooldown`: Tests cooldown behavior

**Test Improvements:**
- Uses `initializeBattleScheduler` and `resetBattleScheduler` for setup/teardown
- Injects mock schedulers and time providers for deterministic testing
- Tests weapon cooldown behavior with controlled time
- Tests message cache integration
- All integration tests use proper cache initialization via `initializeIntegrationTestServer()`

## Dependency Injection Pattern

### How It Works

1. **Configuration Phase** (in `main.ts`):
   ```typescript
   initializeBattleScheduler({ 
     messageCache,
     timeProvider: realTimeProvider,  // optional
     schedulerIntervalMs: 1000         // optional
   });
   ```

2. **Production Runtime**:
   - Uses `realTimeProvider` for actual system time
   - Uses `setInterval` for scheduling
   - Uses injected `messageCache` for notifications

3. **Test Runtime**:
   ```typescript
   // Inject mock dependencies
   const mockTimeProvider = { now: () => mockTime };
   const mockScheduler = vi.fn().mockReturnValue(intervalId);
   const mockCanceller = vi.fn();
   
   initializeBattleScheduler(
     { 
       messageCache: mockMessageCache,
       timeProvider: mockTimeProvider
     },
     mockScheduler,
     mockCanceller
   );
   
   // Test behavior with controlled time
   // ...
   
   // Clean up
   resetBattleScheduler();
   ```

### Benefits

1. **Testability**: Tests can inject mock time providers to control time progression
2. **Isolation**: Tests can inject mock schedulers to avoid real timers
3. **Flexibility**: Easy to swap implementations without changing core logic
4. **Determinism**: Tests are repeatable with controlled dependencies
5. **Clean State**: `resetBattleScheduler()` ensures clean state between tests

## Toroidal Distance Implementation

### Problem

The previous implementation used:
- Simple Euclidean distance: `Math.sqrt(dx*dx + dy*dy)`
- World size: 3000x3000 (incorrect)
- Min teleport distance: 1000 (too large)

This didn't account for world wrapping, causing incorrect distance calculations near world edges.

### Solution

Now uses `calculateToroidalDistance` from `@shared/physics`:

```typescript
function calculateToroidalDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  worldBounds: WorldBounds
): number {
  // Take the shortest distance considering wrapping
  const dx = Math.min(
    Math.abs(pos1.x - pos2.x),
    worldBounds.width - Math.abs(pos1.x - pos2.x)
  );
  const dy = Math.min(
    Math.abs(pos1.y - pos2.y),
    worldBounds.height - Math.abs(pos1.y - pos2.y)
  );
  
  return Math.sqrt(dx * dx + dy * dy);
}
```

This correctly handles:
- World edges that wrap around
- Finding the shortest path through wrapping
- Consistent distance calculation for teleportation

### World Size Correction

- **Old**: 3000x3000 (hardcoded, incorrect)
- **New**: 500x500 (matches actual world from `World.createDefault()`)
- **Min Teleport**: Changed from 1000 to `worldSize.width / 3` ≈ 166.67

## PostgreSQL Adaptations

All changes maintained PostgreSQL compatibility:

1. **Cache System**: Uses existing cache delegation pattern
2. **Transactions**: Works with transaction-based test isolation
3. **Lock Management**: Properly acquires and releases typed locks
4. **Database Operations**: All DB access through cache layer

No direct database access was added - all operations go through the cache system.

## Testing Strategy

### Unit Tests

Test individual components in isolation:
- Time provider behavior
- Scheduler setup/cancellation
- Configuration merging
- Cleanup functions

### Integration Tests

Test with real cache and database:
- Battle processing flow
- Weapon cooldown behavior
- Message creation
- Battle resolution

All integration tests:
- Use `initializeIntegrationTestServer()` for setup
- Use `shutdownIntegrationTestServer()` for cleanup
- Can use transaction wrappers for isolation (future enhancement)

## Verification Steps

1. **TypeScript Compilation**: ✅ No errors (`npx tsc --noEmit`)
2. **Linting**: ✅ Only warnings, no errors (`npm run lint`)
3. **Code Review**: ✅ Addressed all feedback:
   - Added constants for magic numbers (SECONDS_TO_MILLISECONDS, MAX_TELEPORT_ATTEMPTS)
   - Added TODO for future WorldCache integration
   - Fixed Date.now() to use getCurrentTime() for consistency
4. **Security Check**: ✅ No vulnerabilities found (CodeQL)
5. **Full Test Suite**: Pending (requires DB connection for integration tests)

## Known Issues

None identified during implementation.

## Next Steps

1. Run full test suite to verify all tests pass
2. Address any test failures
3. Get code review feedback
4. Merge into main branch

## Related Documentation

- **Phase 1**: Cache System (CACHE_RESTORATION_SUMMARY.md)
- **Phase 2**: Battle Damage (BATTLE_DAMAGE_RESTORATION.md)
- **Phase 3**: This document (Battle Scheduler Testability)

## Code Quality Improvements

Based on code review feedback, the following improvements were made:

1. **Magic Number Elimination**:
   - Added `SECONDS_TO_MILLISECONDS` constant (1000) for time unit conversion
   - Added `MAX_TELEPORT_ATTEMPTS` constant (100) for teleport position generation

2. **Time Provider Consistency**:
   - Changed `Date.now()` to `getCurrentTime() * SECONDS_TO_MILLISECONDS` in teleportShip
   - Ensures all time operations use the injectable TimeProvider for testability

3. **Future Refactoring Notes**:
   - Added TODO in `getWorldSize()` to refactor for getting actual size from WorldCache
   - Currently hardcoded to 500x500 to avoid lock context complexity

## Technical Debt

**World Size Hardcoding (Low Priority)**:
- `getWorldSize()` currently returns hardcoded 500x500
- Should be refactored to read from WorldCache
- Requires passing lock context through call chain
- Documented with TODO for future enhancement
- Not critical as world size is consistent across codebase

**Previous Technical Debt Resolved**:
None added. The changes actually improve code quality by:
- Making the scheduler more testable
- Fixing incorrect world size and distance calculations
- Centralizing battle resolution logic
- Adding proper dependency injection
- Eliminating magic numbers
