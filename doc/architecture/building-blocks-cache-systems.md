# Building Blocks - Cache Systems

**Part of:** Spacewars Ironcore Architecture Documentation  
**Version:** 1.0  
**Date:** October 24, 2025

---

## Overview

The Spacewars application uses two independent cache manager implementations to optimize database access and ensure data consistency. This document analyzes their architecture, similarities, and differences.

---

## Cache Manager Comparison Matrix

| Aspect | TypedCacheManager | MessageCache |
|--------|-------------------|--------------|
| **Primary Purpose** | User data, world state, username mappings | User messages and notifications |
| **Data Scope** | Multi-entity (User, World) | Single-entity (Messages) |
| **Lock System** | **Pure IronGuard** ✅ | Pure IronGuard |
| **Lock Hierarchy** | 4 levels (CACHE→WORLD→USER→DB) | 2 levels (CACHE→DATA) |
| **Async Operations** | Background persistence only | Async creation + background persistence |
| **Temporary IDs** | No | Yes (negative IDs) |
| **Cache Structure** | Map<userId, User> + World singleton | Map<userId, Message[]> |
| **Singleton Pattern** | ✅ Yes | ✅ Yes |
| **Initialization** | Internal auto-init in methods (guarded, idempotent) | Internal auto-init in methods (guarded) |
| **Init Cost** | First call: ~100-200ms, subsequent: <1ms | First call: ~10-20ms, subsequent: <1ms |
| **Statistics Tracking** | Cache hits/misses per entity type | Cache hits/misses + pending writes |
| **Background Timer** | 30s persistence interval | 30s persistence interval |

---

## Detailed Analysis

### 1. TypedCacheManager

**Location:** `src/lib/server/typedCacheManager.ts`

#### 1.1 Architecture

```
TypedCacheManager (Singleton)
├── Configuration
│   ├── persistenceIntervalMs: 30000
│   ├── enableAutoPersistence: true
│   └── logStats: false
├── Storage
│   ├── users: Map<number, User>
│   ├── world: World | null
│   ├── usernameToUserId: Map<string, number>
│   ├── dirtyUsers: Set<number>
│   └── worldDirty: boolean
├── Locks (Pure IronGuard)
│   ├── CACHE_LOCK (level 1)
│   ├── WORLD_LOCK (level 2)
│   ├── USER_LOCK (level 3)
│   └── DATABASE_LOCK (level 5)
└── Operations
    ├── Level 1: World operations (read/write)
    ├── Level 2: User operations (CRUD)
    ├── Level 3: Database operations (load/persist)
    └── Background: Persistence + Battle scheduler
```

#### 1.2 Lock Hierarchy

```
CACHE_LOCK (1)
    ↓
WORLD_LOCK (2)
    ↓
USER_LOCK (3)
    ↓
DATABASE_LOCK (5)
```

#### 1.3 Key Features

**Pure IronGuard Lock System:**
- All operations use modern `acquireWorldRead()`, `acquireUserLock()`, `acquireDatabaseRead()` pattern
- Direct lock context acquisition with explicit `dispose()` in try-finally blocks
- No legacy wrapper methods - clean, explicit lock management
- Compile-time deadlock prevention through type system

**Multi-Entity Caching:**
- Caches heterogeneous data: User objects, World state, username mappings
- Separate dirty tracking per entity type

**Internal Auto-Initialization:**
- Public methods (`loadUserIfNeeded`, `getUserByUsername`, `getStats`, `flushAllToDatabase`) auto-initialize on first access
- Initialization loads world data from database (~100-200ms first call)
- Subsequent calls are instant (<1ms) due to guarded initialization pattern
- Starts background persistence and battle scheduler on first access

**Example Usage:**
```typescript
// High-level API - no explicit initialize() needed
const cacheManager = getTypedCacheManager();
const user = await cacheManager.loadUserIfNeeded(userId); // Auto-initializes if needed

// Direct lock acquisition pattern (Pure IronGuard)
const ctx = createLockContext();
const worldCtx = await cacheManager.acquireWorldWrite(ctx);
try {
  const userCtx = await cacheManager.acquireUserLock(worldCtx);
  try {
    const user = cacheManager.getUserUnsafe(userId, userCtx);
    manager.updateUserUnsafe(user, userCtx);
    // ... work with user and world
  } finally {
    userCtx.dispose();
  }
} finally {
  worldCtx.dispose();
}
```

