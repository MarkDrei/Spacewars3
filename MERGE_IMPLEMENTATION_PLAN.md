# Master → PostgreSQL Merge - Detailed Implementation Plan

## Overview
This document provides the step-by-step implementation plan for merging 373 commits from the master branch (SQLite) into the PostgreSQL migration branch.

## Guiding Principles
1. **Feature-by-feature approach** - Not one big merge
2. **Test after each major change** - Catch issues early
3. **Preserve PostgreSQL** - Never regress to SQLite
4. **Minimize changes** - Only adapt what's necessary
5. **Document conflicts** - Track difficult decisions

---

## Phase 1: Preparation & Git Merge (Day 1, Morning)

### 1.1 Create Safety Branch
```bash
git branch backup-pre-merge
git branch -a  # Verify branches exist
```

### 1.2 Perform Git Merge
```bash
# This will bring in all 373 commits
git merge master --no-commit

# Expect conflicts in:
# - src/lib/server/database.ts
# - src/lib/server/schema.ts
# - src/lib/server/*/repo.ts files
# - package.json
# - vitest.config.ts
```

### 1.3 Initial Conflict Resolution Strategy
For each conflict, choose:
- **Database files**: Keep PostgreSQL version (current branch)
- **Package.json**: Merge dependencies, keep PostgreSQL-related config
- **Test config**: Keep PostgreSQL test database setup
- **Schema files**: Keep PostgreSQL syntax
- **Business logic**: Usually merge from master

### 1.4 Expected Major Conflicts
1. **database.ts**: SQLite connection vs PostgreSQL connection
2. **schema.ts**: AUTOINCREMENT vs SERIAL, REAL vs DOUBLE PRECISION
3. **databaseAdapter.ts**: May not exist in master
4. ***/repo.ts**: Raw SQL queries with SQLite syntax
5. **vitest.config.ts**: Test database setup

### 1.5 Checkpoint
- [ ] All conflicts resolved (keep detailed notes)
- [ ] PostgreSQL connection preserved
- [ ] Schema uses SERIAL and DOUBLE PRECISION
- [ ] Test setup uses PostgreSQL test DB
- [ ] Git status shows clean merge state

---

## Phase 2: Database Layer Adaptation (Day 1, Afternoon)

### 2.1 Audit All SQL Queries
```bash
# Find all potential SQLite-specific SQL
grep -r "AUTOINCREMENT" src/
grep -r "REAL " src/
grep -r "INTEGER PRIMARY KEY" src/
grep -r "PRAGMA" src/
grep -r "\.db" src/
```

### 2.2 Fix Schema Definitions
File: `src/lib/server/schema.ts`
- [ ] Verify all tables use `SERIAL PRIMARY KEY`
- [ ] Verify all floats use `DOUBLE PRECISION`
- [ ] Verify timestamps use appropriate precision
- [ ] Verify foreign keys are correct
- [ ] Check migration scripts for PostgreSQL syntax

### 2.3 Fix Repository Files
For each `*Repo.ts` file:
- [ ] **userRepo.ts**: Convert SQLite queries to PostgreSQL
- [ ] **worldRepo.ts**: Convert SQLite queries to PostgreSQL
- [ ] **battleRepo.ts**: Convert SQLite queries to PostgreSQL
- [ ] **messagesRepo.ts**: Convert SQLite queries to PostgreSQL

Key conversions:
```typescript
// SQLite → PostgreSQL
"INSERT ... RETURNING *" // ✅ Same
"REAL" → "DOUBLE PRECISION"
"INTEGER PRIMARY KEY AUTOINCREMENT" → "SERIAL PRIMARY KEY"
"?" placeholders → "$1, $2, $3" (if using pg library directly)
```

### 2.4 Database Adapter Verification
File: `src/lib/server/databaseAdapter.ts`
- [ ] Ensure it properly abstracts PostgreSQL
- [ ] Check connection pooling
- [ ] Verify transaction support
- [ ] Test error handling

