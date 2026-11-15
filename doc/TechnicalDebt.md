# Technical Debt

## Quest Effects Are Not Atomic

**Priority**: Medium
**Added**: 2026-11-15
**Component**: `src/lib/server/quests/QuestService.ts`

### Context

A mission action changes up to four things: the mission state (`quest_progress`), the inventory
(`inventories`: cargo, commander reward), the user (XP, iron, through `UserCache`) and the notifications.
`QuestService.run` stores mission state and inventory in two statements while it holds
USER_INVENTORY_LOCK, then grants XP and iron under USER_LOCK (write-behind persistence), then sends
the notifications. There is no database transaction around these steps.

### Consequences

If the server stops between the steps, a mission can be stored as completed while the cargo is still
in the inventory, or while XP and iron were not persisted yet (the user cache flushes every 30 s).
The window is short and the worst case is a lost reward for one player, but it cannot be repaired
without the admin tools.

### Proper Solution

Store mission state and inventory in one transaction (one connection, `BEGIN … COMMIT`), and persist
the user row in the same step instead of waiting for the background flush — or store pending rewards
in the mission state and pay them idempotently.

### Related Files

- `src/lib/server/quests/QuestService.ts` — `run`, `grantRewards`
- `src/lib/server/quests/QuestRepo.ts`, `src/lib/server/inventory/InventoryService.ts` — the two writes

---

## Hostile NPC State Lives in Memory Only

**Priority**: Low
**Added**: 2026-11-15
**Component**: `src/lib/server/npc/NPCManager.ts`

### Context

Defeated hostile ships, their respawn times and the ambush grace period are kept in the `NPCManager`
singleton. A server restart (every deploy) or a level-up of the player regenerates the ships.

### Consequences

After a restart all hostile ships are back at once, including the ones with long respawn times
(pirates: midnight UTC). A player can collect the victory iron again earlier than intended.

### Proper Solution

Persist the defeat time per player and ship (for example in `quest_progress.data`) and restore it when
the ships are generated.

### Related Files

- `src/lib/server/npc/NPCManager.ts` — `getNpcsForPlayer`, `markDefeated`

---

## Location Visits and Ambushes Depend on the World Poll

**Priority**: Low
**Added**: 2026-11-15
**Component**: `src/app/api/world/route.ts` (`applyShipPosition`)

### Context

Whether a ship is inside a location or inside the attack range of an aggressive NPC is checked when
the client polls `GET /api/world`. The server does not check positions on its own.

### Consequences

A ship that crosses a location or a patrol while no page polls the world (other page open, tab in the
background, browser closed) neither discovers the location nor gets ambushed. A fast ship can cross a
small radius between two polls.

### Proper Solution

Check positions in a server-side tick (for example together with the physics update), or test the
path flown since the last check instead of the current position.

### Related Files

- `src/app/api/world/route.ts` — `applyShipPosition`
- `src/lib/server/quests/QuestService.ts` — `recordVisits`
- `src/lib/server/npc/NPCManager.ts` — `findAmbusher`

---

## All Stations Share One Picture

**Priority**: Low
**Added**: 2026-11-15
**Component**: `src/shared/starbases.ts`

### Context

The world has three stations, but only one station image (`station1.png`) is in the repository. All
stations use `picture_id: 1`.

### Consequences

The stations can only be told apart by their name label on the map.

### Proper Solution

Add the additional station images and give each entry of `STATION_DEFINITIONS` its own `picture_id`.

### Related Files

- `src/shared/starbases.ts` — `STATION_DEFINITIONS`, `STARBASES`

---

## Untranslated Status Texts in the Inventory UI

**Priority**: Low
**Added**: 2026-11-15
**Component**: `src/components/Inventory/InventorySection.tsx`

### Context

