# Test File Index

Generated with:

```
find src/__tests__ -name "*.test.ts" -o -name "*.test.tsx" | sort
```

## Classification Annotations

Each test file below may carry an inline annotation to guide test-speed improvements.
Format: `[TAG: one-line reason]`

| Tag             | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| `MOVE→unit`     | Can be moved to unit tests as-is — no DB/server/cache needed          |
| `MOVE→ui`       | Can be moved to UI tests — only needs jsdom/React, no DB              |
| `KEEP`          | Must stay in integration — real DB, auth, or cache required           |
| `REFACTOR→unit` | Could become a unit test after extracting logic or adding mocks       |
| `PARTIAL`       | Split possible: some tests → unit/ui, others must stay in integration |

## Unit Tests (46 files)

No database setup. Fast, isolated tests for pure logic.

- src/**tests**/unit/admin/space-object-count-summary.test.ts _(moved from integration)_
- src/**tests**/unit/components/admin-multiplier-ui.test.ts _(moved from ui — pure inline logic, no React/jsdom)_
- src/**tests**/unit/components/login-business-logic.test.ts _(moved from ui — pure inline logic, no React/jsdom)_
- src/**tests**/unit/components/StatusHeader-business-logic.test.ts _(moved from ui — pure inline logic, no React/jsdom)_
- src/**tests**/unit/components/teleport-service.test.ts _(extracted from ui/teleport-controls — teleportService + UserStatsResponse type tests, no React rendering)_
- src/**tests**/unit/api/collection-api.test.ts _(moved from integration — uses `createMockSessionCookie`)_
- src/**tests**/unit/api/complete-build-api.test.ts _(extracted from integration — auth-guard tests only)_
- src/**tests**/unit/api/inventory-api.test.ts _(extracted from integration — GET+DELETE auth-guard tests only)_
- src/**tests**/unit/api/messages-api.test.ts _(extracted from integration — GET+POST 401 auth-guard tests only)_
- src/**tests**/unit/api/ships-api.test.ts _(moved from integration — mocks fs.readdir, no DB/cache)_
- src/**tests**/unit/api/techtree-api.test.ts _(moved from integration — single 401 test, requireAuth fires before UserCache)_
- src/**tests**/unit/api/teleport-api.test.ts _(extracted from integration — 401 auth-guard test only)_
- src/**tests**/unit/api/teleport-charges.test.ts _(moved from integration — pure User object tests, no DB/cache)_
- src/**tests**/unit/api/time-multiplier-api.test.ts _(extracted from integration — GET+POST 401 auth-guard tests only)_
- src/**tests**/unit/api/trigger-research-api.test.ts _(moved from integration — all 3 tests fire before UserCache)_
- src/**tests**/unit/api/user-battles-api.test.ts _(extracted from integration — 401 auth-guard test only)_
- src/**tests**/unit/api/user-stats-api.test.ts _(extracted from integration — 401 auth-guard test only)_
- src/**tests**/unit/api/world-api.test.ts _(moved from integration — single 401 test, requireAuth fires before WorldCache)_
- src/**tests**/unit/balance/tech-tree-report.test.ts _(moved from integration — pure techtree functions + fs write, no DB/cache)_
- src/**tests**/unit/lib/battle-world-constants.test.ts _(moved from integration — pure shared constant checks)_
- src/**tests**/unit/lib/client-world-constants.test.ts _(moved from integration — client World class, no DB/cache)_
- src/**tests**/unit/lib/Commander.test.ts
- src/**tests**/unit/lib/iron-capacity.test.ts _(moved from integration — pure User object tests, no DB/cache)_
- src/**tests**/unit/lib/ironCalculations.test.ts _(moved from integration — pure client calculation logic)_
- src/**tests**/unit/lib/ironCalculations-multiplier.test.ts _(moved from integration — pure client calculation logic)_
- src/**tests**/unit/lib/ironCalculations-refactored.test.ts _(moved from integration — pure client calculation logic)_
- src/**tests**/unit/lib/pollingUtils.test.ts _(moved from integration — pure client utility, mocked setInterval)_
- src/**tests**/unit/lib/position-normalization-client.test.ts _(moved from integration — client World class, no DB/cache)_
- src/**tests**/unit/lib/research-xp-rewards.test.ts _(moved from integration — pure User/TechTree logic, no DB/cache)_
- src/**tests**/unit/lib/retryLogic.test.ts _(moved from integration — pure client utility logic)_
- src/**tests**/unit/lib/server-constants.test.ts _(moved from integration — pure constant checks)_
- src/**tests**/unit/lib/user-xp-property.test.ts _(moved from integration — pure User object tests)_
- src/**tests**/unit/lib/userrow-type.test.ts _(moved from integration — pure TypeScript type-level tests)_
- src/**tests**/unit/renderers/TargetingLineRenderer.test.ts
- src/**tests**/unit/services/collectionService.test.ts
- src/**tests**/unit/services/factoryService.test.ts
- src/**tests**/unit/services/userStatsService.test.ts
- src/**tests**/unit/shared/physics-multiplier.test.ts
- src/**tests**/unit/shared/physics.test.ts
- src/**tests**/unit/shared/worldConstants.test.ts

