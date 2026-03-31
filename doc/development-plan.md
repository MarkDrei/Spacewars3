# Development Plan: User Statistics System

## Vision

As a player, I want to see detailed statistics about my gameplay (battles fought, damage dealt/received, items collected, iron spent on research/techs) on my Profile page, alongside server-wide averages and top-5 highlights, so I can track my progress and compare against other players.

Implementation follows **Option 3: Event Log + Materialized View Pattern** — all stat-relevant events are captured in a `user_events` table. Pre-computed aggregates are served from a `StatisticsCache` (in-memory). The existing Cache/Repo separation is maintained.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL (new `user_events` table)
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively
- **Lock System**: IronGuard TypeScript Locks — new `LOCK_14` for statistics cache + DB

## Goals

### Goal 1: Event Logging Infrastructure

**Description**: Create the event log table, repo, cache, types, and lock. Events are lightweight rows written at the moment something stat-worthy happens.

**Quality Requirements**: No performance regression on hot paths (harvest, battle resolve, research trigger, build-item). Event writes must be fire-and-forget (non-blocking to the caller's response).

#### Task 1.1: Define Statistics Event Types

**Action**: Create a shared types file defining all event types and their JSONB `event_data` shapes.

**Files**:

- `src/lib/server/statistics/statisticsTypes.ts` — new file

**Details**:
Define a discriminated union of event types:

```
StatEventType = 'battle_completed' | 'item_collected' | 'research_spent' | 'tech_spent'
```

Event data shapes per type:

- **battle_completed**: `{ battleId, opponentId, won: boolean, damageDealt, damageReceived, ironTransferred, xpAwarded, durationSec }`
- **item_collected**: `{ objectType: 'asteroid' | 'shipwreck' | 'escape_pod', ironAwarded }`
- **research_spent**: `{ researchType: ResearchType, level: number, ironCost }`
- **tech_spent**: `{ itemKey: string, itemType: 'weapon' | 'defense', ironCost, count: number }`

Each event row: `{ id, userId, eventType, eventData (JSONB), createdAt (bigint, ms) }`.

#### Task 1.2: Add Lock Level 14

**Action**: Add `STATISTICS_LOCK = LOCK_14` to the typed locks file. This single lock is used for both the statistics cache and database writes. Since statistics are independent of game state and only appended, a single lock at the end of the hierarchy avoids deadlocks.

**Files**:

- `src/lib/server/typedLocks.ts` — add `LOCK_14` import and `STATISTICS_LOCK` export

#### Task 1.3: Database Schema & Migration

**Action**: Add the `user_events` table to the schema and create a migration for it. Increment `SCHEMA_VERSION`.

**Files**:

- `src/lib/server/schema.ts` — add `CREATE TABLE IF NOT EXISTS user_events`
- `src/lib/server/migrations.ts` — add migration for the new table

**Schema**:

```sql
CREATE TABLE IF NOT EXISTS user_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events (event_type);
```

#### Task 1.4: Statistics Repository (DB Layer)

**Action**: Create the repo following the existing pattern (see `battleRepo.ts`, `messagesRepo.ts`). Provides `insertEvent()` and `getAllEvents()` / `getEventsByUser()` for cache initialization.

**Files**:

- `src/lib/server/statistics/statisticsRepo.ts` — new file

**Methods**:

- `insertEvent(context, userId, eventType, eventData)` — single INSERT
- `insertEvents(context, events[])` — batch INSERT for flushing
- `getAllEvents(db)` — load all events (for cache init)
- `getEventsByUserId(db, userId)` — load single user's events

#### Task 1.5: Statistics Cache (In-Memory Aggregation Layer)

**Action**: Create `StatisticsCache` following the existing Cache pattern (singleton via `globalThis`, `initialize()`, `getInstance()`, `resetInstance()`, `shutdown()`). On startup, load all events from DB and pre-compute aggregates. Incoming events are buffered in-memory and flushed to DB periodically (write-behind, like other caches).

**Files**:

- `src/lib/server/statistics/StatisticsCache.ts` — new file

**Key Design**:

- **In-memory state**:
  - `eventBuffer: StatEvent[]` — un-flushed events waiting for DB write
  - `userAggregates: Map<number, UserStatAggregates>` — per-user pre-computed counters
  - `globalAggregates: GlobalStatAggregates` — server-wide totals
- **`recordEvent(context, event)`** — appends to buffer AND updates in-memory aggregates immediately (no lag for reads). Background timer flushes buffer to DB every 60 seconds.
- **`getUserStats(context, userId): UserStatAggregates`** — returns aggregates for one user.
- **`getGlobalStats(context): GlobalStatAggregates`** — returns server-wide totals + averages + top-5 per category.
- Lock usage: `STATISTICS_LOCK` (LOCK_14) for all read/write operations on the cache.
- Background persistence: 60-second interval (less critical than game-state caches).

**Aggregate shapes** (pre-computed):

```typescript
interface UserStatAggregates {
  // Battles
  battlesWon: number;
  battlesLost: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalIronFromBattles: number; // iron won from defeated opponents
  totalXpFromBattles: number;

  // Collection
  asteroidsCollected: number;
  shipwrecksCollected: number;
  escapePodsCollected: number;
  totalIronFromCollection: number;

  // Spending
  totalIronSpentOnResearch: number;
  totalIronSpentOnTechs: number;
  researchCount: number; // number of researches triggered
  techsBought: number; // number of tech items built
}

interface GlobalStatAggregates {
  totalPlayers: number; // number of users with at least one event
  totals: UserStatAggregates; // server-wide sums
  averages: UserStatAggregates; // totals / totalPlayers (per-player average)
  top5: {
    // top 5 users per category
    battlesWon: TopEntry[];
    totalDamageDealt: TopEntry[];
    asteroidsCollected: TopEntry[];
    shipwrecksCollected: TopEntry[];
    escapePodsCollected: TopEntry[];
    totalIronFromCollection: TopEntry[];
    totalIronSpentOnResearch: TopEntry[];
    totalIronSpentOnTechs: TopEntry[];
  };
}

interface TopEntry {
  userId: number;
  username: string;
  value: number;
}
```

Note: `username` in `TopEntry` can be resolved by looking up the UserCache. The cache should accept a username resolver function as dependency during `initialize()`.

#### Task 1.6: Register Cache in Initialization Chain

**Action**: Wire `StatisticsCache.initialize()` into the server startup sequence alongside the other caches. Wire `shutdown()` into the shutdown sequence.

**Files**:

- `src/lib/server/database.ts` or wherever `initializeServerCaches` lives — add StatisticsCache init
- Verify shutdown sequence includes the new cache

---

### Goal 2: Event Emission (Hook Points)

**Description**: Emit stat events at each relevant code location. Events are appended to the StatisticsCache buffer (fire-and-forget). The lock acquisition for STATISTICS_LOCK happens inside `recordEvent`, so callers don't need to manage it.

**Quality Requirements**: Must not block the main response. Must not break existing tests.

#### Task 2.1: Emit `battle_completed` Events

**Action**: In `resolveBattle()` in `battleService.ts`, after the battle is finalized and iron/XP are awarded, emit two events — one for the winner and one for the loser. All required data (damage dealt/received, iron transferred, XP, duration) is already available in `resolveBattle`.

**Files**:

- `src/lib/server/battle/battleService.ts` — add event emission at end of `resolveBattle()`

**Data mapping**:

- Winner event: `damageDealt = winner's totalDamage`, `damageReceived = loser's totalDamage`, `won = true`, `ironTransferred = ironResult.amount`, `xpAwarded`, `durationSec = (battleEndTime - battleStartTime) / 1000`
- Loser event: inverse of above, `won = false`, `ironTransferred = 0` (loser does not track iron loss), `xpAwarded = 0`
- Determine which total damage belongs to which user based on attacker/attackee role vs winner/loser

#### Task 2.2: Emit `item_collected` Events

**Action**: In `performCollectionLogic()` in `harvest/route.ts`, after the object is collected and iron is awarded, emit an event. Data available: `targetObject.type`, `ironReward`.

**Files**:

- `src/app/api/harvest/route.ts` — add event emission after collection success

**Note**: Only emit for `asteroid`, `shipwreck`, `escape_pod` (the three collectible types). This already excludes `player_ship` due to earlier guard.

#### Task 2.3: Emit `research_spent` Events

**Action**: In `performResearchTrigger()` in `trigger-research/route.ts`, after iron is deducted and research is triggered, emit an event with the research type, level, and cost.

**Files**:

- `src/app/api/trigger-research/route.ts` — add event emission after `subtractIron`

**Data mapping**: `researchType`, `level = currentLevel + 1`, `ironCost = cost`

#### Task 2.4: Emit `tech_spent` Events

**Action**: In the `build-item/route.ts`, after all items are queued for building, emit a single event with the total cost.

**Files**:

- `src/app/api/build-item/route.ts` — add event emission after build queue additions

**Data mapping**: `itemKey`, `itemType`, `ironCost = spec.baseCost * count`, `count`

---

### Goal 3: Statistics API Endpoint

**Description**: Create an API route that returns the current user's statistics, global aggregates, averages, and top-5 lists.

#### Task 3.1: Create GET `/api/statistics` Route

**Action**: Create a new API route that reads from `StatisticsCache` and returns the combined data.

**Files**:

- `src/app/api/statistics/route.ts` — new file

**Response shape**:

```typescript
{
  user: UserStatAggregates;       // current user's stats
  global: {
    totalPlayers: number;
    averages: UserStatAggregates; // per-player averages
    top5: { ... };                // top 5 per category
  };
  currentUserId: number;          // so frontend can highlight "you"
}
```

**Auth**: Requires authentication (iron-session), same pattern as other api routes.

---

### Goal 4: Profile Page UI — Statistics Display

**Description**: Extend the Profile page to show a statistics section below the existing battle history. Display the user's own stats, server averages, and highlight when the user is in the top 5.

#### Task 4.1: Create Statistics Display Component

**Action**: Create a React client component that fetches from `/api/statistics` and renders the data.

**Files**:

- `src/components/Statistics/StatisticsPanel.tsx` — new file
- `src/components/Statistics/StatisticsPanel.css` — new file (or use existing CSS approach)

**UI Layout** (suggested):

1. **Section: "Your Statistics"** — Table/grid with stat name, your value, server average, rank indicator
2. Categories grouped:
   - **Combat**: Battles Won, Battles Lost, Total Damage Dealt, Total Damage Received, Iron Won from Battles, XP from Battles
   - **Collection**: Asteroids Collected, Shipwrecks Collected, Escape Pods Collected, Total Iron from Collection
   - **Economy**: Iron Spent on Research, Iron Spent on Tech, Researches Triggered, Tech Items Built
3. Each row: `[Stat Name] [Your Value] [Avg/Player] [🏆 if top 5]`
4. **Top 5 callout**: If user is in top 5 for any stat, show a highlighted badge or glow effect with their rank (e.g., "#2 in Damage Dealt")
5. Consistent with existing Profile page styling (dark space theme, card-based layout)

#### Task 4.2: Integrate into Profile Page

**Action**: Import `StatisticsPanel` into `ProfilePageClient.tsx` and render it below the battle history section.

**Files**:

- `src/app/profile/ProfilePageClient.tsx` — add StatisticsPanel import and render

---

### Goal 5: Testing

**Description**: Unit tests for all new business logic. Integration tests for the API endpoint.

**Quality Requirements**: Test coverage >80% for new code. Follow existing test naming convention `whatIsTested_scenario_expectedOutcome`.

#### Task 5.1: Unit Tests for StatisticsCache Aggregation

**Action**: Test that `recordEvent` correctly updates in-memory aggregates, that `getUserStats` returns correct per-user data, and that `getGlobalStats` computes averages and top-5 correctly.

**Files**:

- `src/__tests__/unit/statistics/StatisticsCache.test.ts` — new file

**Test cases**:

- `recordEvent_battleCompleted_updatesWinLossCounts`
- `recordEvent_itemCollected_incrementsCorrectTypeCounter`
- `recordEvent_researchSpent_accumulatesIronSpent`
- `recordEvent_techSpent_accumulatesIronAndCount`
- `getGlobalStats_multipleUsers_calculatesAveragesCorrectly`
- `getGlobalStats_top5_returnsCorrectRanking`
- `getGlobalStats_top5_handlesFewerThan5Players`

#### Task 5.2: Unit Tests for Statistics Types

**Action**: Validate event data shapes and type guards.

**Files**:

- `src/__tests__/unit/statistics/statisticsTypes.test.ts` — new file

#### Task 5.3: Integration Tests for `/api/statistics`

**Action**: Test the full API flow: emit events through the real code paths, then query the statistics endpoint and validate the response.

**Files**:

- `src/__tests__/integration/statistics.test.ts` — new file

---

## Dependencies

No new npm packages required. Uses existing PostgreSQL driver and iron-session.

## Arc42 Documentation Updates

**Proposed Changes**:

- Update `doc/architecture/building-blocks-cache-systems.md` — add StatisticsCache to the cache inventory table and cache layer diagram
- Mention the Event Log + Materialized View pattern in the architecture decisions section

## Architecture Notes

1. **Event Log + In-Memory Aggregation**: Events are the source of truth (persisted to `user_events`). Aggregates are derived and held in memory. On server restart, aggregates are recalculated from the DB. This gives us full audit trail + fast reads.

2. **Fire-and-forget event emission**: Event recording acquires `STATISTICS_LOCK` (14) internally. Since this lock is at the bottom of the hierarchy (14 > all other locks), it can be safely acquired from any context without deadlock risk. Event emission is async but failures are caught and logged — they never fail the caller's request.

3. **Lock hierarchy addition**: `STATISTICS_LOCK = LOCK_14` fits cleanly at the end:

   ```
   BATTLE(2) → USER(4) → INVENTORY(5) → WORLD(6) → MESSAGE(8) → DB_USERS(10) → DB_SPACE_OBJECTS(11) → DB_MESSAGES(12) → DB_BATTLES(13) → STATISTICS(14)
   ```

4. **Username resolution for top-5**: The StatisticsCache needs usernames for the top-5 display. Rather than duplicating user data, it takes a `usernameResolver: (userId: number) => string | undefined` function during initialization, backed by UserCache lookups.

5. **Eventual consistency**: Statistics reads are always up-to-date in memory (events update aggregates immediately upon `recordEvent`). DB persistence lags behind by up to 60 seconds. On restart, aggregates are rebuilt from DB — any events not yet flushed are lost. This is acceptable for statistics.

## Agent Decisions

1. **Single lock (LOCK_14) for both cache and DB**: As requested. Statistics are independent of game state and only grow (append-only), so a single lock is sufficient and avoids complexity.

2. **In-memory aggregation instead of SQL materialized views**: PostgreSQL materialized views would require `REFRESH MATERIALIZED VIEW` calls and don't fit the existing cache-first architecture. Computing aggregates in-memory on event ingestion is consistent with the project's patterns and gives instant reads.

3. **Fire-and-forget emission pattern**: Events are recorded async. If the statistics system is down, the game continues unaffected. This matches the "no regression on hot paths" requirement.

4. **No separate lock for DB vs cache**: The user requested a single LOCK_14 for both. Given the write-behind pattern (buffer in cache, flush to DB periodically), this is natural — the same lock protects both the in-memory buffer and the DB flush operation.

5. **Top-5 categories chosen**: Selected the most meaningful stats for competitive comparison. Not every counter needs a top-5 (e.g., `battlesLost` is not something to highlight positively).

6. **Escape pods tracked in collection, commanders ignored**: Per user request, escape pod collection is tracked (as an item_collected event), but the commander details are not stored in the statistics event. This can be extended later if needed.

_All open questions resolved._

**Resolved Decisions**:

- DB flush interval: **60 seconds** (less critical than game-state caches)
- Loser iron tracking: **Zero** (loser's event has `ironTransferred: 0`, only winner tracks the transfer amount)
- CSS approach: **Dedicated `StatisticsPanel.css`** (component-level separation)

---

## Implementation Status

**Status**: ✅ COMPLETED  
**Implementation Summary**: Implemented the full user statistics system including event logging infrastructure, event emission from battle/harvest/research/build actions, statistics API, and profile page UI.  
**Files Modified/Created**:

- `src/lib/server/statistics/statisticsTypes.ts` — Created: event types, aggregates, helper functions
- `src/lib/server/statistics/statisticsRepo.ts` — Created: DB operations with LOCK_14
- `src/lib/server/statistics/StatisticsCache.ts` — Created: in-memory cache with background persistence
- `src/lib/server/typedLocks.ts` — Added STATISTICS_LOCK = LOCK_14
- `src/lib/server/schema.ts` — Added user_events table, incremented SCHEMA_VERSION to 14
- `src/lib/server/migrations.ts` — Added migration version 14, applyUserEventsMigration()
- `src/lib/server/main.ts` — Added StatisticsCache initialization
- `src/lib/server/battle/battleService.ts` — Emit battle_completed events at end of resolveBattle
- `src/app/api/harvest/route.ts` — Emit item_collected events after collection
- `src/app/api/trigger-research/route.ts` — Emit research_spent events after research
- `src/app/api/build-item/route.ts` — Emit tech_spent events after build queue addition
- `src/app/api/statistics/route.ts` — Created: GET /api/statistics endpoint
- `src/components/Statistics/StatisticsPanel.tsx` — Created: profile page stats component
- `src/components/Statistics/StatisticsPanel.css` — Created: dark space theme styles
- `src/app/profile/ProfilePageClient.tsx` — Added StatisticsPanel below battle history
- `src/__tests__/helpers/testServer.ts` — Added StatisticsCache shutdown/reset in test helpers
- `src/__tests__/unit/statistics/StatisticsCache.test.ts` — Created: 8 unit tests
- `src/__tests__/unit/statistics/statisticsTypes.test.ts` — Created: 7 unit tests
- `src/__tests__/integration/statistics/statistics.test.ts` — Created: 4 integration tests

**Deviations from Plan**: None significant. The `shutdown()` override follows the same pattern as BattleCache.  
**Arc42 Updates**: None required (no new architectural layer, just addition within existing cache system)  
**Test Results**: ✅ All 1392 tests passing, no linting errors, build succeeds
