# Building Blocks - Cache Systems

**Part of:** Spacewars Ironcore Architecture Documentation

---

## Overview

The Spacewars application uses three cache manager implementations to optimize database access and ensure data consistency. All three use the IronGuard lock system for compile-time deadlock prevention.

---

## Cache Manager Comparison

| Aspect | TypedCacheManager | MessageCache | BattleCache |
|--------|-------------------|--------------|-------------|
| **Primary Purpose** | User data, world state, username mappings | User messages and notifications | Battle state and combat data |
| **Data Scope** | Multi-entity (User, World) | Single-entity (Messages) | Single-entity (Battles) |
| **Lock System** | Pure IronGuard | Pure IronGuard | Pure IronGuard via delegation |
| **Lock Hierarchy** | 4 levels (CACHE→WORLD→USER→DB) | 2 levels (CACHE→DATA) | 4 levels (via TypedCacheManager + BATTLE) |
| **Async Operations** | Background persistence | Async creation + background persistence | Background persistence |
| **Temporary IDs** | No | Yes (negative IDs) | No |
| **Cache Structure** | Map<userId, User> + World singleton | Map<userId, Message[]> | Map<battleId, Battle> + user→battle index |
| **Singleton Pattern** | Yes | Yes | Yes |
| **Initialization** | Internal auto-init (idempotent) | Internal auto-init (idempotent) | Mixed strategy (sync + async) |
| **Statistics Tracking** | Cache hits/misses per entity type | Cache hits/misses + pending writes | No statistics |
| **Background Timer** | 30s persistence interval | 30s persistence interval | 30s persistence interval |

---

## TypedCacheManager

**Location:** `src/lib/server/typedCacheManager.ts`

### Architecture

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
    ├── World operations (read/write)
    ├── User operations (CRUD)
    ├── Database operations (load/persist)
    └── Background persistence + battle scheduler
```

### Lock Hierarchy

```
CACHE_LOCK (1)
    ↓
WORLD_LOCK (2)
    ↓
USER_LOCK (3)
    ↓
DATABASE_LOCK (5)
```

### Key Features

**Pure IronGuard Lock System:**
- Direct lock context acquisition with explicit `dispose()` in try-finally blocks
- Compile-time deadlock prevention through type system
- No callback-based wrappers

**Multi-Entity Caching:**
- Caches heterogeneous data: User objects, World state, username mappings
- Separate dirty tracking per entity type

**Internal Auto-Initialization:**
- Public methods auto-initialize on first access
- Initialization loads world data from database (~100-200ms first call, <1ms subsequent)
- Starts background persistence and battle scheduler on first init

**Usage Example:**
```typescript
// High-level API - auto-initializes if needed
const cacheManager = getTypedCacheManager();
const user = await cacheManager.loadUserIfNeeded(userId);

// Direct lock acquisition pattern
const ctx = createLockContext();
const worldCtx = await cacheManager.acquireWorldWrite(ctx);
try {
  const userCtx = await cacheManager.acquireUserLock(worldCtx);
  try {
    const user = cacheManager.getUserUnsafe(userId, userCtx);
    manager.updateUserUnsafe(user, userCtx);
  } finally {
    userCtx.dispose();
  }
} finally {
  worldCtx.dispose();
}
```

### Persistence Strategy

**Write-Behind Caching:**
1. Updates immediately modify in-memory cache
2. Entity marked as "dirty" (`dirtyUsers` set or `worldDirty` flag)
3. Background timer (30s) flushes dirty data to database
4. Shutdown performs final flush

**Database Operations:**
- `persistUserToDb()`: Updates user fields (iron, tech_tree, defense values)
- `persistDirtyWorld()`: Calls `saveWorldToDb(world)`

---

## MessageCache

**Location:** `src/lib/server/MessageCache.ts`

### Architecture

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
    ├── getMessagesForUser(), getUnreadMessageCount()
    ├── createMessage() with temp IDs (async)
    ├── getAndMarkUnreadMessages() (batch)
    └── Background persistence
```

### Lock Hierarchy

```
MESSAGE_CACHE_LOCK
    ↓
MESSAGE_DATA_LOCK
    ↓
MESSAGE_DB_LOCK (internal)
```

### Key Features

**Pure IronGuard Implementation:**
- All operations use `createLockContext()` and `acquireWrite()`/`acquireRead()`
- Lock contexts passed to internal methods

