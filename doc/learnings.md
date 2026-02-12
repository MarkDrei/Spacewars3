# Project Learnings

## Database Setup for Tests

### Issue Discovered (2026-02-10)

Tests require PostgreSQL databases to be running and the `POSTGRES_TEST_PORT` environment variable to be set to `5433`.

### Solution

1. Start both databases: `docker compose up db db-test -d`
2. Export the test port: `export POSTGRES_TEST_PORT=5433`
3. Run tests: `npm run test:ci`

## XP Level System Progression Formula

**Discovered by**: Knight  
**Context**: When implementing the level system (Tasks 2.2-2.4), discovered the correct interpretation of the progression pattern  
**Details**: 

The level system uses triangular number progression for XP requirements:
- Each level N requires triangular number (N-1) * 1000 XP to reach from the previous level
- Triangular number k = k*(k+1)/2
- Total XP for level N = sum of triangular numbers from 1 to N-1

Example progression:
- Level 1: 0 XP
- Level 2: 1,000 XP (triangular 1 = 1*2/2 = 1)
- Level 3: 4,000 XP (1000 + triangular 2 * 1000 = 1000 + 3000)
- Level 4: 10,000 XP (4000 + triangular 3 * 1000 = 4000 + 6000)
- Level 10: 165,000 XP (sum of triangular 1-9)

This creates an exponential curve that makes higher levels significantly harder to achieve while keeping early progression accessible.

**Implementation tip**: Use iterative calculation in getLevel() for O(√n) complexity, and direct formula in getXpForNextLevel() for O(n) calculation of the sum.