## Integration Tests (61 files)

Require PostgreSQL test database. Use `withTransaction` or `initializeIntegrationTestServer`.

- src/**tests**/integration/api/admin-api.test.ts `[PARTIAL: 401 test fires before UserCache (→ unit); 403 needs UserCache for userId→username lookup; 200 tests read real DB data]`
- src/**tests**/integration/api/admin/spawn-objects.test.ts `[PARTIAL: 401 test fires before UserCache (→ unit); 403 needs UserCache for userId→username; spawn tests write DB + WorldCache]`
- src/**tests**/integration/api/auth-api.test.ts `[KEEP: tests the register/login routes themselves — mocking would bypass the integration under test]`
- src/**tests**/integration/api/bridge-auto-transfer-api.test.ts `[PARTIAL: 401 test fires before UserCache (→ unit); all other tests seed DB inventory/bridge state via direct SQL]`
- src/**tests**/integration/api/complete-build-api.test.ts `[KEEP: 403 + 200 tests need real DB user and build queue; auth-guard tests extracted to unit/api/complete-build-api.test.ts]`
- src/**tests**/integration/api/inventory-api.test.ts `[KEEP: functional tests seed DB via direct SQL; 401 guards extracted to unit/api/inventory-api.test.ts; move/401 stays here (UserCache init before requireAuth)]`
- src/**tests**/integration/api/messages-api.test.ts `[PARTIAL: 401 tests extracted to unit/api/messages-api.test.ts; remaining tests use MessageCache + DB]`
- src/**tests**/integration/api/teleport-api.test.ts `[PARTIAL: 401 test extracted to unit/api/teleport-api.test.ts; remaining tests use UserCache]`
- src/**tests**/integration/api/time-multiplier-api.test.ts `[PARTIAL: GET+POST 401 tests extracted to unit/api/time-multiplier-api.test.ts; remaining tests need UserCache for admin check]`
- src/**tests**/integration/api/user-battles-api.test.ts `[PARTIAL: 401 test extracted to unit/api/user-battles-api.test.ts; remaining tests use BattleCache + DB]`
- src/**tests**/integration/api/user-registration-cache.test.ts `[KEEP: all tests use UserCache + DB]`
- src/**tests**/integration/api/user-stats-api.test.ts `[PARTIAL: 401 test extracted to unit/api/user-stats-api.test.ts; remaining tests use UserCache + DB]`
- src/**tests**/integration/battlecache-integration.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/battlecache-simple.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/battle-defense-persistence.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/battle-flow-e2e.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/battle-iron-transfer.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/battle-research-effects.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/build-persistence-integration.test.ts `[KEEP: uses DB persistence]`
- src/**tests**/integration/cache/build-queue-persistence.test.ts `[KEEP: uses DB + cache persistence]`
- src/**tests**/integration/cache/user-persistence.test.ts `[KEEP: uses UserCache + DB]`
- src/**tests**/integration/defense-value-persistence.test.ts `[KEEP: uses DB persistence]`
- src/**tests**/integration/lib/battle/battleScheduler.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/lib/BridgeService.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/build-xp-rewards.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/game-collection-logic.test.ts `[KEEP: uses WorldCache + UserCache + DB]`
- src/**tests**/integration/lib/Game-targeting.test.ts `[KEEP: uses WorldCache + DB]`
- src/**tests**/integration/lib/InterceptCalculator.test.ts `[KEEP: uses WorldCache + DB]`
- src/**tests**/integration/lib/intercept-calculator-world-integration.test.ts `[KEEP: uses WorldCache + DB]`
- src/**tests**/integration/lib/InventoryService.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/MessageCache-collection-summarization.test.ts `[KEEP: uses MessageCache + DB]`
- src/**tests**/integration/lib/MessageCache-persistence-after-summarization.test.ts `[KEEP: uses MessageCache + DB]`
- src/**tests**/integration/lib/MessageCache-race-condition.test.ts `[KEEP: uses MessageCache + DB]`
- src/**tests**/integration/lib/MessageCache-summarization.test.ts `[KEEP: uses MessageCache + DB]`
- src/**tests**/integration/lib/MessageCache-summary-accumulation.test.ts `[KEEP: uses MessageCache + DB]`
- src/**tests**/integration/lib/MessageCache.test.ts `[KEEP: uses MessageCache + DB]`
- src/**tests**/integration/lib/messagesRepo.test.ts `[KEEP: uses DB directly]`
- src/**tests**/integration/lib/picture-id.test.ts `[KEEP: verifies DB schema + seed data via direct DB queries]`
- src/**tests**/integration/lib/position-normalization-worldRepo.test.ts `[KEEP: inserts/queries DB rows directly to verify normalization]`
- src/**tests**/integration/lib/TechFactory.test.ts `[KEEP: uses UserCache + DB]`
- src/**tests**/integration/lib/techRepo-notifications.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/TechService.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/techtree.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/timeMultiplier-battles.test.ts `[KEEP: uses BattleCache + DB]`
- src/**tests**/integration/lib/timeMultiplier-builds.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/timeMultiplier-client.test.ts `[KEEP: uses WorldCache + DB]`
- src/**tests**/integration/lib/timeMultiplier.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/timeMultiplier-user.test.ts `[KEEP: uses UserCache + DB]`
- src/**tests**/integration/lib/userCache.test.ts `[KEEP: tests UserCache singleton + DB]`
- src/**tests**/integration/lib/user-collection-rewards.test.ts `[KEEP: uses UserCache + DB]`
- src/**tests**/integration/lib/user-domain.test.ts `[KEEP: uses UserCache + DB]`
- src/**tests**/integration/lib/user-level-system.test.ts `[KEEP: uses UserCache + DB]`
- src/**tests**/integration/lib/userrow-interface.test.ts `[KEEP: queries DB to verify UserRow interface matches schema]`
- src/**tests**/integration/lib/user-ship-creation.test.ts `[KEEP: uses DB + WorldCache]`
- src/**tests**/integration/lib/user-xp-persistence.test.ts `[KEEP: uses DB + UserCache persistence]`
- src/**tests**/integration/lib/worldCache.test.ts `[KEEP: tests WorldCache singleton + DB]`
- src/**tests**/integration/lib/world-initialization.test.ts `[KEEP: uses WorldCache + DB]`
- src/**tests**/integration/lib/World.test.ts `[KEEP: uses WorldCache + DB]`
- src/**tests**/integration/lib/xp-migration.test.ts `[KEEP: uses DB + UserCache]`
- src/**tests**/integration/lib/xp-schema-definition.test.ts `[KEEP: first 3 tests check SQL strings; last 3 query DB — kept together to avoid split complexity]`
- src/**tests**/integration/testServer-minimal.test.ts `[KEEP: tests server initialization + DB]`