### 2.5 Database Initialization
Files: `src/lib/server/database.ts`, `src/lib/server/migrations.ts`
- [ ] PostgreSQL connection string correct
- [ ] Environment variables for POSTGRES_* set
- [ ] Test database (spacewars_test) configured
- [ ] Migration scripts run in correct order
- [ ] Seed data works with PostgreSQL

### 2.6 Checkpoint
- [ ] No SQLite syntax in any SQL queries
- [ ] All repository files use PostgreSQL patterns
- [ ] Database connection works
- [ ] Tables can be created
- [ ] Test database can be reset

---

## Phase 3: Cache System Integration (Day 1, Evening)

### 3.1 Review IronGuard Integration
Files from master to integrate:
- Cache base class
- UserCache (formerly UserWorldCache)
- WorldCache
- MessageCache
- BattleCache

### 3.2 Verify Cache Implementations
For each cache:
- [ ] **UserCache**: 
  - Check persistence queries use PostgreSQL
  - Verify lock contexts
  - Test background persistence
  
- [ ] **WorldCache**:
  - Check space_objects queries
  - Verify position updates
  - Test collision detection
  
- [ ] **MessageCache**:
  - Check messages table queries
  - Verify timestamp handling (BIGINT milliseconds)
  - Test message creation/retrieval
  
- [ ] **BattleCache**:
  - Check battles table queries
  - Verify JSON field handling
  - Test battle state persistence

### 3.3 Lock Context Verification
- [ ] All cache operations use proper lock contexts
- [ ] DATABASE_LOCK_* constants defined
- [ ] IronGuard library version compatible (0.2.3)
- [ ] No deadlock potential

### 3.4 Background Persistence
File: `src/lib/server/caches/Cache.ts`
- [ ] Verify persistence interval
- [ ] Check flush on shutdown
- [ ] Test transaction handling with PostgreSQL
- [ ] Ensure test mode disables background persistence

### 3.5 Checkpoint
- [ ] All cache files compile
- [ ] Cache base class works with PostgreSQL
- [ ] Background persistence tested
- [ ] Lock contexts validated
- [ ] Cache tests can run

---

## Phase 4: Battle System Integration (Day 2, Morning)

### 4.1 Battle Database Schema
Verify in `schema.ts`:
- [ ] battles table exists with all columns
- [ ] Foreign keys to users table
- [ ] JSON fields for stats, cooldowns, logs
- [ ] Damage tracking columns
- [ ] Timestamp fields (BIGINT for milliseconds)

### 4.2 Battle Core Files
Merge and adapt:
- [ ] **battleEngine.ts**: Damage calculations (pure logic, should work)
- [ ] **battleScheduler.ts**: Automatic processing (check timers)
- [ ] **BattleCache.ts**: State management (verify PostgreSQL queries)
- [ ] **battleRepo.ts**: Database operations (convert SQLite → PostgreSQL)
- [ ] **battleService.ts**: Business logic (should work)

### 4.3 Battle API Routes
Files: `src/app/api/attack/`, `src/app/api/user-battles/`
- [ ] Attack endpoint creates battles correctly
- [ ] Battle status retrieval works
- [ ] Defense values persist correctly
- [ ] Weapon cooldowns save/load properly

### 4.4 Defense System
- [ ] Hull/armor/shield persistence in users table
- [ ] Defense regeneration calculations
- [ ] Defense value clamping (0 to max)
- [ ] Defense last regen timestamp

### 4.5 Battle Processing
- [ ] BattleScheduler starts correctly
- [ ] Battles process automatically
- [ ] Battle end conditions trigger
- [ ] Winner/loser determined correctly
- [ ] Battle stats persisted

### 4.6 Checkpoint
- [ ] Battle system compiles
- [ ] Battles can be created
- [ ] Battles can be processed
- [ ] Battle results persist
- [ ] Battle tests can run

---

## Phase 5: Message System Integration (Day 2, Afternoon)

