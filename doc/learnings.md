# Project Learnings

## Database Setup for Tests

### Issue Discovered (2026-02-10)

Tests require PostgreSQL databases to be running and the `POSTGRES_TEST_PORT` environment variable to be set to `5433`.

### Solution

1. Start both databases: `docker compose up db db-test -d`
2. Export the test port: `export POSTGRES_TEST_PORT=5433`
3. Run tests: `npm run test:ci`

## XP Level System Progression Formula

**Discovered by**: Knight  
**Context**: When implementing the level system (Tasks 2.2-2.4), discovered the correct interpretation of the progression pattern  
**Details**: 

The level system uses triangular number progression for XP requirements:
- Each level N requires triangular number (N-1) * 1000 XP to reach from the previous level
- Triangular number k = k*(k+1)/2
- Total XP for level N = sum of triangular numbers from 1 to N-1

Example progression:
- Level 1: 0 XP
- Level 2: 1,000 XP (triangular 1 = 1*2/2 = 1)
- Level 3: 4,000 XP (1000 + triangular 2 * 1000 = 1000 + 3000)
- Level 4: 10,000 XP (4000 + triangular 3 * 1000 = 4000 + 6000)
- Level 10: 165,000 XP (sum of triangular 1-9)

This creates an exponential curve that makes higher levels significantly harder to achieve while keeping early progression accessible.

**Implementation tip**: Use iterative calculation in getLevel() for O(√n) complexity, and direct formula in getXpForNextLevel() for O(n) calculation of the sum.

## XP Reward Integration Pattern

**Discovered by**: Knight  
**Context**: When implementing build XP rewards (Tasks 3.1-3.2), discovered the clean pattern for integrating XP rewards with existing systems  
**Details**:

When adding XP rewards to existing completion flows:
1. **Modify completion method** to return level-up info instead of void
2. **Calculate XP reward** based on the resource cost (e.g., iron_cost / 100 for builds)
3. **Call user.addXp(amount)** which returns `{ leveledUp: boolean, oldLevel: number, newLevel: number } | undefined`
4. **Return level-up info** to the caller so they can send notifications
5. **Send level-up notification** in the caller's context with format: `P: 🎉 Level Up! You reached level {newLevel}! (+{xp} XP from {source})`

Example from TechService.applyCompletedBuild:
```typescript
const xpReward = Math.floor(spec.baseCost / 100);
const levelUp = user.addXp(xpReward);
if (levelUp) {
  return { ...levelUp, xpReward };
}
```

**Research-specific considerations** (Goal 4):
- Research XP formula: `iron_cost / 25` (more generous than builds due to time investment)
- Use `completedLevel + 1` when calculating cost to get the cost of the level just completed
- updateTechTree captures level BEFORE increment to ensure correct cost calculation
- User.updateStats handles XP awarding inline since research completion happens during stat updates

**Benefits of this pattern**:
- Separation of concerns: completion logic calculates rewards, caller handles notifications
- User XP is modified in-place, persisted by existing cache update calls
- Level-up info includes both old/new levels for rich notification messages
- Notifications use existing MessageCache infrastructure with `P:` prefix for positive messages

## Hook Extension Pattern for Related Data

**Discovered by**: Knight  
**Context**: When implementing UI display for XP/Level (Goal 5), had to decide between extending useIron hook vs creating separate useXpLevel hook  
**Details**:

When adding new data fields that come from the same API endpoint as existing hook data:
- **Prefer extending the existing hook** rather than creating a new one
- **Benefits**:
  - Reduces API calls (one poll serves multiple data types)
  - Shares polling mechanism, retry logic, error handling
  - Maintains data consistency (iron and XP are always in sync)
  - Reduces component complexity (one hook call instead of multiple)
- **When to create a separate hook instead**:
  - Data comes from different API endpoint
  - Different polling frequencies needed
  - Independent error handling required
  - Data updates are triggered by different events

**Implementation approach** (Goal 5):
```typescript
// Extended useIron to return XP data alongside iron data
const { ironAmount, xp, level, xpForNextLevel, isLoading, error } = useIron(5000);
// vs creating separate hooks requiring multiple API calls:
// const { ironAmount } = useIron(5000);
// const { xp, level } = useXpLevel(5000); // would duplicate polling and API calls
```

**Result**: Single unified hook provides all user stats with consistent state updates and minimal API overhead.
## Time-Based Calculation Patterns in the Codebase

**Discovered by**: Cartographer  
**Context**: When planning the Time Multiplier feature, discovered the two distinct patterns for time calculations

**Two time-calculation patterns in the server:**

1. **Delta-based** (User stats, defense regen, research): `elapsed = now - lastTimestamp`, then uses `elapsed` in calculations. Timestamp updated to `now` after. Easy to apply a multiplier — just multiply the delta.

2. **Absolute-timestamp-based** (Build queue): `completionTime = startTime + duration`, then checks `now >= completionTime`. Harder to apply a multiplier because the duration is baked into an absolute time. Workaround: check `(now - startTime) * multiplier >= duration`.

**Key locations of time-based game logic (`Date.now()` calls):**
- `userCache.getUserByIdWithLock()` → calls `user.updateStats(Math.floor(Date.now() / 1000))`
- `TechService.processCompletedBuilds()` → `now = Math.floor(Date.now() / 1000)` for build completion
- `TechService.addTechItemToBuildQueue()` → `user.buildStartSec = Math.floor(Date.now() / 1000)`
- `battleScheduler.processBattleRoundInternal()` → `currentTime` for weapon cooldowns
- `worldCache.getWorldFromCache()` → `world.updatePhysics(context, Date.now())`
- Physics uses milliseconds (`Date.now()`), user stats use seconds (`Math.floor(Date.now() / 1000)`)

**TimeProvider interface** exists in `battleSchedulerUtils.ts` for test injection — not for game features. A time multiplier should be separate from this (multiplied deltas vs mocked time).

## Client-Side Module-Level State Pattern

**Discovered by**: Cartographer  
**Context**: When deciding how to share the time multiplier across multiple client hooks without React Context

**Pattern**: For rarely-changing server values needed by multiple hooks (e.g., time multiplier), use a module-level variable instead of React Context:
- Export `get`/`set` functions from a module
- One hook (the data source) calls `set` on each poll
- Other hooks call `get` during their interpolation ticks
- Avoids React Context provider wrapping and re-render cascading
- Acceptable staleness: value changes rarely (admin action), max lag = poll interval (5s)