# PostgreSQL Migration Plan: Merging Master Features

## Overview

This document outlines the plan to merge features from the `master` branch (SQLite-based) into the `feat/container2-7` branch (PostgreSQL-based), now called `copilot/merge-db-migration-to-postgresql`.

**Goal**: Incorporate all master branch features into the PostgreSQL migration while ensuring tests, linting, and builds pass.

## Branch Status

- **Current Branch**: `copilot/merge-db-migration-to-postgresql` (based on `feat/container2-7` @ commit 8257af0)
  - Uses PostgreSQL
  - Has basic infrastructure in place
  
- **Master Branch**: @ commit 36f29d4
  - Uses SQLite
  - Contains ~50 commits of new features since divergence

## Divergence Analysis

The branches diverged around commit 42d5767 ("i"). Master has since gained significant functionality that needs to be adapted for PostgreSQL.

## Features to Migrate (from Master)

### ✅ Already Present on PostgreSQL Branch
Based on the diff analysis, the following are already implemented:
- ✅ Battle system (BattleCache, battleService, battleScheduler, battleEngine, battleRepo, battleTypes)
- ✅ Message system (MessageCache, messagesRepo)
- ✅ Tech system (TechFactory, TechService, techtree)
- ✅ Cache infrastructure (Cache base class, UserCache, WorldCache)
- ✅ Database migrations (migrations.ts with 7 migrations)
- ✅ PostgreSQL schema (schema.ts)
- ✅ Database adapter pattern (databaseAdapter.ts)
- ✅ Lock system (typedLocks.ts with IronGuard)
- ✅ Test infrastructure (vitest, transaction helpers)
- ✅ Docker/containerization (Dockerfile, docker-compose.yml, .devcontainer)
- ✅ Documentation (DOCKER.md, IMPLEMENTATION_SUMMARY.md, etc.)

### 🔍 Needs Verification/Comparison
The following features exist on both branches but need verification that all logic from master is present:

1. **Battle System Enhancements**
   - Damage tracking (attacker_total_damage, attackee_total_damage)
   - End stats persistence (attacker_end_stats, attackee_end_stats)
   - BattleScheduler refactoring for testability (dependency injection)
   - Toroidal distance calculation fixes
   - Battle damage calculation consolidation

2. **Message System Enhancements**
   - Message summarization feature
   - Collection support in messages
   - Timestamp preservation
   - Async message creation with temporary IDs

3. **Tech System Enhancements**
   - Damage modifier methods in techtree
   - DAMAGE_CALC_DEFAULTS constants
   - TechFactory.calculateWeaponDamage usage
   - getDamageModifierFromTree (may have been removed)

4. **Cache System Refinements**
   - BattleCache initialization lifecycle
   - MessageCache flush behavior (not shutdown)
   - Cache persistence mechanisms
   - stopBattleScheduler functionality

5. **API Endpoints**
   - All endpoints should be present, but need to verify they work with PostgreSQL

6. **Tests**
   - All test files are modified (M) in the diff
   - Need to verify all tests pass with PostgreSQL
   - BattleScheduler tests may be in different location

## Migration Strategy

Since most features are already present on the PostgreSQL branch (indicated by 'M' modified or 'A' added in the diff), the strategy is:

### Phase 1: Comparison & Gap Analysis
1. ✅ Identify what features are on master
2. ✅ Identify what's already on PostgreSQL branch
3. ⬜ For each modified file, compare implementations to find missing logic
4. ⬜ Create detailed checklist of specific code segments to port

### Phase 2: Feature-by-Feature Verification
For each feature area, verify the PostgreSQL branch has equivalent functionality:

#### 2.1 Battle System
- ⬜ Compare BattleScheduler between branches
  - Check dependency injection pattern
  - Verify toroidal distance calculation
  - Confirm stopBattleScheduler exists
- ⬜ Compare battleService implementations
  - Verify damage tracking is saved to DB
  - Check end stats persistence
- ⬜ Compare TechFactory usage
  - Verify DAMAGE_CALC_DEFAULTS are used
  - Check calculateWeaponDamage integration
- ⬜ Review battle tests
  - Verify battleScheduler tests exist and pass
  - Check battle damage tracking tests

