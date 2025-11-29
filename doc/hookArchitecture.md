# Hook Architecture Documentation

## Overview

The Spacewars3 application uses a custom React hook architecture for managing client-side state and server communication. The hooks follow consistent patterns for data fetching, caching, error handling, and real-time updates through both polling and event-driven mechanisms.

## Core Design Principles

1. **Single Responsibility**: Each hook manages a specific domain of data
2. **Consistent API**: All hooks follow similar interface patterns (isLoading, error, data, refetch)
3. **Event-Driven Communication**: Hooks communicate through a global event system
4. **Efficient Polling**: Configurable polling intervals with automatic retry logic
5. **Proper Cleanup**: All hooks properly clean up intervals, timeouts, and event listeners
6. **Shared Data Layer**: Factory-related hooks use a shared cache to eliminate redundant API calls

---

## Authentication & Session Management

### `useAuth`
**Location**: `src/lib/client/hooks/useAuth.ts`

**Purpose**: Manages user authentication state and login/logout operations.

**API Dependencies**:
- `POST /api/login` - User login
- `POST /api/logout` - User logout  
- `POST /api/register` - User registration
- `GET /api/session` - Check authentication status

**Data Provided**:
- `isLoggedIn: boolean` - Authentication status
- `username: string | null` - Current username
- `shipId: number | null` - User's ship ID
- `isLoading: boolean` - Loading state
- `login(username, password)` - Login function
- `logout()` - Logout function
- `register(username, password)` - Registration function

**Polling Behavior**:
- **No polling** - Only checks session on mount and after login/logout operations
- One-time session check on component mount

**Usage Pattern**:
```tsx
const { isLoggedIn, username, login, logout } = useAuth();
```

---

## Resource Management

### `useIron`
**Location**: `src/lib/client/hooks/useIron.ts`

**Purpose**: Manages iron (currency) amount with real-time display updates and server synchronization.

**API Dependencies**:
- `GET /api/user-stats` - Get current iron amount and iron per second rate

**Data Provided**:
- `ironAmount: number` - Current iron amount (real-time calculated)
- `ironPerSecond: number` - Iron generation rate
- `isLoading: boolean` - Loading state
- `error: string | null` - Error state
- `refetch()` - Manual refresh function

**Polling Behavior**:
- **Server polling**: Every 5 seconds (configurable)
- **Display updates**: Every 200ms for smooth real-time iron display
- **Event listening**: Updates on `IRON_UPDATED` events from other components

**Implementation Details**:
- Uses dual-state system: server iron amount + calculated display amount
- Interpolates iron growth between server updates for smooth UX
- Automatically retries on network errors (up to 3 attempts)

**Usage Pattern**:
```tsx
const { ironAmount, isLoading, error } = useIron(isLoggedIn);
```

---

## Research System

### `useResearchStatus`
**Location**: `src/lib/client/hooks/useResearchStatus.ts`

**Purpose**: Monitors active research status for status indicators and UI updates.

**API Dependencies**:
- `GET /api/techtree` - Get tech tree state and active research

**Data Provided**:
- `techTree: TechTree | null` - Complete tech tree state
- `isResearchActive: boolean` - Whether research is currently active
- `isLoading: boolean` - Loading state
- `error: string | null` - Error state
- `refetch()` - Manual refresh function

**Polling Behavior**:
- **Server polling**: Every 5-10 seconds (configurable, default 10s)
- **Timeout-based polling**: Uses setTimeout instead of setInterval for better control
- **Auto-retry**: Up to 3 retry attempts on network errors

**Usage Pattern**:
```tsx
const { isResearchActive, error } = useResearchStatus(isLoggedIn, 10000);
```

---

## Factory System (Shared Data Architecture)

The factory system uses a **shared data layer** architecture to eliminate redundant API calls. Three hooks work together:

### `useFactoryDataCache` (Internal Shared Cache)
**Location**: `src/lib/client/hooks/useFactoryDataCache.ts`

**Purpose**: Provides shared data layer for factory-related hooks to eliminate redundant API calls.

**API Dependencies**:
- `GET /api/tech-catalog` - Get available weapons and defenses specifications
- `GET /api/build-status` - Get tech counts, build queue, and current stats

**Architecture**:
- **Singleton pattern**: Single shared cache across all hook instances
- **Subscriber pattern**: Notifies all consuming hooks when data updates
- **Request deduplication**: Prevents concurrent API calls using promises
- **Shared polling**: Single 5-second interval serves all factory hooks