## UI Tests (9 files)

jsdom environment. Test React components and hooks.

- src/**tests**/ui/components/inventory-grid.test.tsx `[KEEP: uses React render + fireEvent on InventoryGridComponent]`
- src/**tests**/ui/components/researchPageClient.test.tsx `[KEEP: uses React render + screen on ResearchPageClient]`
- src/**tests**/ui/components/teleport-controls.test.tsx `[PARTIAL: teleportService + type tests extracted to unit/components/teleport-service.test.ts; GamePageClient UI tests kept here (React render + screen)]`
- src/**tests**/ui/hooks/useBuildQueue.test.ts `[KEEP: uses renderHook from @testing-library/react — requires jsdom]`
- src/**tests**/ui/hooks/useFactoryDataCache.test.ts `[KEEP: uses renderHook + waitFor from @testing-library/react — requires jsdom]`
- src/**tests**/ui/hooks/useIron.test.ts `[KEEP: uses renderHook + waitFor from @testing-library/react — requires jsdom]`
- src/**tests**/ui/hooks/useIron-timeMultiplier.test.ts `[KEEP: uses renderHook + waitFor from @testing-library/react — requires jsdom]`
- src/**tests**/ui/hooks/useIron-xp-display.test.ts `[KEEP: uses renderHook + waitFor from @testing-library/react — requires jsdom]`
- src/**tests**/ui/hooks/useTechCounts.test.ts `[KEEP: uses renderHook + act from @testing-library/react — requires jsdom]`