#### 1.4 Persistence Strategy

**Write-Behind Caching:**
1. Updates immediately modify in-memory cache
2. Entity marked as "dirty" (added to `dirtyUsers` or `worldDirty = true`)
3. Background timer (30s) flushes dirty data to database
4. Shutdown performs final flush

**Database Operations:**
```typescript
async persistUserToDb(user: User): Promise<void>
  → UPDATE users SET iron=?, tech_tree=?, ... WHERE id=?

async persistDirtyWorld(): Promise<void>
  → Calls saveWorldToDb(world)
```

---

### 2. MessageCache

**Location:** `src/lib/server/MessageCache.ts`

#### 2.1 Architecture

```
MessageCache (Singleton)
├── Configuration
│   ├── persistenceIntervalMs: 30000
│   └── enableAutoPersistence: true
├── Storage
│   ├── userMessages: Map<number, Message[]>
│   ├── dirtyUsers: Set<number>
│   ├── pendingWrites: Map<tempId, Promise<void>>
│   ├── pendingMessageIds: Set<number>
│   └── nextTempId: -1 (decrementing)
├── Locks (Pure IronGuard)
│   ├── MESSAGE_CACHE_LOCK
│   └── MESSAGE_DATA_LOCK
└── Operations
    ├── Sync: getMessagesForUser(), getUnreadMessageCount()
    ├── Async: createMessage() with temp IDs
    ├── Batch: getAndMarkUnreadMessages()
    └── Background: Persistence + pending write tracking
```

#### 2.2 Lock Hierarchy

```
MESSAGE_CACHE_LOCK (management)
    ↓
MESSAGE_DATA_LOCK (data operations)
    ↓
MESSAGE_DB_LOCK (DB writes - used internally)
```

**Note:** MESSAGE_DB_LOCK is acquired internally by DB helper methods, not exposed in public API.

#### 2.3 Key Features

**Pure IronGuard Implementation:**
- No legacy lock wrappers
- All operations use `createLockContext()` and `acquireWrite()`/`acquireRead()`
- Lock contexts passed to internal helper methods per IronGuard best practices

**Async Message Creation:**
```typescript
async createMessage(userId: number, text: string): Promise<number> {
  // 1. Generate temporary ID (negative: -1, -2, -3, ...)
  const tempId = this.nextTempId--;
  
  // 2. Add to cache immediately with tempId
  const message = { id: tempId, ..., isPending: true };
  userMessages.get(userId).push(message);
  
  // 3. Start async DB write (don't await)
  this.persistMessageAsync(userId, tempId, message);
  
  // 4. Return tempId immediately (~0.5ms)
  return tempId;
}
```

**Race Condition Handling:**
- Messages can be marked as read while DB insertion is in progress
- `persistMessageAsync()` preserves current read status
- If status changed during insertion, user marked as dirty for background update

**Pending Write Tracking:**
```typescript
pendingWrites: Map<number, Promise<void>>  // tempId → write promise
pendingMessageIds: Set<number>              // Track temp IDs being written

async waitForPendingWrites(): Promise<void> {
  await Promise.all(Array.from(this.pendingWrites.values()));
}
```

**Example Usage:**
```typescript
// Fast message creation
const msgId = await messageCache.createMessage(userId, "Hello!");
// Returns immediately with tempId (-1)
// DB write happens in background

// Get unread messages (marks as read)
const unread = await messageCache.getAndMarkUnreadMessages(userId);

// Graceful shutdown
await messageCache.waitForPendingWrites(); // Wait for async writes
await messageCache.flushToDatabase();       // Flush read status updates
await messageCache.shutdown();
```

#### 2.4 Persistence Strategy

**Dual Persistence Mechanisms:**

