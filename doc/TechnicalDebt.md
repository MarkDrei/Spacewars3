# Technical Debt

## Pending Major Upgrades: Next.js 16, ESLint 10, TypeScript 7

**Priority**: Medium
**Added**: 2026-11-08
**Component**: `package.json`, `eslint.config.mjs`, `next.config.ts`

### Context

The dependency refresh on 2026-11-08 (Node 24, Vitest 5, iron-session 9, nodemailer 10, jsdom 31, …)
deliberately left these majors out because each is a migration, not a drop-in update:

- **next 15.5 → 16** and **eslint-config-next 15 → 16**: `npm run lint` uses `next lint`, which prints
  "`next lint` is deprecated and will be removed in Next.js 16". Linting has to move to the ESLint CLI
  first. The PWA plugin (`@ducanh2912/next-pwa`) and `src/middleware.ts` must be verified against Next 16.
- **eslint 9 → 10**: npm marks `eslint@9.39.5` as "no longer supported". `eslint.config.mjs` uses
  `FlatCompat` from `@eslint/eslintrc` to load `next/core-web-vitals`; best done together with
  `eslint-config-next@16` (native flat config).
- **typescript 5.9 → 7**: TypeScript 7 is the native (Go) compiler; the Next.js 15 TypeScript plugin
  and build pipeline target the TS 5 API.

### Consequences

Lint runs on an ESLint major that no longer gets fixes, and the `next lint` deprecation warning
appears in every CI run.

### Proper Solution

One dedicated branch: migrate `npm run lint` to `eslint .`, then upgrade next + eslint-config-next to 16
and eslint to 10 together, run `npm run ci` and check the preview deploy (PWA service worker, middleware,
i18n routing). Evaluate TypeScript 7 once Next.js documents support for it.

### Related Files

- `package.json` — `lint` script, versions
- `eslint.config.mjs` — FlatCompat-based ESLint config
- `next.config.ts` — next-pwa / next-intl plugins

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
