# Architecture Documentation (arc42)

**Spacewars Ironcore**

Version: 1.0  
Date: October 24, 2025  
Status: Work in Progress

---

## Table of Contents

1. [Introduction and Goals](#1-introduction-and-goals)
2. [Constraints](#2-constraints)
3. [Context and Scope](#3-context-and-scope)
4. [Solution Strategy](#4-solution-strategy)
5. [Building Block View](#5-building-block-view)
6. [Runtime View](#6-runtime-view)
7. [Deployment View](#7-deployment-view)
8. [Crosscutting Concepts](#8-crosscutting-concepts)
9. [Architecture Decisions](#9-architecture-decisions)
10. [Quality Requirements](#10-quality-requirements)
11. [Risks and Technical Debt](#11-risks-and-technical-debt)
12. [Glossary](#12-glossary)

---

## 1. Introduction and Goals

### 1.1 Requirements Overview

Spacewars Ironcore is a 2D space exploration game built with Next.js 15, TypeScript, and React. Players navigate space, collect resources, upgrade their ships through a technology tree, and engage in battles.

**Key Features:**
- Real-time space navigation with HTML5 Canvas rendering
- Resource collection (iron) from asteroids, shipwrecks, and escape pods
- Technology research system with resource costs and build times
- Ship defense systems (hull, armor, shields) with regeneration
- Turn-based battle system between players
- Message notification system for game events

### 1.2 Quality Goals

| Priority | Quality Goal | Scenario |
|----------|-------------|----------|
| 1 | **Correctness** | No race conditions or data corruption in concurrent operations |
| 2 | **Performance** | Sub-100ms response times for game actions; async message creation ~0.5ms |
| 3 | **Maintainability** | Clear separation of concerns; compile-time lock validation |
| 4 | **Scalability** | Efficient caching to minimize database load |

### 1.3 Stakeholders

| Role | Goal | Contact |
|------|------|---------|
| Game Developer | Implement features without deadlocks | Development team |
| Players | Smooth gameplay experience | End users |
| System Administrator | Monitor and maintain deployment | Ops team |

---

## 2. Constraints

### 2.1 Technical Constraints

- **Platform:** Next.js 15 with App Router
- **Language:** TypeScript (strict mode)
- **Database:** SQLite3 (file-based, single writer)
- **Lock System:** IronGuard TypeScript Locks for compile-time deadlock prevention
- **Runtime:** Node.js v22.17.0
- **Deployment:** Vercel-compatible (see `vercel.json`)

### 2.2 Organizational Constraints

- Single-developer project
- Open-source development model
- Git-based version control (GitHub)

---

## 3. Context and Scope

### 3.1 Business Context

```
┌─────────────┐
│   Browser   │
│   (Player)  │
└──────┬──────┘
       │ HTTP/WebSocket
       ▼
┌─────────────────────────────┐
│  Spacewars Ironcore Server  │
│  (Next.js Application)      │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │   SQLite DB  │
    └──────────────┘
```

### 3.2 Technical Context

- **Frontend:** React Server Components + Client Components
- **API:** Next.js API Routes (`/api/*`)
- **Rendering:** HTML5 Canvas for game visualization
- **State Management:** Server-side with cookie-based sessions (iron-session)

---

## 4. Solution Strategy

### 4.1 Core Architectural Decisions

1. **Compile-Time Deadlock Prevention:** Using IronGuard lock system to enforce strict lock ordering at compile time
2. **Two-Layer Caching:** Separate cache managers for different data domains:
   - `TypedCacheManager`: User and world data
   - `MessageCache`: User messages (independent)
3. **Async-First Design:** Message creation is asynchronous with temporary IDs for immediate availability
4. **Session-Based Authentication:** HTTP-only cookies with iron-session for security

### 4.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Next.js 15 | UI framework |
| Backend | Next.js API Routes | RESTful endpoints |
| Database | SQLite3 | Persistent storage |
| Lock System | IronGuard | Deadlock prevention |
| Canvas | HTML5 Canvas API | Game rendering |
| Authentication | iron-session | Secure sessions |

---

## 5. Building Block View

See [Building Blocks - Cache Systems](./building-blocks-cache-systems.md) for detailed documentation of the cache managers.

### 5.1 Level 1: System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Spacewars Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Next.js    │  │  Game Engine │  │  Cache Layer    │   │
│  │  App Router  │  │  (Canvas)    │  │  (IronGuard)    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘   │
│         │                 │                    │             │
│         └─────────────────┴────────────────────┘             │
│                           │                                   │
│                    ┌──────▼──────┐                           │
│                    │   SQLite    │                           │
│                    │   Database  │                           │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Level 2: Cache Layer Architecture

The cache layer consists of two independent cache managers with distinct responsibilities:

#### 5.2.1 TypedCacheManager
**Responsibility:** User data, world state, username mappings

**Key Features:**
- Manages `User` objects with tech counts, iron, ship data
- Manages `World` state with space objects
- Username → UserID mapping cache
- Dirty tracking for background persistence
- Lock hierarchy: CACHE_LOCK → WORLD_LOCK → USER_LOCK → DATABASE_LOCK
- **Explicit initialization** required (loads world data, starts battle scheduler)

#### 5.2.2 MessageCache
**Responsibility:** User messages and notifications

**Key Features:**
- Independent message storage per user
- Async message creation with temporary IDs
- Read status tracking
- Background persistence
- Lock hierarchy: MESSAGE_CACHE_LOCK → MESSAGE_DATA_LOCK → MESSAGE_DB_LOCK
- **Auto-initialization** on first access (lightweight)

**Design Rationale:** 
- Separation ensures message operations don't block game state updates
- Different initialization strategies: TypedCacheManager needs explicit init for heavy world loading; MessageCache auto-initializes for convenience

---

## 6. Runtime View

### 6.1 User Login Flow

```
Player → POST /api/login
         ↓
    Authenticate User
         ↓
    Load from TypedCacheManager
         ↓
    Create Session Cookie
         ↓
    Return User Data
```

### 6.2 Resource Collection Flow

```
Player → POST /api/harvest
         ↓
    Validate Session
         ↓
    TypedCacheManager.loadUserIfNeeded()
         ↓
    Calculate Iron Gain
         ↓
    MessageCache.sendMessageToUser()
    (async, doesn't block)
         ↓
    Return Success
```

---

## 7. Deployment View

```
┌────────────────────────────────────┐
│         Vercel Platform             │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │   Next.js Server (Node.js)   │  │
│  │  - API Routes                │  │
│  │  - SSR/SSG Pages             │  │
│  │  - Game Logic                │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │   SQLite Database            │  │
│  │   (Persistent Volume)        │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

---

## 8. Crosscutting Concepts

### 8.1 Lock Ordering (IronGuard)

**Global Lock Hierarchy:**
```
Level 1: CACHE_LOCK (Management operations)
Level 2: WORLD_LOCK (World state)
Level 3: USER_LOCK (User data)
Level 4: MESSAGE_DATA_LOCK (Message data)
Level 5: DATABASE_LOCK (Database writes)
Level 8: MESSAGE_DB_LOCK (Message DB ops)
```

**Rule:** Locks must be acquired in ascending order. IronGuard enforces this at compile time.

### 8.2 Caching Strategy

- **Write-Through:** Updates go to cache immediately, marked as dirty
- **Write-Behind:** Background persistence flushes dirty data every 30s
- **Cache Invalidation:** Clear cache on schema changes or manual flush
- **TTL:** No time-based expiration (session-based lifecycle)

### 8.3 Error Handling

- Database errors: Logged and propagated to API layer
- Lock acquisition: Guaranteed by IronGuard (no deadlocks)
- Async failures: Message creation errors logged, message removed from cache

---

## 9. Architecture Decisions

### 9.1 ADR-001: Separate Message Cache

**Context:** Initial design had messages in TypedCacheManager, causing lock contention.

**Decision:** Extract MessageCache as independent singleton.

**Consequences:**
- ✅ Message operations don't block user/world updates
- ✅ Simpler lock hierarchy for each domain
- ✅ Async message creation without affecting game performance
- ⚠️ Need to coordinate shutdown/flush between caches

### 9.2 ADR-002: IronGuard Lock System

**Context:** Custom lock system was error-prone and lacked compile-time validation.

**Decision:** Migrate to IronGuard for compile-time deadlock prevention.

**Consequences:**
- ✅ Impossible to create deadlocks (compile-time enforcement)
- ✅ Clear lock hierarchy documented in types
- ✅ Better IDE support with type hints
- ⚠️ Learning curve for ValidLockContext patterns

### 9.3 ADR-003: Async Message Creation

**Context:** Synchronous DB writes caused ~5-10ms delays per message.

**Decision:** Use temporary negative IDs with async persistence.

**Consequences:**
- ✅ ~0.5ms message creation time (10-20x faster)
- ✅ Messages immediately available in cache
- ⚠️ Need to handle ID mapping and race conditions
- ⚠️ Shutdown must wait for pending writes

### 9.4 ADR-004: Transaction-Based Test Isolation

**Context:** Tests were interfering with each other due to shared database state. Manual cleanup in `initializeIntegrationTestServer()` was brittle and masked issues with background persistence escaping transaction boundaries.

**Decision:** 
1. Wrap all integration tests in database transactions using `withTransaction()` helper
2. Automatic ROLLBACK after each test provides perfect isolation
3. Disable background persistence in test mode (synchronous persistence instead)
4. Use AsyncLocalStorage to propagate transaction context throughout test execution

**Implementation:**
- `withTransaction()` helper in `src/__tests__/helpers/transactionHelper.ts`
- AsyncLocalStorage for transaction context propagation
- `getDatabasePool()` export for direct pool access in tests
- Cache modifications detect test mode and persist immediately instead of using timers
- Timer-based background persistence disabled when `NODE_ENV === 'test'`

**Consequences:**
- ✅ Perfect test isolation - no data pollution between tests
- ✅ No manual cleanup needed - automatic ROLLBACK handles everything
- ✅ Enables parallel test execution (future improvement)
- ✅ Tests are deterministic and reproducible
- ✅ Catches bugs where background persistence escapes transaction scope
- ⚠️ Test mode has slightly different code path (synchronous vs async persistence)
- ⚠️ Tests must use `withTransaction()` wrapper for proper isolation
- ⚠️ Seeded test data must be visible within transaction (handled by database initialization)

**Performance:**
- Test suite: ~45s (sequential execution with 402 tests)
- Expected ~33% improvement with parallel execution enabled

---

## 10. Quality Requirements

### 10.1 Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Message creation | < 1ms | ~0.5ms |
| User data load | < 50ms | ~10-20ms (cache hit: ~1ms) |
| Game action (harvest) | < 100ms | ~30-50ms |

### 10.2 Reliability

- Zero deadlocks (guaranteed by IronGuard)
- Graceful degradation on DB errors
- Data consistency through dirty tracking

---

## 11. Risks and Technical Debt

See [TechnicalDebt.md](../../TechnicalDebt.md) for current issues.

**Key Risks:**
1. **SQLite Concurrency:** Single writer limitation may cause bottlenecks at scale
2. **Cache Invalidation:** No distributed cache invalidation strategy
3. **Session Storage:** In-memory sessions don't survive restarts

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **IronGuard** | TypeScript lock library with compile-time deadlock prevention |
| **ValidLockContext** | Type constraint ensuring correct lock acquisition order |
| **Dirty Tracking** | Marking cached data as modified for background persistence |
| **Temporary ID** | Negative ID assigned to messages before DB insertion |
| **Lock Hierarchy** | Ordered sequence of locks that must be acquired in ascending order |