1. **Pending Writes (New Messages):**
   - Async DB insertion after cache update
   - Tracked in `pendingWrites` map
   - Must complete before shutdown

2. **Dirty Users (Read Status):**
   - Background timer persists read status changes
   - Uses `UPDATE messages SET is_read=? WHERE id=?`
   - Skips messages with `isPending: true`

**Shutdown Sequence:**
```typescript
async shutdown() {
  stopBackgroundPersistence();
  await waitForPendingWrites();      // 1. Complete async insertions
  await flushToDatabase();            // 2. Flush read status updates
}
```

---

## Architectural Similarities

### ✅ Both Cache Managers Share:

1. **Singleton Pattern**
   ```typescript
   private static instance: CacheManager | null = null;
   static getInstance(config?: Config): CacheManager
   static resetInstance(): void  // For testing
   ```

2. **Pure IronGuard Lock System**
   - Compile-time deadlock prevention through TypeScript types
   - Strict lock hierarchy enforcement
   - Context-based lock acquisition with explicit dispose
   - Try-finally pattern for guaranteed cleanup
   - No callback-based wrappers - direct lock management

3. **Internal Auto-Initialization Pattern**
   ```typescript
   // Both use guarded initialization internally
   async initialize(): Promise<void> {
     if (this.isInitialized) return;  // Idempotent guard
     // ... initialization code
     this.isInitialized = true;
   }
   
   // Public methods auto-initialize on first access
   async publicMethod(): Promise<Result> {
     if (!this.isInitialized) await this.initialize();
     // ... actual work
   }
   ```
   - **First call:** ~100-200ms (TypedCacheManager) or ~10-20ms (MessageCache)
   - **Subsequent calls:** <1ms (guard check only)
   - **API Design:** Clean - no explicit `initialize()` calls needed in client code

4. **Background Persistence**
   ```typescript
   private persistenceTimer: NodeJS.Timeout | null = null;
   private startBackgroundPersistence(): void
   private stopBackgroundPersistence(): void
   ```
   - Default 30-second interval
   - Configurable via `persistenceIntervalMs`

5. **Dirty Tracking**
   ```typescript
   private dirtyUsers: Set<number> = new Set();
   ```
   - Track which users need persistence
   - Clear after successful write

6. **Statistics Tracking**
   ```typescript
   private stats = {
     cacheHits: 0,
     cacheMisses: 0
   };
   ```

7. **Graceful Shutdown**
   - Stop background timer
   - Flush dirty data
   - Set `isInitialized = false`

8. **Database Integration**
   ```typescript
   private db: sqlite3.Database | null = null;
   ```
   - SQLite3 with callback-based API
   - Wrapped in Promises for async/await

8. **Configuration System**
   ```typescript
   interface CacheConfig {
     persistenceIntervalMs: number;
     enableAutoPersistence: boolean;
   }
   ```

---

## Architectural Differences

### 🔀 Key Distinctions:

#### 1. Lock System Implementation

| TypedCacheManager | MessageCache |
|-------------------|--------------|
| **Pure IronGuard** ✅ | **Pure IronGuard** |
| Direct `createLockContext()` usage | Direct `createLockContext()` usage |
| Clean try-finally-dispose pattern | Clean try-finally-dispose pattern |
| Migration completed October 2025 | Greenfield implementation |

**Code Example:**
```typescript
// Both use identical Pure IronGuard pattern
const ctx = createLockContext();
const lockCtx = await ctx.acquireWrite(SOME_LOCK);
try {
  // ... work with lock held
} finally {
  lockCtx.dispose();
}
```

#### 2. Initialization Model

| TypedCacheManager | MessageCache |
|-------------------|--------------|
| **Internal Auto-Init (Refactored):** `initialize()` called internally by public methods | **Internal Auto-Init:** `initialize()` called on first operation |
| First call loads world (~100-200ms), subsequent calls instant | First call connects DB (~10-20ms), subsequent calls instant |
| Starts battle scheduler on first init | No external services |

