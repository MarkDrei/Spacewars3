# Agent Learnings

This document captures insights and patterns discovered during agent operations to facilitate knowledge sharing between agents.

## Test Environment

- **Current State**: Database connectivity issues (ENOTFOUND db) causing all tests to fail in CI
- **Impact**: Tests are skipped during setup phase, not actually executing test logic
- **Workaround**: Unit test conversions can proceed independently of database availability
- **Pattern**: When converting integration tests to unit tests, database mocks eliminate external dependencies

## Plan Refinement Patterns

- **No Feedback Scenario**: When a plan arrives with "Open Questions: None" and no human feedback section, the Navigator role focuses on:
  - Documenting pre-existing conditions (like test failures)
  - Validating plan completeness and clarity
  - Ensuring Arc42 updates follow guidelines (avoid over-documentation)
  
## Arc42 Documentation Guidelines Applied

- Small refactoring tasks (like test conversions) typically don't warrant Arc42 updates
- Arc42 should only be updated for architecturally significant changes
- This aligns with the principle of avoiding over-documentation

## Test Conversion Patterns (Task 1.1)

- **Test File Selection Criteria**:
  - Database-dependent tests use `withTransaction()`, `createAuthenticatedSession()`, `initializeIntegrationTestServer()`
  - Good candidates have clear business logic separate from database operations
  - API route tests are ideal: they have well-defined inputs/outputs and mockable dependencies
  
- **Unit Test Mocking Strategy**:
  - Use `vi.mock()` for external modules (iron-session, next/server)
  - Use `Partial<Type>` pattern for stubbing complex objects (UserCache, User)
  - Use `vi.fn()` for method stubs with controlled return values
  - Remove all database setup/teardown helpers from unit tests
  
- **Business Logic Boundaries**:
  - Authentication logic (session validation) can be mocked via `getIronSession()`
  - Cache operations (UserCache methods) can be stubbed
  - Domain objects (User) can be instantiated with test data
  - Lock contexts can be simplified for unit tests

## Unit Test Implementation Patterns (Task 1.2)

- **Import Structure for Pure Unit Tests**:
  - `SaveUserCallback` is exported from `@/lib/server/user/user`, not from userRepository
  - `createInitialTechTree` is in `@/lib/server/techs/techtree`
  - `TechCounts` is in `@/lib/server/techs/TechFactory`
  - User constructor takes `ship_id?: number` (optional, use `undefined` not `null`)
  
- **TechCounts Structure** (as of current implementation):
  ```typescript
  {
    pulse_laser, auto_turret, plasma_lance, gauss_rifle, 
    photon_torpedo, rocket_launcher, ship_hull, kinetic_armor, 
    energy_shield, missile_jammer
  }
  ```
  Note: NOT `iron_harvesting_level` or `iron_capacity_level` - those don't exist in current schema
  
- **Mocking Lock Context**:
  - Use `any` type with eslint-disable for mockLockContext to avoid complex type requirements
  - Mock `createLockContext()` to return a simple object with `useLockWithAcquire` method
  - The mock should call the callback immediately with the same context
  
- **Handling Partial<T> Mock Methods**:
  - When using `Partial<UserCache>`, TypeScript may complain about `vi.mocked()`
  - Use type assertion `(mockObject.method as any).mockResolvedValue()` instead
  - Add eslint-disable comment for @typescript-eslint/no-explicit-any
  
- **Test Coverage for API Routes**:
  - Test all status codes (401, 404, 500, 200)
  - Verify business logic methods are called (updateStats, getIronPerSecond, etc.)
  - Verify cache interactions (getUserByIdWithLock, updateUserInCache)
  - Verify lock context usage
  - Test edge cases (new users, upgraded users, errors)

## Code Review Patterns (Medicus)

- **Analysis Task Review**: For analysis/documentation tasks:
  - Verify analysis document exists and is comprehensive
  - Cross-check analysis claims against actual source code
  - Confirm no TODOs or incomplete sections
  - Verify conversion strategy aligns with existing codebase patterns
  - Check that learnings document was properly updated
  
- **Database Test Issues**: When reviewing in CI environment with database issues:
  - Database connection failures are expected and documented
  - Don't fail review due to pre-existing infrastructure issues
  - Focus on code/documentation quality for the specific task
  - Analysis tasks don't require passing tests
  
- **Unit Test Review** (Task 1.2):
  - Pure unit tests should have zero database dependencies (✅ verified)
  - Mock setup should be clean and reusable (beforeEach pattern)
  - Test coverage should include: auth, happy path, edge cases, errors, lock management
  - Lock context mocking: Use simple mock that calls callback immediately
  - Verify proper use of vi.mock(), vi.fn(), spies for method validation
  - Check test naming follows convention: `whatIsTested_scenario_expectedOutcome`
  - Verify TypeScript syntax validity (use Node.js typescript parser check)
  - Check for code duplication (search for similar mocking patterns)
  - Build/compilation failures due to network (fonts.googleapis.com) are infrastructure issues, not code issues
  - ESLint warnings in other files don't affect current task review
