# Test Performance Analysis

## Executive Summary

**Total Test Suite Duration:** 6,154 ms (6.15 seconds)  
**Total Tests:** 319 tests across 38 files  
**Average per file:** 161.95 ms  
**Median per file:** 17.50 ms  
**Standard Deviation:** 548.71 ms (high variance indicates performance bottlenecks)

## Overall Statistics

| Metric | Value |
|--------|-------|
| Total test files | 38 |
| Total tests | 319 |
| Total duration | 6,154 ms (6.15 seconds) |
| Average per file | 161.95 ms |
| Median per file | 17.50 ms |
| Average per test | 30.22 ms |

## Top 10 Slowest Test Files

| Duration | Tests | Avg/Test | File |
|----------|-------|----------|------|
| **3,354 ms** | 8 | **419.2 ms** | `src/__tests__/hooks/useIron.test.ts` ⚠️ |
| 497 ms | 4 | 124.2 ms | `src/__tests__/api/admin-api.test.ts` |
| 483 ms | 4 | 120.8 ms | `src/__tests__/api/auth-api.test.ts` |
| 412 ms | 4 | 103.0 ms | `src/__tests__/api/user-stats-api.test.ts` |
| 313 ms | 3 | 104.3 ms | `src/__tests__/api/collection-api.test.ts` |
| 280 ms | 3 | 93.3 ms | `src/__tests__/api/trigger-research-api.test.ts` |
| 174 ms | 3 | 58.0 ms | `src/__tests__/hooks/useFactoryDataCache.test.ts` |
| 114 ms | 6 | 19.0 ms | `src/__tests__/api/typedEndpoints.test.ts` |
| 73 ms | 15 | 4.9 ms | `src/__tests__/lib/messagesRepo.test.ts` |
| 67 ms | 9 | 7.4 ms | `src/__tests__/lib/typedLocks.test.ts` |

**Note:** The top 7 slowest files account for **5,133 ms (83.4%)** of total test time!

## Top 10 Fastest Test Files

| Duration | Tests | Avg/Test | File |
|----------|-------|----------|------|
| 3 ms | 4 | 0.8 ms | `src/__tests__/lib/enhanced-type-system.test.ts` ✅ |
| 4 ms | 14 | 0.3 ms | `src/__tests__/lib/game-collection-logic.test.ts` ✅ |
| 5 ms | 5 | 1.0 ms | `src/__tests__/lib/ironCalculations.test.ts` ✅ |
| 5 ms | 7 | 0.7 ms | `src/__tests__/services/factoryService.test.ts` ✅ |
| 5 ms | 5 | 1.0 ms | `src/__tests__/lib/World.test.ts` ✅ |
| 6 ms | 5 | 1.2 ms | `src/__tests__/components/login-business-logic.test.ts` ✅ |
| 7 ms | 21 | 0.3 ms | `src/__tests__/lib/user-domain.test.ts` ✅ |
| 7 ms | 10 | 0.7 ms | `src/__tests__/renderers/TargetingLineRenderer.test.ts` ✅ |
| 7 ms | 26 | 0.3 ms | `src/shared/tests/physics.test.ts` ✅ |
| 8 ms | 7 | 1.1 ms | `src/__tests__/lib/user-collection-rewards.test.ts` ✅ |

## Duration Distribution

```
   0-10  ms: 14 files ██████████████
  10-50  ms: 14 files ██████████████
  50-100 ms:  2 files ██
 100-200 ms:  2 files ██
 200-500 ms:  5 files █████
 500-5000ms:  1 files █             ⚠️ OUTLIER
```

## Category Breakdown