```typescript
// Both use identical internal auto-initialization pattern
async initialize(): Promise<void> {
  if (this.isInitialized) {
    return; // <-- Idempotent guard
  }
  // ... heavy initialization only once
  this.isInitialized = true;
}

// Public methods auto-initialize on first access
async loadUserIfNeeded(userId: number): Promise<User | null> {
  if (!this.isInitialized) {
    await this.initialize(); // <-- Auto-init if needed
  }
  // ... rest of method
}
```

**Clean Client Code:**
```typescript
// No explicit initialize() needed in API routes
export async function GET(request: NextRequest) {
  const cacheManager = getTypedCacheManager();
  const user = await cacheManager.loadUserIfNeeded(userId);
  // First request: ~100-200ms initialization + work
  // All other requests: <1ms guard check + work
}
```

**Architecture Decision:** After refactoring (October 2025), TypedCacheManager adopted MessageCache's cleaner internal auto-init pattern, eliminating ~15+ explicit `initialize()` calls throughout the codebase. In the same refactoring, all legacy lock wrappers were removed, achieving 100% Pure IronGuard implementation.

**Why the explicit API for TypedCacheManager?**

The explicit `initialize()` call in every API route serves as:
1. 📋 **Documentation:** Makes initialization requirement visible in code
2. 🔍 **Debugging:** Easy to see initialization in logs/traces
3. 🎯 **Control:** Could theoretically call at app startup instead (though not currently done)

**Reality:** Both have **effectively the same cost** - expensive once, cheap thereafter.

**Could TypedCacheManager use implicit auto-init like MessageCache?**

Yes! Could replace all `await cacheManager.initialize()` calls with internal auto-init:

```typescript
async loadUserIfNeeded(userId: number): Promise<User | null> {
  if (!this.isInitialized) {
    await this.initialize(); // Auto-init
  }
  // ... rest of method
}
```

**Trade-offs:**
- ✅ **Pro:** Simpler API, less boilerplate in route handlers
- ✅ **Pro:** Matches MessageCache pattern (consistency)
- ❌ **Con:** Less explicit that initialization is happening
- ❌ **Con:** Would need to add guards to ~10+ public methods

**Current design:** Explicit but idempotent - a **middle ground** between fully automatic and truly mandatory startup initialization.

#### 3. Data Structure Complexity

**TypedCacheManager:**
```typescript
private users: Map<number, User>;              // User objects (complex)
private world: World | null;                    // Singleton world state
private usernameToUserId: Map<string, number>; // Index cache
private dirtyUsers: Set<number>;                // Dirty tracking
private worldDirty: boolean;                    // World dirty flag
```
→ Manages **heterogeneous** data: Users, World, Usernames

**MessageCache:**
```typescript
private userMessages: Map<number, Message[]>;   // Per-user message arrays
private dirtyUsers: Set<number>;                 // Dirty tracking
private nextTempId: number = -1;                 // Temp ID generator
private pendingWrites: Map<number, Promise<void>>; // Async tracking
private pendingMessageIds: Set<number>;          // Pending IDs
```
→ Manages **homogeneous** data: Messages only

#### 4. Async Operations Strategy

| Aspect | TypedCacheManager | MessageCache |
|--------|-------------------|--------------|
| **Async Writes** | ❌ No | ✅ Yes (message creation) |
| **Temporary IDs** | ❌ No | ✅ Yes (negative IDs) |
| **Pending Tracking** | ❌ No | ✅ `pendingWrites` Map |
| **Shutdown Wait** | Simple flush | Wait for pending + flush |

**MessageCache Advantage:**
```typescript
// 10-20x faster than synchronous DB write
const msgId = await createMessage(userId, "Welcome!");
// Returns in ~0.5ms with tempId
// DB write completes in background (~5-10ms)
```

#### 5. Lock Hierarchy Complexity

**TypedCacheManager:**
```
4 locks, 5 levels:
CACHE_LOCK (1) → WORLD_LOCK (2) → USER_LOCK (3) → DATABASE_LOCK (5)
                                 ↘ MESSAGE_LOCK (4)
```
→ Complex hierarchy with multiple paths