### 5.1 Message Database Schema
Verify in `schema.ts`:
- [ ] messages table exists
- [ ] recipient_id foreign key
- [ ] created_at as BIGINT (milliseconds)
- [ ] is_read boolean
- [ ] message TEXT field

### 5.2 MessageCache Implementation
File: `src/lib/server/messages/MessageCache.ts`
- [ ] Message creation with PostgreSQL timestamps
- [ ] Message retrieval queries
- [ ] Unread message filtering
- [ ] Message summarization
- [ ] Mark as read functionality

### 5.3 Message Prefixes
- [ ] COLLECTION prefix parsing
- [ ] BATTLE prefix parsing
- [ ] Frontend parsing/formatting
- [ ] Color coding in UI

### 5.4 Message API Routes
File: `src/app/api/messages/`
- [ ] GET messages endpoint
- [ ] POST mark as read endpoint
- [ ] Message summarization endpoint
- [ ] Timestamp conversion (ms ↔ seconds)

### 5.5 Checkpoint
- [ ] Messages can be created
- [ ] Messages can be retrieved
- [ ] Summarization works
- [ ] Prefixes parse correctly
- [ ] Message tests pass

---

## Phase 6: Frontend Integration (Day 2, Evening)

### 6.1 Game Rendering
Merge rendering system from master:
- [ ] Canvas setup
- [ ] Ship renderer
- [ ] Asteroid renderer
- [ ] Collectibles renderer
- [ ] Radar renderer
- [ ] Tooltip system

### 6.2 UI Components
- [ ] StatusHeader (iron display)
- [ ] Navigation component
- [ ] Login/Register pages
- [ ] Profile page
- [ ] About page
- [ ] Research page
- [ ] Admin page
- [ ] Home page (notifications)

### 6.3 Hooks and Services
- [ ] useAuth hook
- [ ] useTechCounts hook
- [ ] useBuildQueue hook
- [ ] API service functions
- [ ] Polling mechanisms

### 6.4 Styling
- [ ] Tailwind CSS configuration
- [ ] Component styling
- [ ] Responsive design
- [ ] Tooltip styling

### 6.5 Checkpoint
- [ ] All pages render
- [ ] Navigation works
- [ ] Data fetching works
- [ ] UI updates correctly
- [ ] No console errors

---

## Phase 7: Testing & Quality (Day 3)

### 7.1 Unit Tests
Run and fix by category:
```bash
# API tests
npm test -- src/__tests__/api

# Component tests  
npm test -- src/__tests__/components

# Cache tests
npm test -- src/__tests__/cache

# Balance tests
npm test -- src/__tests__/balance
```

For each failing test:
1. Identify if it's database-related
2. Check for SQLite assumptions
3. Adapt to PostgreSQL behavior
4. Verify fix doesn't break other tests

### 7.2 Integration Tests
Files: `src/__tests__/api/complete-build-*.test.ts`
- [ ] Complete workflow tests pass
- [ ] Multi-user tests work
- [ ] Battle integration tests pass
- [ ] Message integration tests pass

### 7.3 Test Database
- [ ] Test DB resets properly
- [ ] Seed data correct
- [ ] Test users created
- [ ] Test space objects created
- [ ] Transaction isolation works

### 7.4 Linting
```bash
npm run lint
```
Fix issues:
- [ ] ESLint errors
- [ ] TypeScript errors
- [ ] Import issues
- [ ] Unused variables
- [ ] Type mismatches

### 7.5 Build
```bash
npm run build
```
Fix issues:
- [ ] TypeScript compilation
- [ ] Next.js build
- [ ] Asset bundling
- [ ] Production optimizations

### 7.6 Checkpoint
- [ ] All tests pass
- [ ] Linting passes
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] No console warnings

---

## Phase 8: Manual Testing (Day 3, Afternoon)

### 8.1 Start Services
```bash
# Start PostgreSQL
docker-compose up db -d

# Start Next.js dev server
npm run dev
```