**Async Message Creation:**
```typescript
async createMessage(userId: number, text: string): Promise<number> {
  // 1. Generate temporary negative ID
  const tempId = this.nextTempId--;
  // 2. Add to cache immediately with tempId
  const message = { id: tempId, ..., isPending: true };
  // 3. Start async DB write (non-blocking)
  this.persistMessageAsync(userId, tempId, message);
  // 4. Return tempId immediately (~0.5ms, 10-20x faster than sync)
  return tempId;
}
```

**Race Condition Handling:**
- Messages can be marked as read while DB insertion is in progress
- `persistMessageAsync()` preserves current read status
- If status changed during insertion, user marked as dirty for background update

**Pending Write Tracking:**
- `pendingWrites: Map<number, Promise<void>>` tracks temp IDs being written
- `waitForPendingWrites()` ensures all async writes complete before shutdown

**Usage Example:**
```typescript
// Fast message creation
const msgId = await messageCache.createMessage(userId, "Hello!");
// Returns immediately with tempId (-1), DB write happens in background

// Get unread messages (marks as read)
const unread = await messageCache.getAndMarkUnreadMessages(userId);

// Graceful shutdown
await messageCache.waitForPendingWrites(); // Wait for async writes
await messageCache.flushToDatabase();       // Flush read status updates
await messageCache.shutdown();
```

### Persistence Strategy

**Dual Persistence Mechanisms:**

1. **Pending Writes (New Messages):**
   - Async DB insertion after cache update
   - Tracked in `pendingWrites` map
   - Must complete before shutdown

2. **Dirty Users (Read Status):**
   - Background timer persists read status changes
   - Uses `UPDATE messages SET is_read=? WHERE id=?`
   - Skips messages with `isPending: true`

---

## BattleCache

**Location:** `src/lib/server/BattleCache.ts`

### Architecture

```
BattleCache (Singleton)
├── Configuration
│   ├── persistenceIntervalMs: 30000
│   └── enableAutoPersistence: true
├── Storage
│   ├── battles: Map<number, Battle>
│   ├── activeBattlesByUser: Map<number, number>  // userId → battleId
│   ├── dirtyBattles: Set<number>
│   └── initializationPromise: Promise<BattleCache> | null
├── Locks (via delegation)
│   ├── Delegates to TypedCacheManager for User/World locks
│   ├── BATTLE_LOCK (level 12) for battle-specific operations
│   └── Uses DATABASE_LOCK via TypedCacheManager
└── Operations
    ├── Mixed API: Sync getInstance() + Async getInitializedInstance()
    ├── High-level: Auto-initializing async methods
    ├── Low-level: "Unsafe" methods requiring manual initialization
    └── Background persistence with lock delegation
```

### Lock Hierarchy

```
CACHE_LOCK (1)
    ↓
WORLD_LOCK (2)
    ↓
USER_LOCK (3)
    ↓
BATTLE_LOCK (12)
    ↓
DATABASE_LOCK (5)
```

### Key Features

**Mixed Initialization Strategy:**
Provides dual API for backward compatibility with database callbacks:

```typescript
// Synchronous for callback contexts
static getInstance(): BattleCache {
  if (!BattleCache.instance) {
    BattleCache.instance = new BattleCache();
  }
  return BattleCache.instance; // May not be fully initialized
}

// Async with auto-initialization
static async getInitializedInstance(): Promise<BattleCache> {
  if (BattleCache.instance?.initialized) {
    return BattleCache.instance;
  }
  if (!BattleCache.initializationPromise) {
    BattleCache.initializationPromise = (async () => {
      const instance = BattleCache.getInstance();
      await instance.initialize(await getDatabase());
      return instance;
    })();
  }
  return BattleCache.initializationPromise;
}
```

**Lock Delegation Pattern:**
Delegates database operations to TypedCacheManager instead of implementing own locks:

```typescript
async loadBattleIfNeeded(battleId: number): Promise<Battle | null> {
  await this.ensureInitializedAsync();
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const dbCtx = await cacheManager.acquireDatabaseRead(ctx);
  try {
    const battle = await this.loadBattleFromDb(battleId);
    return battle;
  } finally {
    dbCtx.dispose();
  }
}
```