| Category | Files | Tests | Total Duration | Avg per File |
|----------|-------|-------|----------------|--------------|
| **Hook Tests** | 4 | 24 | **3,581 ms** | **895.2 ms** ⚠️ |
| **API Tests** | 11 | 35 | **2,182 ms** | **198.4 ms** ⚠️ |
| Library Tests | 15 | 187 | 303 ms | 20.2 ms |
| Service Tests | 3 | 23 | 33 ms | 11.0 ms |
| Component Tests | 2 | 12 | 24 ms | 12.0 ms |
| Cache Tests | 1 | 2 | 17 ms | 17.0 ms |
| Renderer Tests | 1 | 10 | 7 ms | 7.0 ms |
| Other Tests | 1 | 26 | 7 ms | 7.0 ms |

**Key Finding:** Hook tests and API tests together account for **93.6%** of total test time!

## Tests Taking >100ms Per Test

| Avg Time/Test | File | Test Count |
|---------------|------|------------|
| **419.2 ms** | `src/__tests__/hooks/useIron.test.ts` | 8 |
| 124.2 ms | `src/__tests__/api/admin-api.test.ts` | 4 |
| 120.8 ms | `src/__tests__/api/auth-api.test.ts` | 4 |
| 104.3 ms | `src/__tests__/api/collection-api.test.ts` | 3 |
| 103.0 ms | `src/__tests__/api/user-stats-api.test.ts` | 4 |

---

## Detailed Analysis of Critical Bottlenecks

### 1. 🔴 CRITICAL: useIron.test.ts (3,354 ms - 54.5% of total time!)

**Individual test breakdown:**
- `useIron_initiatesFetchAndReturnsData`: 68ms ✅
- `useIron_apiError_setsErrorState`: 54ms ✅
- `useIron_withIronProduction_calculatesDisplayIron`: 54ms ✅
- **`useIron_networkErrorRetry_eventuallySucceeds`: 2,009ms** ⚠️⚠️⚠️
- `useIron_zeroIronPerSecond_displaysServerValue`: 53ms ✅
- `useIron_refetchFunction_triggersNewFetch`: 54ms ✅
- `useIron_withIronProduction_smoothUpdatesWorkWithTime`: 55ms ✅
- **`useIron_multipleFetchesWithDifferentTimes_maintainsSmoothUpdates`: 1,008ms** ⚠️⚠️

#### Root Cause Analysis:

1. **Real Timer Delays (2,017ms = 32.8% of total test suite time)**
   - Tests wait for actual polling intervals using real timers
   - `networkErrorRetry` test has 10-second timeout waiting for retry logic
   - `multipleFetchesWithDifferentTimes` uses 1000ms poll interval + 2s timeout
   - No use of `vi.useFakeTimers()` or `vi.advanceTimersByTime()`

2. **Code Evidence:**
   ```typescript
   // Line 95: 10-second timeout waiting for real retry
   await waitFor(() => {
     expect(result.current.isLoading).toBe(false);
   }, { timeout: 10000 });
   
   // Line 205: Waiting for real 1-second polling interval
   const { result } = renderHook(() => useIron(1000)); // 1 second poll interval
   await waitFor(() => {
     expect(mockUserStatsService.getUserStats).toHaveBeenCalledTimes(2);
   }, { timeout: 2000 });
   ```

#### Recommended Fix:
```typescript
// Use fake timers
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Then in tests:
vi.advanceTimersByTime(1000); // Advance by 1 second instantly
```

**Expected improvement:** Reduce from 3,354ms to ~300ms (**saving ~3 seconds!**)

---

### 2. 🟠 HIGH: API Tests with Authentication (2,182ms total)

All API tests that require authentication share the same bottleneck:

#### Root Cause Analysis:

1. **Bcrypt Password Hashing (~100-150ms per hash)**
   - Bcrypt is intentionally CPU-intensive for security
   - Each user registration/login hashes the password
   - Example: `admin-api.test.ts` creates 3 users = ~300-450ms just for bcrypt

2. **Typed Cache Manager Initialization**
   - Full initialization happens in each test file
   - Loads world data from database
   - Logs show: "Typed cache manager initialized" per test

3. **Database Operations**
   - User creation with ship creation
   - Session management
   - Multiple DB writes per authentication flow