#### 2.2 Message System
- ⬜ Compare MessageCache implementations
  - Verify summarization support
  - Check collection message handling
  - Confirm timestamp preservation
- ⬜ Review message API endpoints
  - Check /api/messages/summarize exists
- ⬜ Verify message tests pass

#### 2.3 Tech System
- ⬜ Compare techtree implementations
  - Check for damage modifier methods
  - Verify getDamageModifierFromTree status
- ⬜ Compare TechFactory implementations
  - Confirm all calculation methods present
- ⬜ Verify tech tests pass

#### 2.4 Cache System
- ⬜ Compare Cache base class
- ⬜ Compare BattleCache initialization
- ⬜ Compare MessageCache flush behavior
- ⬜ Verify cache tests pass

#### 2.5 Database & Schema
- ⬜ Compare schema.ts files
  - Verify all columns from master are present in PostgreSQL schema
  - Check migration compatibility
- ⬜ Compare migrations.ts files
  - Ensure all 7 migrations are correctly adapted
- ⬜ Verify database tests pass

### Phase 3: Code Porting (If Needed)
For any missing functionality identified in Phase 2:

3.1. ⬜ Port missing code segments (surgical changes only)
3.2. ⬜ Adapt SQLite-specific code to PostgreSQL where needed
3.3. ⬜ Update tests to work with PostgreSQL
3.4. ⬜ Verify each change with targeted tests

### Phase 4: Integration Testing
4.1. ⬜ Run full test suite
4.2. ⬜ Fix any failing tests
4.3. ⬜ Run linting
4.4. ⬜ Run build
4.5. ⬜ Manual verification of key features

### Phase 5: Final Verification
5.1. ⬜ Confirm all master features are working
5.2. ⬜ Confirm all tests pass
5.3. ⬜ Confirm linting passes
5.4. ⬜ Confirm build succeeds
5.5. ⬜ Update documentation

## Detailed Feature Checklist

### Battle System Features
- ⬜ BattleScheduler with injectable dependencies (worldRepo, techService, etc.)
- ⬜ calculateDistance using toroidal distance
- ⬜ stopBattleScheduler in test shutdown
- ⬜ Damage tracking fields in battles table
- ⬜ End stats persistence
- ⬜ DAMAGE_CALC_DEFAULTS constants
- ⬜ TechFactory.calculateWeaponDamage usage throughout
- ⬜ getDamageModifierFromTree (check if removed or kept)
- ⬜ Battle damage tracking tests

### Message System Features
- ⬜ Message summarization API endpoint
- ⬜ Collection message support
- ⬜ Timestamp preservation
- ⬜ Async message creation
- ⬜ Message summarization tests

### Tech System Features
- ⬜ Damage modifier methods in techtree
- ⬜ getDamageModifierFromTree handling
- ⬜ TechService integration

### Cache System Features
- ⬜ BattleCache initialization cleanup
- ⬜ MessageCache flush (not shutdown)
- ⬜ stopBattleScheduler in shutdownIntegrationTestServer

### Database Features
- ⬜ All 7 migrations working with PostgreSQL
- ⬜ attacker_total_damage, attackee_total_damage columns
- ⬜ attacker_end_stats, attackee_end_stats columns
- ⬜ All schema matches master functionality

## Success Criteria

1. ✅ All features from master are present and working on PostgreSQL branch
2. ⬜ All tests pass (npm test)
3. ⬜ Linting passes (npm run lint)
4. ⬜ Build succeeds (npm run build)
5. ⬜ No master commits are missing from current branch
6. ⬜ All database operations work with PostgreSQL
7. ⬜ Manual testing confirms key features work

## Notes

- The PostgreSQL branch appears to already have most features implemented
- The main work will be comparing implementations to ensure no logic was lost
- Most changes will likely be small adjustments rather than large rewrites
- Focus on verification rather than reimplementation
- Use surgical, minimal changes approach

## Timeline

- Phase 1: Comparison & Gap Analysis - **IN PROGRESS**
- Phase 2: Feature-by-Feature Verification - **NEXT**
- Phase 3: Code Porting - As needed
- Phase 4: Integration Testing - After porting
- Phase 5: Final Verification - Final step

---

*Document created: 2026-01-24*
*Last updated: 2026-01-24*