**Usage Examples:**
```typescript
// Pattern 1: High-level operations (auto-init)
const activeBattles = await battleCache.getActiveBattles();

// Pattern 2: Database callbacks (pre-init)
export async function createBattle(...) {
  await getBattleCacheInitialized(); // Pre-initialize
  db.run("INSERT INTO battles...", [], function(err) {
    if (!err) {
      getBattleCache().setBattleUnsafe(battle); // Safe - pre-initialized
    }
  });
}
```

### Persistence Strategy

**Write-Behind with Delegation:**
1. Updates modify in-memory cache immediately
2. Battle marked as "dirty" (added to `dirtyBattles`)
3. Background timer (30s) flushes via TypedCacheManager locks
4. Shutdown performs final flush

---

## Shared Architecture Patterns

All three cache managers share these core patterns:

### 1. Singleton Pattern
```typescript
private static instance: CacheManager | null = null;
static getInstance(config?: Config): CacheManager
static resetInstance(): void  // For testing
```

### 2. IronGuard Lock System
- Compile-time deadlock prevention through TypeScript types
- Strict lock hierarchy enforcement
- Context-based lock acquisition with explicit `dispose()` in try-finally blocks

### 3. Initialization
- **TypedCacheManager & MessageCache:** Internal auto-init with idempotent guards
- **BattleCache:** Mixed strategy (sync + async) for callback compatibility
- First call expensive (~10-200ms), subsequent calls instant (<1ms)

### 4. Background Persistence
- Default 30-second interval (configurable via `persistenceIntervalMs`)
- Automatic start on initialization
- Stop and final flush on shutdown

### 5. Dirty Tracking
```typescript
// TypedCacheManager & BattleCache
private dirtyUsers: Set<number> = new Set();
private dirtyBattles: Set<number> = new Set();

// MessageCache adds pending write tracking
private dirtyUsers: Set<number> = new Set();
private pendingWrites: Map<number, Promise<void>> = new Map();
```

### 6. Statistics Tracking
- **TypedCacheManager & MessageCache:** Cache hits/misses, pending operations
- **BattleCache:** No statistics (simple cache)

### 7. Database Integration
- SQLite3 with callback-based API wrapped in Promises
- All managers use `sqlite3.Database` instance

---

## Key Differences

### Lock Implementation
- **TypedCacheManager:** Direct IronGuard usage with 4-level hierarchy
- **MessageCache:** Direct IronGuard usage with 2-level hierarchy  
- **BattleCache:** Delegates to TypedCacheManager for locks

### Data Complexity
- **TypedCacheManager:** Multi-entity (User + World + username index)
- **MessageCache:** Single-entity (Messages per user)
- **BattleCache:** Single-entity (Battles + user→battle index)

### Async Operations
- **MessageCache only:** Creates messages with temporary IDs for non-blocking operation (~0.5ms vs ~5-10ms)
- **Others:** Synchronous updates with background persistence

### Initialization Strategy
- **TypedCacheManager & MessageCache:** Internal auto-init pattern in all public methods
- **BattleCache:** Dual API (sync `getInstance()` + async `getInitializedInstance()`) for database callback compatibility

---

## Cache Consistency

### Known Issues

**TechRepo bypassing TypedCacheManager:**
- **Problem:** `TechRepo` directly reads/writes user data (iron, tech_counts, defense values)
- **Impact:** TypedCacheManager can have stale cached data
- **Affected routes:** `/api/build-item`, `/api/build-status`, `/api/complete-build`
- **Recommended fix:** Make TechRepo coordinate with TypedCacheManager for cached fields

**Status:**
- ✅ Message operations: All go through MessageCache
- ✅ Battle operations: All go through BattleCache
- ✅ User/World operations: Only accessed via TypedCacheManager
- ❌ Tech operations: TechRepo needs cache coordination

---

## Summary

All three cache managers use the IronGuard lock system for type-safe, deadlock-free concurrent access. They share core patterns (singleton, write-behind caching, dirty tracking, background persistence) while differing in complexity, initialization strategy, and async operation support.

**Key characteristics:**
- **TypedCacheManager:** Central multi-entity cache with 4-level lock hierarchy
- **MessageCache:** Fast async message creation with temporary IDs
- **BattleCache:** Simple delegation pattern for lock management

The separation ensures message operations don't block game updates, and battle operations don't interfere with user/world caching.