The status line of the inventory builds its texts in code ("Move failed", "Transfer failed", "Delete
failed", "Save failed", "Failed to load inventory") instead of reading them from the locale catalogues.
The texts existed before the mission system; the rejection of deleting mission cargo is shown through
the same line.

### Consequences

German players see English status texts on the Ship page.

### Proper Solution

Move the texts to `src/locales/en.json` / `de.json` and return translated errors from the inventory
routes, as the mission routes do.

### Related Files

- `src/components/Inventory/InventorySection.tsx` — status texts
- `src/app/api/inventory/route.ts` — error responses

---

## TypeScript 6 Kept Alongside TypeScript 7 for Tooling API

**Priority**: Low
**Added**: 2026-11-08
**Component**: `package.json` (`typescript`, `typescript7`)

### Context

TypeScript 7 (native Go compiler) ships no stable JavaScript API. `typescript-eslint` (used by
`eslint-config-next/typescript`) loads `require("typescript")` and supports only `typescript < 6.1`.
The project therefore installs both:

- `typescript` → `npm:@typescript/typescript6` (6.0, JS API + `tsc6` bin) — used by ESLint and by
  `next build`, which type-checks via the package's `tsc6` CLI (`experimental.useTypeScriptCli`, default in Next 16.4).
- `typescript7` → `npm:typescript@7` — provides the `tsc` bin used by `npm run typecheck`.

CI therefore type-checks with both compilers. `src/__tests__/unit/lib/typedLocks-order.test.ts` guards
that the IronGuard lock order is still enforced at compile time.

### Consequences

Two TypeScript versions to keep in sync; editor/IDE language service and `next build` use TypeScript 6.

### Proper Solution

When TypeScript 7.1 ships a stable API and `typescript-eslint` supports it, replace both entries with a
single `typescript@^7` dependency and re-run `npm run ci`.

### Related Files

- `package.json` — `typescript` / `typescript7` aliases, `typecheck` script

## Build Statistics Record Orders, Not Charges

**Priority**: Low
**Added**: 2026-11-08
**Component**: `src/app/api/build-item/route.ts`, `src/lib/server/techs/TechService.ts`

### Context

`POST /api/build-item` records one `tech_spent` event per order with `ironCost = spec.baseCost` and
`count` items. Iron is, however, only charged when an item actually starts building: the first item
when the queue was empty, every later item (and each repetition of a "forever" build) inside
`TechService.processCompletedBuilds`. Those later charges emit no statistics event, and an order
placed behind a running build records a cost although nothing was charged. Aborted queues still
count as "builds completed".

### Consequences

`totalIronSpentOnBuilds` and `totalBuildsCompleted` on the statistics page are approximations.

### Proper Solution

Emit `tech_spent` from `TechService` at the moment iron is subtracted (one event per started item)
and count completed builds in `applyCompletedBuild`. Remove the event from the build-item route.

### Related Files

- `src/app/api/build-item/route.ts` — records the event today
- `src/lib/server/techs/TechService.ts` — `addTechItemToBuildQueue`, `processCompletedBuilds`
- `src/lib/server/statistics/StatisticsCache.ts` — `tech_spent` aggregation

## Admin Access by Username (Resolve Before Going Live)

**Priority**: High (before production use) — currently accepted for the test phase
**Added**: 2026-11-08
**Component**: `src/shared/adminAccess.ts`, `src/lib/server/seedData.ts`

### Context

Admin/developer access (admin APIs, admin page, build cheat mode) is granted to the usernames
`a` and `q` (`isAdminUsername`). `a` is seeded with password `a` in every environment; `q` is not
seeded, so whoever registers `q` first becomes admin. Decision (2026-11-08): keep this during the
test phase, fix before going live.

### Consequences

On a public deployment anyone could gain admin rights (`q`) or log in as `a`/`a`, read all user
data from `/api/admin/database`, spawn objects and change the time multiplier.

### Proper Solution

Grant admin rights explicitly (DB flag or environment variable), reserve the admin names at
registration, and do not seed `a`/`a` outside development and test.

### Related Files

- `src/shared/adminAccess.ts` — single place of the check
- `src/lib/server/seedData.ts` — seeds user `a`
- `src/lib/server/user/usernameValidation.ts` — registration rules

## Content Security Policy Without Script and Connection Rules

**Priority**: Medium
**Added**: 2026-11-11
**Component**: `src/shared/securityHeaders.ts`, `next.config.ts`

### Context

The Content Security Policy only contains directives that cannot break rendering
(`frame-ancestors`, `base-uri`, `form-action`, `object-src`). It has no `script-src`, `style-src`
or `connect-src`. Next.js renders inline scripts for hydration, so a useful `script-src` needs a
nonce per request (set in a Next.js proxy/middleware file, which does not exist yet), and the policy has to be checked in a real
browser on all pages (canvas game, service worker, PWA manifest). No browser is available on the
development VPS.

### Consequences

If a cross-site scripting bug is ever introduced, the browser does not stop the injected script
from running or from sending data to other servers. React escapes all rendered text and the code
uses no `dangerouslySetInnerHTML`, so there is no known injection point today.

### Proper Solution

Add a nonce-based policy (`default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; …`)
following the Next.js CSP guide, first as `Content-Security-Policy-Report-Only`, check the browser
console on every page (e.g. in the Playwright screenshot workflow), then enforce it.

### Related Files

- `src/shared/securityHeaders.ts` — current headers
- `.github/workflows/screenshots.yml` — Playwright run that could assert "no CSP violations"

## Read Notifications Are Never Deleted

**Priority**: Medium (grows with the number of players)
**Added**: 2026-11-12
**Component**: `src/lib/server/messages/MessageCache.ts`, `src/lib/server/messages/messagesRepo.ts`

### Context

`MessageCache.deleteOldReadMessages()` / `messagesRepo.deleteOldReadMessages()` exist and are tested,
but no production code calls them. Every notification (battle rounds, harvests, ...) stays in the
`messages` table forever.

### Consequences

The table and the per-user message lists in the cache grow without limit. The index
`idx_messages_recipient_created` keeps the per-user query fast, memory and disk still grow.

### Proper Solution

Decide the retention (product decision: e.g. read notifications older than 30 days), then call the
cleanup periodically (start-up plus a daily timer) or when a user's messages are loaded.

### Related Files

- `src/lib/server/messages/MessageCache.ts` — `deleteOldReadMessages()`
- `src/lib/server/messages/messagesRepo.ts` — `deleteOldReadMessages()`

## User Persistence: One UPDATE per User While USER_LOCK Is Held

**Priority**: Low at the current size, High with many concurrent players
**Added**: 2026-11-12
**Component**: `src/lib/server/user/userCache.ts`

### Context

The background persistence (every 30 s) takes the global `USER_LOCK` and then writes every dirty
user with its own `UPDATE` (`persistDirtyUsers()` → `persistUserToDb()`), awaiting each one.

### Consequences

All requests that need a user wait for the whole write. With N dirty users this is N database
round trips under the lock.

### Proper Solution

Copy the dirty users' values under the lock and write after releasing it, or write all users in
one statement (`UPDATE ... FROM UNNEST(...)`), as `saveWorldToDb()` does for space objects.

### Related Files

- `src/lib/server/user/userCache.ts` — `backgroundPersist()`, `persistDirtyUsers()`
- `src/lib/server/user/userRepo.ts` — `persistUserToDb()`

## Migrations: Every Check Runs at Every Start

**Priority**: Low
**Added**: 2026-11-12
**Component**: `src/lib/server/migrations.ts`

### Context

`migrations.ts` has 830 lines and 17 `apply...Migration` functions. `applyTechMigrations()` runs all
of them at every server start; each one checks the schema (`information_schema`, `IF NOT EXISTS`)
instead of relying on a recorded schema version. `SCHEMA_VERSION` in `schema.ts` is maintained by
hand next to it.

### Consequences

The start-up issues dozens of statements that do nothing, the file only grows, and a migration
that is not idempotent would run again on every start.

### Proper Solution

Record applied migrations in a table (`schema_migrations`) and run only the missing ones, one file
per migration; fold the old ones into the base schema once all databases are past them.

### Related Files

- `src/lib/server/migrations.ts`
- `src/lib/server/schema.ts` — `SCHEMA_VERSION`, `CREATE_TABLES`

## Session and Error Handling Repeated in Every API Route

**Priority**: Low
**Added**: 2026-11-12
**Component**: `src/app/api/**/route.ts`

### Context

43 of 47 route handlers repeat the same lines: `getIronSession(...)`, `requireAuth(session.userId)`,
`try { ... } catch (error) { return handleApiError(error); }`.

### Consequences

A change to authentication (e.g. the admin check, session invalidation) has to be made in every
route, and a route that forgets one of the lines is not noticed.

### Proper Solution

A wrapper such as `withAuth(async (request, userId) => ...)` (and `withAdmin`) that owns session
loading, the auth check and the error mapping.

### Related Files

- `src/lib/server/errors.ts` — `requireAuth()`, `handleApiError()`
- `src/lib/server/session.ts`

## Password Rules and Sessions After a Password Change (Product Decisions)

**Priority**: Medium (before going live)
**Added**: 2026-11-12
**Component**: `src/app/api/register/route.ts`, `src/app/api/reset-password/route.ts`, `src/lib/server/session.ts`

### Context

- A password only has to be non-empty (minimum length 1).
- The session is a sealed cookie that contains only the user id and is valid for 24 hours. Changing
  or resetting the password does not end sessions that already exist on other devices.

### Consequences

Weak passwords are accepted (the login rate limit slows guessing down, it does not prevent it).
Someone who took over a session keeps it for up to 24 hours after the owner changed the password.

### Proper Solution

Decide a minimum length. For sessions: store a session version (or the time of the last password
change) per user, put it into the cookie and compare it when the session is loaded.

### Related Files

- `src/app/api/register/route.ts`, `src/app/api/reset-password/route.ts` — password validation
- `src/lib/server/session.ts` — session cookie

## Leftover Files and Smaller Clean-ups in the Server Code

**Priority**: Low
**Added**: 2026-11-12
**Component**: repository root, `src/app/login/`, `src/lib/server/`

### Context

- `src/app/login/page_new.tsx` is not a route (only `page.tsx` is) and nothing imports it.
- `render.yaml` and `vercel.json` describe deployments on Render/Vercel; the project is deployed
  with Docker on the VPS. `README.md` and `doc/MAIL_SERVER_SETUP.md` still refer to them.
- `main.ts` passes the start-up lock context (`ctx15`) into the username resolver of the
  `StatisticsCache`; the resolver runs later, after that context was disposed.
- `User.create()` takes about 20 positional parameters, and users loaded by the `UserCache` carry a
  save callback that does nothing (the cache persists them); only the register route uses a real one.
- `UserCache`, `MessageCache` and `BattleCache` still log single operations (message created,
  loaded, marked as read); the per-request and per-cycle logs were removed on 2026-11-12.

### Consequences

Dead files and misleading APIs cost time when reading the code; `user.save()` on a cached user
silently does nothing.

### Proper Solution

Delete the unused files after confirming that no other deployment uses them and update the README;
give the resolver its own lock context per call; replace the positional parameters by an object
and remove the save callback in favour of the cache.

### Related Files

- `src/app/login/page_new.tsx`, `render.yaml`, `vercel.json`
- `src/lib/server/main.ts`
- `src/lib/server/user/user.ts`, `src/lib/server/user/userRepo.ts`

## Minor Balance Change: Multiplicative Accuracy Refactor (Task 1.1)

**Priority**: Low  
**Added**: 2026-01-XX  
**Component**: Weapon accuracy calculation (`techtree.ts`, `TechFactory.ts`)

### Context

The `getWeaponAccuracyModifierFromTree()` function was refactored from an additive bonus system (`baseAccuracy + (effect - researchBaseValue)`) to a multiplicative factor system (`baseAccuracy × effect/researchBaseValue`) to enable consistent multiplicative semantics for the bonus system.

### Balance Impact

The two formulas are only numerically equivalent when `weapon.baseAccuracy === research.baseValue`. For `auto_turret` (baseAccuracy=50) with `ProjectileAccuracy` research (researchBaseValue=70), the multiplicative formula produces **lower** accuracy at research levels 2+:

| Level | Old Accuracy (additive) | New Accuracy (multiplicative) | Delta   |
| ----- | ----------------------- | ----------------------------- | ------- |
| 1     | 50.0%                   | 50.0%                         | 0pp     |
| 2     | 54.9%                   | 53.5%                         | −1.4pp  |
| 5     | 84.2%                   | 74.5%                         | −9.8pp  |
| 10    | 156.6%\*                | 126.1%\*                      | −30.4pp |

\*Values above 100% are capped in gameplay

**Energy accuracy is unaffected**: `pulse_laser.baseAccuracy (65) === EnergyAccuracy.researchBaseValue (65)`, so both formulas produce identical results at all levels.

### Why Accepted

Pure multiplicative semantics are required for the bonus system (Goal 2) to apply level/commander multipliers uniformly. Adjusting the research coefficients to preserve the old additive values would defeat the purpose of the refactor. The balance impact is minor for typical research levels (≤ level 3 at game launch). Tests explicitly document and assert the divergence.

### Proper Solution (if balance becomes a concern)

Adjust the `auto_turret` base accuracy value in the weapon spec to match the research base value (70), or introduce per-weapon accuracy scaling. This would require a balance review pass.

### Related Files

- `src/lib/server/techs/techtree.ts` — `getWeaponAccuracyModifierFromTree()`
- `src/lib/server/techs/TechFactory.ts` — `calculateWeaponDamage()`
- `src/__tests__/unit/lib/weapon-modifier-equivalence.test.ts` — divergence tests

---

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

## Defense Value Regeneration in Attack Route

**Priority**: Low  
**Added**: 2025-10-28  
**Component**: Attack API Route

### Problem

The attack route (`src/app/api/attack/route.ts`) was temporarily modified to call `updateDefenseValues()` and write the results back to cache before initiating battle. This violates the separation of concerns:

- Defense value regeneration should be handled by the **world loop** (periodic background process)
- API routes should not perform world state updates
- This creates duplicate logic and potential race conditions

### Current State

No world loop exists in the codebase. Defense values (`updateDefenseValues()`) are only updated in specific API routes (`ship-stats`, `user-stats`, etc.) that happen to touch the user. Since the attack route does not call `updateDefenseValues()`, defense values at battle time can be stale if the player hasn't polled those routes recently.

### Proper Solution

Either:

1. Implement a **server-side world loop** (background process) that periodically calls `updateDefenseValues()` for all active users and persists via `updateUserInCache`, OR
2. Call `updateDefenseValues()` inside `initiateBattle()` in `battleService.ts` for both attacker and defender — this is simpler and keeps timing deterministic (defense is up-to-date at the moment combat opens).

### Related Files

- `src/app/api/attack/route.ts` - Attack API route
- `src/lib/server/user/user.ts` - User class with `updateDefenseValues()` method