**MessageCache:**
```
2 locks, 2 levels:
MESSAGE_CACHE_LOCK → MESSAGE_DATA_LOCK
                          ↓
                   MESSAGE_DB_LOCK (internal)
```
→ Simple linear hierarchy

#### 6. Context Passing Pattern

**Both use IronGuard best practices:**

**TypedCacheManager:**
```typescript
// ✅ Unsafe methods require context (compile-time safety)
getUserUnsafe(userId: number, context: UserAccessContext): User | null
updateUserUnsafe(user: User, context: UserAccessContext): void
getWorldUnsafe(context: WorldAccessContext): World

// Internal methods acquire their own locks when needed
private async persistDirtyUsers(): Promise<void>
private async persistDirtyWorld(): Promise<void>
```

**MessageCache:**
```typescript
// ✅ Internal methods accept context (explicit passing)
private async loadMessagesFromDb<THeld extends readonly LockLevel[]>(
  context: ValidLock4Context<THeld>,
  userId: number
): Promise<Message[]>
```

**Design Trade-off:**
- TypedCacheManager: Internal methods create contexts (simpler internal code)
- MessageCache: Internal methods accept contexts (more explicit, better for complex flows)

#### 7. API Surface

**TypedCacheManager:**
```typescript
// High-level operations (auto-initialize)
loadUserIfNeeded(userId: number): Promise<User | null>
getUserByUsername(username: string): Promise<User | null>
getStats(): Promise<TypedCacheStats>
flushAllToDatabase(): Promise<void>

// Lock acquisition (Pure IronGuard)
acquireWorldRead(context): Promise<WorldReadContext>
acquireWorldWrite(context): Promise<WorldWriteContext>
acquireUserLock(context): Promise<UserContext>
acquireDatabaseRead(context): Promise<DatabaseReadContext>
acquireDatabaseWrite(context): Promise<DatabaseWriteContext>

// Unsafe operations (require lock context)
getWorldUnsafe(context): World
getUserUnsafe(userId, context): User | null
updateUserUnsafe(user, context): void
setUserUnsafe(user, context): void
loadUserFromDbUnsafe(userId, context): Promise<User | null>
persistUserToDb(user, context): Promise<void>
```
→ **15+ public methods** (cleaner after migration)

**MessageCache:**
```typescript
// Core operations
getMessagesForUser(userId: number): Promise<Message[]>
getAndMarkUnreadMessages(userId: number): Promise<UnreadMessage[]>
createMessage(userId, text): Promise<number>
getUnreadMessageCount(userId: number): Promise<number>

// Utility
getStats(): Promise<MessageCacheStats>
flushToDatabase(): Promise<void>
waitForPendingWrites(): Promise<void>
deleteOldReadMessages(days): Promise<number>

// Lifecycle
initialize(): Promise<void>
shutdown(): Promise<void>
```
→ **10 public methods** (cleaner API)

#### 8. External Dependencies

**TypedCacheManager:**
- `worldRepo`: `loadWorldFromDb()`, `saveWorldToDb()`
- `userRepo`: `getUserByIdFromDb()`, `getUserByUsernameFromDb()`
- `battleScheduler`: Starts battle processing (dynamic import)
- Pure `typedLocks`: `createLockContext()`, lock level constants

**MessageCache:**
- `messagesRepo`: Type definitions only (`Message`, `UnreadMessage`)
- No external service dependencies
- Pure IronGuard (no legacy wrappers)

---

## Performance Comparison

### Message Creation Benchmark

| Implementation | Sync DB Write | Async with Temp ID |
|----------------|---------------|---------------------|
| **Time** | ~5-10ms | ~0.5ms |
| **Blocking** | ✅ Blocks caller | ❌ Non-blocking |
| **Availability** | After DB write | Immediate (temp ID) |
| **Speedup** | Baseline | **10-20x faster** |

### Cache Hit Performance

| Operation | TypedCacheManager | MessageCache |
|-----------|-------------------|--------------|
| User lookup (cache hit) | ~1ms | N/A |
| User lookup (cache miss) | ~10-20ms | N/A |
| Message count (cache hit) | N/A | ~1ms |
| Message count (cache miss) | N/A | ~10-20ms |