#### Code Evidence:
```typescript
// From console output:
✅ Created user normaluser_1761341650562_4dc6pchy1 (ID: 2) with ship ID 11
🧠 Typed cache manager initialized
🚀 Initializing typed cache manager...
✅ Database connected
🌍 Loading world data from database...
🌍 World data cached in memory
✅ World data loaded
```

#### Recommended Fixes:

**Option A: Mock bcrypt (fastest, easiest)**
```typescript
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('mocked_hash'),
  compare: vi.fn().mockResolvedValue(true)
}));
```
**Expected improvement:** 50-70% reduction in API test time

**Option B: Reduce bcrypt rounds in tests**
```typescript
// In test environment, use fewer rounds
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 1 : 10;
```
**Expected improvement:** 30-50% reduction in API test time

**Option C: Share authenticated sessions**
```typescript
let sharedSessionCookie: string;

beforeAll(async () => {
  sharedSessionCookie = await createAuthenticatedSession();
});
```
**Expected improvement:** 20-30% reduction in API test time

---

## Summary of Root Causes

### Primary Bottlenecks (5,563ms = 90.4% of total time):

1. **Real Timer Delays** (2,017ms = 32.8%)
   - Waiting for actual setTimeout/setInterval
   - Not using `vi.useFakeTimers()`

2. **Bcrypt Password Hashing** (~1,500ms estimated = 24.4%)
   - CPU-intensive by design
   - Not necessary to test actual bcrypt in unit tests

3. **Database Initialization** (~1,000ms estimated = 16.2%)
   - Typed cache manager initialization
   - World data loading
   - Multiple DB connections

4. **Session Management** (~1,046ms = 17.0%)
   - Cookie encryption/decryption
   - User registration flows

---

## Optimization Roadmap

### Priority 1: Quick Wins (Expected: 3-4 second improvement)

1. **Mock timers in useIron tests**
   - Impact: Save ~2 seconds
   - Effort: Low (1-2 hours)
   - Files: `src/__tests__/hooks/useIron.test.ts`

2. **Mock bcrypt in all API tests**
   - Impact: Save ~1.5 seconds
   - Effort: Low (30 minutes)
   - Files: All API test files

### Priority 2: Medium Wins (Expected: 0.5-1 second improvement)

3. **Share database connections across tests**
   - Impact: Save ~500ms
   - Effort: Medium (2-4 hours)
   - Files: Test setup files

4. **Mock typed cache manager initialization**
   - Impact: Save ~300ms
   - Effort: Medium (1-2 hours)
   - Files: API test helpers

5. **Use beforeAll for common setup**
   - Impact: Save ~200ms
   - Effort: Low (1 hour)
   - Files: API test files

### Priority 3: Polish (Expected: 0.1-0.3 second improvement)

6. **Optimize session cookie handling**
   - Impact: Save ~100ms
   - Effort: Low (30 minutes)

7. **Use in-memory SQLite with shared cache**
   - Impact: Save ~100ms
   - Effort: Low (1 hour)

---

## Expected Results After Optimization

| Metric | Current | After P1 | After P2 | After P3 |
|--------|---------|----------|----------|----------|
| Total duration | 6,154 ms | ~2,500 ms | ~1,800 ms | ~1,500 ms |
| useIron tests | 3,354 ms | ~300 ms | ~300 ms | ~300 ms |
| API tests avg | 198 ms | ~70 ms | ~50 ms | ~40 ms |
| **Total improvement** | - | **60%** | **71%** | **76%** |

---

## Conclusion

The test suite has significant performance bottlenecks concentrated in two areas:

1. **One test file (`useIron.test.ts`) accounts for 54.5% of all test time** due to waiting for real timers
2. **API tests account for 35.5% of test time** due to bcrypt hashing and database initialization

By implementing Priority 1 optimizations (mocking timers and bcrypt), we can reduce total test time from **6.15 seconds to ~2.5 seconds** - a **60% improvement** with minimal effort.

These optimizations will make the test suite much faster for development iterations while maintaining test quality and coverage.
