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

## Unit Tests (10 files)

No database setup. Fast, isolated tests for pure logic.

- src/**tests**/unit/admin/space-object-count-summary.test.ts _(moved from integration)_
- src/**tests**/unit/api/collection-api.test.ts _(moved from integration — uses `createMockSessionCookie`)_
- src/**tests**/unit/lib/Commander.test.ts
- src/**tests**/unit/renderers/TargetingLineRenderer.test.ts
- src/**tests**/unit/services/collectionService.test.ts
- src/**tests**/unit/services/factoryService.test.ts
- src/**tests**/unit/services/userStatsService.test.ts
- src/**tests**/unit/shared/physics-multiplier.test.ts
- src/**tests**/unit/shared/physics.test.ts
- src/**tests**/unit/shared/worldConstants.test.ts

## Integration Tests (81 files)

Require PostgreSQL test database. Use `withTransaction` or `initializeIntegrationTestServer`.

- src/**tests**/integration/api/admin-api.test.ts `[KEEP: tests real login/session flow, reads seeded DB data — mocking would hollow out the test value]`
- src/**tests**/integration/api/admin/spawn-objects.test.ts `[KEEP: spawn tests write to DB + WorldCache; auth-only cases (401/403) are too few to justify extraction]`
- src/**tests**/integration/api/auth-api.test.ts `[KEEP: tests register/login with real bcrypt + DB user creation — mocking would bypass the integration under test]`
- src/**tests**/integration/api/bridge-auto-transfer-api.test.ts `[KEEP: all functional tests seed DB inventory/bridge state via direct SQL and verify via follow-up API calls]`
- src/**tests**/integration/api/complete-build-api.test.ts
- src/**tests**/integration/api/complete-build-notifications.test.ts
- src/**tests**/integration/api/inventory-api.test.ts
- src/**tests**/integration/api/messages-api.test.ts
- src/**tests**/integration/api/ships-api.test.ts
- src/**tests**/integration/api/techtree-api.test.ts
- src/**tests**/integration/api/teleport-api.test.ts
- src/**tests**/integration/api/teleport-charges.test.ts
- src/**tests**/integration/api/time-multiplier-api.test.ts
- src/**tests**/integration/api/trigger-research-api.test.ts
- src/**tests**/integration/api/user-battles-api.test.ts
- src/**tests**/integration/api/user-registration-cache.test.ts
- src/**tests**/integration/api/user-stats-api.test.ts
- src/**tests**/integration/api/world-api.test.ts
- src/**tests**/integration/balance/tech-tree-report.test.ts
- src/**tests**/integration/battlecache-integration.test.ts
- src/**tests**/integration/battlecache-simple.test.ts
- src/**tests**/integration/battle-defense-persistence.test.ts
- src/**tests**/integration/battle-flow-e2e.test.ts
- src/**tests**/integration/battle-iron-transfer.test.ts
- src/**tests**/integration/battle-research-effects.test.ts
- src/**tests**/integration/build-persistence-integration.test.ts
- src/**tests**/integration/cache/build-queue-persistence.test.ts
- src/**tests**/integration/cache/user-persistence.test.ts
- src/**tests**/integration/defense-value-persistence.test.ts
- src/**tests**/integration/lib/battle/battleScheduler.test.ts
- src/**tests**/integration/lib/battle-world-constants.test.ts
- src/**tests**/integration/lib/BridgeService.test.ts
- src/**tests**/integration/lib/build-xp-rewards.test.ts
- src/**tests**/integration/lib/client-world-constants.test.ts
- src/**tests**/integration/lib/game-collection-logic.test.ts
- src/**tests**/integration/lib/Game-targeting.test.ts
- src/**tests**/integration/lib/InterceptCalculator.test.ts
- src/**tests**/integration/lib/intercept-calculator-world-integration.test.ts
- src/**tests**/integration/lib/InventoryService.test.ts
- src/**tests**/integration/lib/ironCalculations-multiplier.test.ts
- src/**tests**/integration/lib/ironCalculations-refactored.test.ts
- src/**tests**/integration/lib/ironCalculations.test.ts
- src/**tests**/integration/lib/iron-capacity.test.ts
- src/**tests**/integration/lib/MessageCache-collection-summarization.test.ts
- src/**tests**/integration/lib/MessageCache-persistence-after-summarization.test.ts
- src/**tests**/integration/lib/MessageCache-race-condition.test.ts
- src/**tests**/integration/lib/MessageCache-summarization.test.ts
- src/**tests**/integration/lib/MessageCache-summary-accumulation.test.ts
- src/**tests**/integration/lib/MessageCache.test.ts
- src/**tests**/integration/lib/messagesRepo.test.ts
- src/**tests**/integration/lib/picture-id.test.ts
- src/**tests**/integration/lib/pollingUtils.test.ts
- src/**tests**/integration/lib/position-normalization-client.test.ts
- src/**tests**/integration/lib/position-normalization-worldRepo.test.ts
- src/**tests**/integration/lib/research-xp-rewards.test.ts
- src/**tests**/integration/lib/retryLogic.test.ts
- src/**tests**/integration/lib/server-constants.test.ts
- src/**tests**/integration/lib/TechFactory.test.ts
- src/**tests**/integration/lib/techRepo-notifications.test.ts
- src/**tests**/integration/lib/TechService.test.ts
- src/**tests**/integration/lib/techtree.test.ts
- src/**tests**/integration/lib/timeMultiplier-battles.test.ts
- src/**tests**/integration/lib/timeMultiplier-builds.test.ts
- src/**tests**/integration/lib/timeMultiplier-client.test.ts
- src/**tests**/integration/lib/timeMultiplier.test.ts
- src/**tests**/integration/lib/timeMultiplier-user.test.ts
- src/**tests**/integration/lib/userCache.test.ts
- src/**tests**/integration/lib/user-collection-rewards.test.ts
- src/**tests**/integration/lib/user-domain.test.ts
- src/**tests**/integration/lib/user-level-system.test.ts
- src/**tests**/integration/lib/userrow-interface.test.ts
- src/**tests**/integration/lib/userrow-type.test.ts
- src/**tests**/integration/lib/user-ship-creation.test.ts
- src/**tests**/integration/lib/user-xp-persistence.test.ts
- src/**tests**/integration/lib/user-xp-property.test.ts
- src/**tests**/integration/lib/worldCache.test.ts
- src/**tests**/integration/lib/world-initialization.test.ts
- src/**tests**/integration/lib/World.test.ts
- src/**tests**/integration/lib/xp-migration.test.ts
- src/**tests**/integration/lib/xp-schema-definition.test.ts
- src/**tests**/integration/testServer-minimal.test.ts

## UI Tests (12 files)

jsdom environment. Test React components and hooks.

- src/**tests**/ui/components/admin-multiplier-ui.test.ts
- src/**tests**/ui/components/inventory-grid.test.tsx
- src/**tests**/ui/components/login-business-logic.test.ts
- src/**tests**/ui/components/researchPageClient.test.tsx
- src/**tests**/ui/components/StatusHeader-business-logic.test.ts
- src/**tests**/ui/components/teleport-controls.test.tsx
- src/**tests**/ui/hooks/useBuildQueue.test.ts
- src/**tests**/ui/hooks/useFactoryDataCache.test.ts
- src/**tests**/ui/hooks/useIron.test.ts
- src/**tests**/ui/hooks/useIron-timeMultiplier.test.ts
- src/**tests**/ui/hooks/useIron-xp-display.test.ts
- src/**tests**/ui/hooks/useTechCounts.test.ts