**Both achieve similar cache hit performance** (~1ms), as expected for in-memory Map lookups.

---

## Design Patterns Summary

### Patterns Used in Both

1. **Singleton:** Ensures single cache instance per process
2. **Write-Behind:** Cache updates immediately, DB persistence deferred
3. **Dirty Tracking:** Mark modified entities for background persistence
4. **Lock Hierarchy:** Enforced ordering prevents deadlocks
5. **Promise-based API:** Async/await for all operations
6. **Statistics Collection:** Cache hits/misses for monitoring

### Patterns Unique to MessageCache

1. **Optimistic ID Assignment:** Use temporary IDs before DB confirmation
2. **Pending Operation Tracking:** Map of in-flight DB writes
3. **Graceful Degradation:** Remove failed messages from cache
4. **Dual Persistence:** Separate mechanisms for inserts vs. updates

### Patterns Unique to TypedCacheManager

1. **Facade Pattern:** Wraps multiple data domains (User, World)
2. **Index Caching:** Username → UserID mapping for fast lookups
3. **Hybrid Lock API:** Legacy + modern IronGuard methods
4. **Service Integration:** Starts external services (battle scheduler)

---

## Recommendations

### For TypedCacheManager

1. ~~**Migrate to Pure IronGuard:**~~ ✅ **Completed October 2025**
   - ~~Remove `TypedMutex` and `TypedReadWriteLock` wrappers~~
   - ~~Update all `with*Lock()` methods to modern `acquire*Lock()` pattern~~
   - ~~Pass lock contexts to internal methods~~

2. **Split Responsibilities:**
   - Consider separating `UserCache` and `WorldCache` classes
   - Reduce lock hierarchy complexity
   - Improve testability

3. **Add Async User Loading:**
   - Could benefit from temp user IDs for immediate availability
   - Reduce blocking on cache misses

### For MessageCache

1. **Add Compression:**
   - Old messages could be compressed in cache
   - Reduce memory footprint for high-message users

2. **Batch DB Operations:**
   - Currently updates messages one-by-one
   - Could use batch UPDATE for better performance

3. **Add TTL for Cache Entries:**
   - Evict inactive users' messages after threshold
   - Prevent unbounded memory growth

### For Both

1. **Unified Configuration:**
   - Extract shared config (persistence interval, etc.)
   - Centralized cache tuning

2. **Monitoring Integration:**
   - Export metrics to external monitoring
   - Track persistence lag, cache size, etc.

3. **Health Checks:**
   - Add `isHealthy()` method
   - Check DB connection, pending write count, etc.

---

## Conclusion

Both cache managers successfully implement the core caching strategy with **Pure IronGuard lock safety**. As of October 2025, both systems use identical lock management patterns:

- **TypedCacheManager:** Mature, feature-rich, 100% Pure IronGuard (migration completed)
- **MessageCache:** Modern, focused, optimized for async operations, Pure IronGuard

The separation of concerns is justified:
- ✅ Message operations don't block game state updates
- ✅ Each cache has simpler lock hierarchy
- ✅ Performance optimizations (async creation) without affecting other systems
- ✅ Both use consistent, type-safe lock management

This architecture demonstrates successful completion of the **Strangler Fig Pattern** for incremental modernization while maintaining system stability. The legacy lock system has been completely removed, achieving:

- **331 tests passing** (39 test files)
- **Zero compilation errors**
- **Consistent IronGuard patterns** across entire codebase
- **Improved code clarity** through explicit lock management

---

**Completed Milestones:**
1. ✅ TypedCacheManager migration to pure IronGuard (October 2025)
2. ✅ All legacy lock wrappers removed (`withWorldRead/Write`, `withUserLock`, `withDatabaseRead/Write`)
3. ✅ All API routes migrated to try-finally-dispose pattern

**Next Steps:**
1. Consider extracting shared base class or utilities
2. Add comprehensive cache metrics and monitoring
3. Evaluate splitting TypedCacheManager into UserCache + WorldCache
