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