**Data Cached**:
- Build queue with countdown timers
- Tech counts (current inventory)
- Weapons catalog (specifications)
- Defenses catalog (specifications)

### `useBuildQueue`
**Location**: `src/lib/client/hooks/useBuildQueue.ts`

**Purpose**: Manages build queue operations and real-time countdown timers.

**Data Source**: `useFactoryDataCache` (shared cache)

**Data Provided**:
- `buildQueue: BuildQueueItem[]` - Current build queue with countdown timers
- `isLoading: boolean` - Loading state from shared cache
- `isBuilding: boolean` - Whether a build action is in progress
- `isCompletingBuild: boolean` - Whether completing a build (cheat mode)
- `error: string | null` - Error state
- `buildItem(itemKey, itemType)` - Start building an item
- `completeBuild()` - Complete first build instantly (cheat mode)
- `refetch()` - Refresh data

**Polling Behavior**:
- **Server polling**: Every 5 seconds via shared cache
- **Countdown updates**: Every 1 second for real-time timers
- **Event emissions**: Emits events when queue state changes

**Events Emitted**:
- `BUILD_QUEUE_STARTED` - When first item added to empty queue
- `BUILD_QUEUE_COMPLETED` - When queue becomes empty
- `BUILD_ITEM_COMPLETED` - When individual build finishes
- `IRON_UPDATED` - When build actions affect iron balance

### `useTechCounts`
**Location**: `src/lib/client/hooks/useTechCounts.ts`

**Purpose**: Manages technology inventory and catalog data.

**Data Source**: `useFactoryDataCache` (shared cache)

**Data Provided**:
- `techCounts: TechCounts | null` - Current inventory of weapons/defenses
- `weapons: Record<string, WeaponSpec>` - Available weapons specifications
- `defenses: Record<string, DefenseSpec>` - Available defenses specifications  
- `isLoading: boolean` - Loading state from shared cache
- `error: string | null` - Error state
- `refetch()` - Refresh data

**Polling Behavior**:
- **Server polling**: Every 5 seconds via shared cache
- **Event listening**: Auto-refreshes on build completion events

**Events Listened**:
- `BUILD_ITEM_COMPLETED` - Refresh when individual builds complete
- `BUILD_QUEUE_COMPLETED` - Refresh when entire queue completes

**Usage Patterns**:
```tsx
// Build queue management
const { buildQueue, buildItem, completeBuild } = useBuildQueue(isLoggedIn);

// Tech inventory and catalog
const { techCounts, weapons, defenses } = useTechCounts(isLoggedIn);
```

### `useDefenseValues`
**Location**: `src/lib/client/hooks/useDefenseValues.ts`

**Purpose**: Manages defense values (hull, armor, shield) with client-side regeneration.

**Data Source**: `/api/ship-stats` endpoint

**Data Provided**:
- `defenseValues: DefenseValues | null` - Current defense values with regeneration
- `isLoading: boolean` - Loading state
- `error: string | null` - Error state
- `refetch()` - Refresh data

**Polling Behavior**:
- **Server polling**: Every 5 seconds to sync server state
- **Client-side regeneration**: Every 1 second for smooth UI updates
- **Event listening**: Auto-refreshes on build completion events

**Regeneration Logic**:
- Values regenerate at 1 per second (hardcoded)
- Current values are clamped at max values (no overflow)
- Client interpolates between server updates for smooth UX

**Events Listened**:
- `BUILD_ITEM_COMPLETED` - Refresh when defense items are built
- `BUILD_QUEUE_COMPLETED` - Refresh when queue completes

**Usage Patterns**:
```tsx
// Defense values with regeneration
const { defenseValues, isLoading, error } = useDefenseValues();

// Access individual defense values
const hullCurrent = defenseValues?.hull.current;
const hullMax = defenseValues?.hull.max;
```

---

## Performance Optimizations

### Shared Data Layer Benefits
- **Before**: 2 hooks × 5-second intervals = 12 API calls per minute
- **After**: 1 shared cache × 5-second intervals = 6 API calls per minute
- **40% reduction** in API calls for factory-related data

### Request Deduplication
- Concurrent requests to the same endpoint are deduplicated
- Single promise shared between multiple hook instances
- Prevents race conditions and duplicate network calls

### Event-Driven Updates
- Cross-component communication without prop drilling
- Automatic data refresh when related actions complete
- Reduces unnecessary polling in some cases

---

## Error Handling Strategy

### Consistent Error Patterns
All hooks implement similar error handling:

1. **Network Error Retry**: Up to 3 automatic retry attempts
2. **Exponential Backoff**: 2-second delays between retries  
3. **Error State Management**: Clear error states on successful requests
4. **Manual Recovery**: All hooks provide `refetch()` functions

### Error Types Handled
- **Network errors**: Connection failures, timeouts
- **API errors**: 4xx/5xx HTTP responses with error messages
- **Authentication errors**: Automatic state reset when session expires
- **Validation errors**: Invalid request parameters

---

## Event System

### Global Event Bus
**Location**: `src/lib/client/services/eventService.ts`

**Available Events**:
- `RESEARCH_TRIGGERED` - When research starts
- `RESEARCH_COMPLETED` - When research finishes
- `IRON_UPDATED` - When iron amount changes
- `BUILD_QUEUE_STARTED` - When build queue starts
- `BUILD_QUEUE_COMPLETED` - When build queue empties
- `BUILD_ITEM_COMPLETED` - When individual build completes

### Event Usage Pattern
```tsx
// Emitting events
globalEvents.emit(EVENTS.IRON_UPDATED);

// Listening to events
useEffect(() => {
  const handler = () => refetch();
  globalEvents.on(EVENTS.IRON_UPDATED, handler);
  return () => globalEvents.off(EVENTS.IRON_UPDATED, handler);
}, []);
```

---

## API Endpoint Reference

### Authentication Endpoints
- `POST /api/login` - User authentication
- `POST /api/logout` - End user session
- `POST /api/register` - Create new user account
- `GET /api/session` - Check authentication status

### Resource Management Endpoints  
- `GET /api/user-stats` - Get iron amount and generation rate

### Research System Endpoints
- `GET /api/techtree` - Get tech tree state and research definitions
- `POST /api/trigger-research` - Start new research

### Factory System Endpoints
- `GET /api/tech-catalog` - Get weapons and defenses catalog
- `GET /api/build-status` - Get tech counts and build queue
- `POST /api/build-item` - Start building an item
- `POST /api/complete-build` - Complete first build (cheat mode)

### Game World Endpoints
- `GET /api/world` - Get world state and objects
- `POST /api/navigate` - Move ship
- `POST /api/harvest` - Collect space objects
- `GET /api/ship-stats` - Get ship statistics and defense values

---

## Integration Examples

### Factory Page Integration
```tsx
const FactoryPage: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const { ironAmount } = useIron(isLoggedIn);
  const { buildQueue, buildItem } = useBuildQueue(isLoggedIn);  
  const { techCounts, weapons } = useTechCounts(isLoggedIn);
  
  // UI renders with real-time data from all hooks
};
```

### Status Header Integration
```tsx
const StatusHeader: React.FC = () => {
  const { ironAmount, isLoading } = useIron(true, 5000);
  const { isResearchActive, error } = useResearchStatus(true, 10000);
  
  // Shows real-time iron + research status
};
```

---

## Development Guidelines

### Adding New Hooks

1. **Follow naming convention**: `use[DomainName]` (e.g., `useWorldData`)
2. **Implement consistent interface**: `{ data, isLoading, error, refetch }`
3. **Add proper cleanup**: Clear intervals, timeouts, and event listeners
4. **Include retry logic**: Network error handling with exponential backoff
5. **Emit relevant events**: Allow other hooks to react to state changes
6. **Add TypeScript types**: Full type safety for all interfaces

### Performance Considerations

1. **Use shared data layers** when multiple hooks need the same API data
2. **Configure appropriate polling intervals** based on data freshness needs
3. **Implement request deduplication** for frequently called endpoints
4. **Add event-driven updates** to reduce unnecessary polling
5. **Cleanup resources properly** to prevent memory leaks

### Testing Hooks

1. **Mock API services** in hook tests
2. **Test error scenarios** including network failures
3. **Verify cleanup behavior** on component unmount
4. **Test event emissions and listening**
5. **Validate retry logic** and exponential backoff

---

## Architecture Benefits

1. **Separation of Concerns**: Each hook manages a specific domain
2. **Reusability**: Hooks can be used across multiple components
3. **Testability**: Hooks are easily unit tested in isolation
4. **Performance**: Shared data layer eliminates redundant API calls
5. **Maintainability**: Consistent patterns make codebase easier to understand
6. **Real-time UX**: Smooth updates through polling and event-driven architecture
7. **Error Resilience**: Comprehensive error handling and retry mechanisms
8. **Type Safety**: Full TypeScript integration across all hooks

This architecture provides a solid foundation for scalable React applications with complex server state management requirements.