### 8.2 Authentication Flow
- [ ] Register new user
- [ ] Login with user
- [ ] Session persists
- [ ] Logout works
- [ ] Session clears

### 8.3 Game Features
- [ ] World renders correctly
- [ ] Ship moves
- [ ] Can collect asteroids/shipwrecks/pods
- [ ] Iron increases
- [ ] Position persists

### 8.4 Research System
- [ ] Research page loads
- [ ] Tech tree displays
- [ ] Can trigger research
- [ ] Build queue updates
- [ ] Iron decreases
- [ ] Research completes
- [ ] Tech counts increase

### 8.5 Battle System
- [ ] Can attack other users
- [ ] Battle creates in database
- [ ] Battle processes automatically
- [ ] Messages sent
- [ ] Defense values update
- [ ] Battle history shows in profile

### 8.6 Admin Features
- [ ] Admin page loads
- [ ] Users table displays
- [ ] Space objects table displays
- [ ] Messages table displays
- [ ] Battles table displays
- [ ] Tech tree report works

### 8.7 Checkpoint
- [ ] All features work manually
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Database data correct
- [ ] UI responsive

---

## Phase 9: Final Validation & Cleanup

### 9.1 Commit History Verification
```bash
# Verify all master commits present
git log --oneline --graph --all

# Check commit count
git rev-list --count HEAD
# Should be ~373+ (master) + 2 (current) + merge commits
```

### 9.2 Feature Completeness
- [ ] All Phase 1 features work (rendering)
- [ ] All Phase 2 features work (auth)
- [ ] All Phase 3 features work (Next.js)
- [ ] All Phase 4 features work (caching)
- [ ] All Phase 5 features work (battles)
- [ ] All Phase 6 features work (messages)
- [ ] All Phase 7 features work (damage/tech)

### 9.3 PostgreSQL Verification
```bash
# Ensure no SQLite references
grep -r "sqlite" src/ | grep -v "test" | wc -l  # Should be 0
grep -r "\.db" src/ | grep -v "test" | wc -l    # Should be 0
grep -r "AUTOINCREMENT" src/ | wc -l            # Should be 0
```

### 9.4 Cleanup
- [ ] Remove backup branches if all works
- [ ] Remove any temporary files
- [ ] Remove debug logging
- [ ] Update documentation
- [ ] Update IMPLEMENTATION_SUMMARY.md

### 9.5 Final Test Run
```bash
# Full CI pipeline
npm run ci

# Should output:
# ✓ Linting passed
# ✓ Tests passed
# ✓ Build succeeded
```

---

## Tracking Progress

Use checkboxes above to track completion. Update MERGE_ANALYSIS.md Step sections as you complete phases.

## Rollback Procedure

If a phase fails critically:
1. Document the failure in detail
2. Commit partial progress to a WIP branch
3. Reset to last good checkpoint: `git reset --hard backup-pre-merge`
4. Analyze what went wrong
5. Consider smaller merge batches
6. Try again with lessons learned

## Success Criteria (Final Check)

### Git History ✅
- [ ] All 373 master commits present in `git log`
- [ ] All feat/container2-7 commits present
- [ ] Merge commits documented

### Code Quality ✅
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0 (all tests pass)
- [ ] No TypeScript errors

### Database ✅
- [ ] PostgreSQL is the only database
- [ ] All tables created correctly
- [ ] All migrations run successfully
- [ ] Seed data works

### Features ✅
- [ ] Authentication works
- [ ] Game rendering works
- [ ] Collection mechanics work
- [ ] Research system works
- [ ] Battle system works
- [ ] Message system works
- [ ] Admin page works

### Documentation ✅
- [ ] MERGE_ANALYSIS.md complete
- [ ] IMPLEMENTATION_SUMMARY.md updated
- [ ] README.md accurate
- [ ] Code comments helpful

---

**Plan Version**: 1.0  
**Created**: 2026-01-25  
**Estimated Duration**: 2-3 days  
**Status**: Ready to Execute
