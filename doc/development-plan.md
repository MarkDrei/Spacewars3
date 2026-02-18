# Development Plan: Ship Inventory & Items

## Vision

As a player, I want to collect commanders from escape pods and manage them in a 10×10 inventory grid on the Ship page, so that I can build a crew that will eventually provide stat bonuses to my ship.

Commanders are the first item type. Each escape pod collected has a 90% chance of yielding a commander with random stat bonuses. Commanders are stored in the inventory, displayed in a grid with drag-and-drop reordering, and selected items show stat details. Stats have no gameplay effect yet — they are display-only.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL (JSON column for inventory, consistent with `build_queue`/`tech_tree` patterns)
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively
- **Drag-and-Drop**: HTML5 native Drag-and-Drop API (no external library)

## Goals

### Goal 1: Shared Types for Inventory and Commanders

**Description**: Define the type system for inventory slots, commanders, and their stat bonuses. These types are shared between client and server.

**Quality Requirements**: Types must be strict, well-documented, and extensible for future item types.

#### Task 1.1: Define Inventory and Commander Types

**Action**: Create shared type definitions for the inventory system: `InventoryItem`, `Commander`, `CommanderStat`, `Inventory`, and stat bonus type.

**Files**:

- `src/shared/src/types/inventory.ts` — new file with all inventory types

**Details**:

- `CommanderStatType` — union type: `'shipSpeed' | 'projectileDamage' | 'projectileReloadRate' | 'projectileAccuracy' | 'energyDamage' | 'energyReloadRate' | 'energyAccuracy'`
- `CommanderStat` — `{ statType: CommanderStatType, bonusPercent: number }` where `bonusPercent` is 0.1..1.0
- `Commander` — `{ id: string (UUID), name: string, stats: CommanderStat[] }` with 1-3 stats
- `InventoryItemType` — discriminated union, currently just `'commander'`
- `InventoryItem` — `{ type: 'commander', data: Commander }`
- `InventorySlot` — `{ row: number, col: number, item: InventoryItem | null }`
- `Inventory` — `{ slots: (InventoryItem | null)[][] }` — 10×10 2D array (row-major), null means empty
- Export a constant `INVENTORY_ROWS = 10`, `INVENTORY_COLS = 10`

#### Task 1.2: Re-export Inventory Types

**Action**: Export the new inventory types from the shared types barrel file.

**Files**:

- `src/shared/src/types/index.ts` — add re-export of `./inventory`

---

### Goal 2: Server-Side Inventory Logic

**Description**: Implement the server-side inventory domain model: storage in the User, commander generation on escape pod collection, and inventory manipulation (move items).

#### Sub-Goal 2.1: Database Schema — Add Inventory Column

**Description**: Add an `inventory` TEXT column to the users table via the migration system.

##### Task 2.1.1: Add Migration Version 9

**Action**: Add a new migration entry to the migrations array for the inventory column. Follow the existing pattern: `ALTER TABLE users ADD COLUMN IF NOT EXISTS inventory TEXT DEFAULT NULL`. Default is NULL (empty inventory treated as all-null 10×10 grid).

**Files**:

- `src/lib/server/migrations.ts` — add migration version 9 `add_inventory` to the `migrations` array, and add a new `applyInventoryMigration()` function following the existing pattern (check `columnExists`, then apply). Chain it in `applyTechMigrations()`.

##### Task 2.1.2: Update Schema Definition

**Action**: Add the `inventory` column to the `CREATE TABLE users` statement in the schema file so fresh databases include it.

**Files**:

- `src/lib/server/schema.ts` — add `inventory TEXT DEFAULT NULL` to the users table CREATE statement

##### Task 2.1.3: Update UserRow and Deserialization

**Action**: Add `inventory` field to `UserRow` interface and update `userFromRow()` to parse the JSON inventory into the typed `Inventory` structure (defaulting to a 10×10 null grid when column is NULL). Note: Direct DB writes are only for new users during creation; all updates go through UserCache.

**Files**:

- `src/lib/server/user/userRepo.ts` — add `inventory?: string` to `UserRow`, update `userFromRow()` to parse it (handles NULL as empty 10×10 grid)

**Note**: The `saveUserToDb()` function in userRepo.ts is only used for initial user creation. Updates are handled by UserCache's `persistUserToDb()` method.

#### Sub-Goal 2.2: User Domain — Inventory on the User Class

**Description**: Add inventory as a property of the User class and provide methods for manipulation.

##### Task 2.2.1: Add Inventory Property to User

**Action**: Add an `inventory` property (type `(InventoryItem | null)[][]`) to the User class. Initialize from constructor parameter. Add helper methods. All inventory mutations must go through the User class to ensure proper cache integration.

**Files**:

- `src/lib/server/user/user.ts` — add `inventory` property, update constructor, add methods:
  - `getInventory(): (InventoryItem | null)[][]`
  - `findFirstFreeSlot(): { row: number, col: number } | null` — scans row-by-row, left-to-right
  - `addItemToInventory(item: InventoryItem): boolean` — adds to first free slot, returns false if full
  - `moveItem(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean` — swaps items (handles empty target as move, occupied target as swap)
  - `removeItem(row: number, col: number): InventoryItem | null` — removes and returns item

**Quality Requirements**: All mutation methods must validate bounds (0-9 for both row/col). Methods mutate the inventory in-place on the User object, relying on UserCache's dirty tracking and persistence mechanism.

##### Task 2.2.2: Commander Generation Logic

**Action**: Create a pure function to generate a random commander with stat bonuses.

**Files**:

- `src/lib/server/inventory/commanderFactory.ts` — new file with:
  - `generateCommander(): Commander` — creates a commander with:
    - UUID via `crypto.randomUUID()`
    - Random name from a predefined name list (space-themed names, ~30 entries)
    - 1-3 random stats: 60% chance of 1, 30% chance of 2, 10% chance of 3
    - Each stat: random `CommanderStatType` (no duplicates), random `bonusPercent` between 0.1 and 1.0 (rounded to 1 decimal)
  - `tryGenerateCommanderFromEscapePod(): Commander | null` — 90% chance returns `generateCommander()`, 10% returns null

**Quality Requirements**: Pure functions, easily testable. Use a seeded random or accept a random function parameter for testability.

##### Task 2.2.3: Update Escape Pod Collection Logic

**Action**: Modify `User.collected()` to handle escape pods: call commander generation, attempt to add to inventory.

**Files**:

- `src/lib/server/user/user.ts` — update the `escape_pod` case in `collected()`:
  1. Call `tryGenerateCommanderFromEscapePod()`
  2. If commander generated, call `this.addItemToInventory({ type: 'commander', data: commander })`
  3. Track result for return value (commander found + added, commander found + inventory full, no commander)
- Change `collected()` return type from `void` to a result object: `{ ironReward: number, collectedItem?: { type: string, name: string, added: boolean } }`
  - For asteroids/shipwrecks: just `{ ironReward }`
  - For escape_pods: `{ ironReward: 0, collectedItem: { type: 'commander', name, added } }` or `{ ironReward: 0 }` if no commander

**Note**: This changes the return type of `collected()`. The harvest API route must be updated to propagate this info to the client. After modifying the user's inventory, the method relies on the caller (harvest API) to mark the user as dirty via `userCache.updateUserInCache()`.

##### Task 2.2.4: Update Harvest API Response

**Action**: Update the harvest route to include item collection results in its response. The user is already being accessed through UserCache, and `updateUserInCache()` is already called, so inventory changes are automatically persisted.

**Files**:

- `src/app/api/harvest/route.ts` — capture the return value of `user.collected()`, include `collectedItem` in the JSON response if present
  - The existing pattern already uses `userCache.getUserByIdWithLock()` and `userCache.updateUserInCache()`, so inventory persistence is handled automatically

#### Sub-Goal 2.3: Inventory API Endpoint and UserCache Integration

**Description**: Create a dedicated `/api/inventory` endpoint for reading inventory and moving items. All operations must go through UserCache to ensure proper persistence.

##### Task 2.3.1: Update UserCache Persistence for Inventory

**Action**: Update the `persistUserToDb()` method in UserCache to include the inventory column in the UPDATE query. The inventory is JSON-serialized as part of the user's persistent state.

**Files**:

- `src/lib/server/user/userCache.ts` — update `persistUserToDb()` method:
  - Add `inventory = $25` to the UPDATE SET clause
  - Add `JSON.stringify(user.inventory)` to the parameters array (after `user.buildStartSec`)
  - Update the parameter index for `user.id` to `$26`

**Quality Requirements**: The inventory is automatically persisted when the user is marked dirty, following the existing write-behind cache pattern. No direct DB access for inventory updates.

##### Task 2.3.2: Create GET /api/inventory

**Action**: Return the authenticated user's inventory grid. Access inventory through UserCache's `getUserByIdWithLock()` which ensures the user is loaded from cache or DB and stats are updated.

**Files**:

- `src/app/api/inventory/route.ts` — new API route:
  - GET: Validate session → get UserCache instance → call `getUserByIdWithLock()` within USER_LOCK → return `{ inventory: user.getInventory() }`
  - Follow existing API patterns: `getIronSession`, `requireAuth`, `emptyCtx.useLockWithAcquire(USER_LOCK, ...)`, `handleApiError`
  - UserCache automatically handles dirty tracking and persistence

##### Task 2.3.3: Create POST /api/inventory/move

**Action**: Move/swap an inventory item between slots. After mutation, the user is marked dirty by `updateUserInCache()` and will be persisted by the cache.

**Files**:

- `src/app/api/inventory/move/route.ts` — new API route:
  - POST body: `{ fromRow, fromCol, toRow, toCol }`
  - Validate session → get UserCache instance → acquire USER_LOCK → get user via `getUserByIdWithLock()` → call `user.moveItem()` → call `userCache.updateUserInCache()` to mark dirty → return success/failure
  - Validate all coordinates are integers 0-9
  - UserCache handles persistence automatically (immediate in test mode, periodic in production)

---

### Goal 3: Client-Side Inventory UI

**Description**: Build the inventory grid component with drag-and-drop support and item detail display. Integrate into the Ship page above the existing ship selector.

#### Sub-Goal 3.1: Inventory Data Hook

##### Task 3.1.1: Create useInventory Hook

**Action**: Create a React hook that fetches and manages inventory state.

**Files**:

- `src/lib/client/hooks/useInventory.ts` — new hook:
  - Fetches `GET /api/inventory` on mount
  - Provides `inventory`, `isLoading`, `error`, `refetch`
  - Provides `moveItem(fromRow, fromCol, toRow, toCol)` that calls `POST /api/inventory/move` and updates local state optimistically
  - Provides `selectedSlot`, `setSelectedSlot` for item selection

#### Sub-Goal 3.2: Inventory Grid Component

##### Task 3.2.1: Create InventoryGrid Component

**Action**: Build the 10×10 inventory grid with HTML5 drag-and-drop support.

**Files**:

- `src/components/Inventory/InventoryGrid.tsx` — new component:
  - Props: `inventory: (InventoryItem | null)[][]`, `onMoveItem: (from, to) => void`, `selectedSlot: {row, col} | null`, `onSelectSlot: (row, col) => void`
  - Renders a 10×10 CSS grid of `InventorySlot` sub-components
  - Each slot:
    - Has `draggable` attribute if occupied
    - Implements `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd` handlers
    - Shows a placeholder rectangle image for occupied slots (colored differently per item type)
    - Shows an empty styled rectangle for empty slots
    - Click handler sets `selectedSlot`
    - Visual feedback: highlight on drag-over, selected state border
  - Responsive: grid cells size should adapt (min ~40px, max ~60px)

- `src/components/Inventory/InventoryGrid.css` — styles for the grid:
  - Grid layout: `display: grid; grid-template-columns: repeat(10, 1fr)`
  - Slot styling: border, background, drag-over highlight, selected highlight
  - Dark theme consistent with existing ship page styles (`#1a1a2e` backgrounds, `var(--primary-green)` accent)
  - Item placeholder: colored rectangle with small icon/label

##### Task 3.2.2: Create ItemDetails Component

**Action**: Build the detail panel that shows information about the selected inventory item.

**Files**:

- `src/components/Inventory/ItemDetails.tsx` — new component:
  - Props: `item: InventoryItem | null`
  - If null: show "Select an item to view details" placeholder
  - If commander: show:
    - Commander name (bold heading)
    - Type badge: "Commander"
    - List of stat bonuses with stat name and `+X.X%` formatted value
    - Stat names displayed as human-readable labels (e.g., "Ship Speed", "Projectile Damage")

- `src/components/Inventory/ItemDetails.css` — styles for the detail panel:
  - Card-style layout, dark theme consistent with rest of app
  - Stat list with colored indicators (green for positive bonuses)

##### Task 3.2.3: Create Inventory Section Wrapper

**Action**: Combine grid + details into a single section layout component.

**Files**:

- `src/components/Inventory/InventorySection.tsx` — new component:
  - Uses `useInventory` hook
  - Layout: Heading "Inventory" → two-column layout (grid on left/top, details on right/bottom)
  - Responsive: side-by-side on desktop, stacked on mobile
  - Shows loading state

- `src/components/Inventory/InventorySection.css` — layout styles

- `src/components/Inventory/index.ts` — barrel export

#### Sub-Goal 3.3: Integrate Inventory into Ship Page

##### Task 3.3.1: Add Inventory Section to Ship Page

**Action**: Import and render `InventorySection` above the existing ship selector in the Ship page.

**Files**:

- `src/app/ship/ShipPageClient.tsx` — add `<InventorySection />` as the first section inside the ship container, above the "Choose Your Ship" heading

---

### Goal 4: Testing

**Description**: Comprehensive tests for all new business logic. Follow the project's testing conventions: transaction isolation, descriptive naming, integration test patterns.

#### Task 4.1: Commander Generation Tests

**Action**: Unit tests for commander factory functions.

**Files**:

- `src/__tests__/lib/commanderFactory.test.ts` — new test file:
  - `generateCommander_always_returnsValidCommander` — verify UUID, name, 1-3 stats, stat values in range
  - `generateCommander_statDistribution_matchesProbabilities` — run 1000 generations, verify ~60/30/10 distribution (with tolerance)
  - `generateCommander_stats_noDuplicateStatTypes` — verify no commander has duplicate stat types
  - `tryGenerateCommanderFromEscapePod_over1000runs_approximately90percentYield` — statistical test

#### Task 4.2: Inventory Manipulation Tests

**Action**: Unit tests for User inventory methods.

**Files**:

- `src/__tests__/lib/inventory.test.ts` — new test file:
  - `findFirstFreeSlot_emptyInventory_returnsZeroZero`
  - `findFirstFreeSlot_firstRowFull_returnsSecondRowFirstCol`
  - `findFirstFreeSlot_allFull_returnsNull`
  - `addItemToInventory_emptyInventory_addsToFirstSlot`
  - `addItemToInventory_fullInventory_returnsFalse`
  - `moveItem_toEmptySlot_movesItem`
  - `moveItem_toOccupiedSlot_swapsItems`
  - `moveItem_outOfBounds_returnsFalse`
  - `removeItem_occupiedSlot_returnsItemAndClearsSlot`
  - `removeItem_emptySlot_returnsNull`

#### Task 4.3: Escape Pod Collection Integration Tests

**Action**: Integration tests for the updated harvest API with escape pod commander collection.

**Files**:

- `src/__tests__/api/collection-api.test.ts` — add new test cases (extend existing file):
  - `collectEscapePod_successfulCommander_addsToInventory`
  - `collectEscapePod_noCommander_inventoryUnchanged`
  - `collectEscapePod_inventoryFull_commanderLost`

#### Task 4.4: Inventory API Tests

**Action**: Integration tests for the new `/api/inventory` endpoints.

**Files**:

- `src/__tests__/api/inventory-api.test.ts` — new test file:
  - `getInventory_authenticatedUser_returnsInventoryGrid`
  - `getInventory_unauthenticated_returns401`
  - `moveItem_validMove_swapsSlots`
  - `moveItem_outOfBounds_returns400`
  - `moveItem_unauthenticated_returns401`

#### Task 4.5: Migration Test

**Action**: Verify the inventory migration applies correctly.

**Files**:

- `src/__tests__/lib/inventory.test.ts` — add case or separate file:
  - `inventoryMigration_appliedToExistingDb_addsColumnSuccessfully` (optional — migration functions are already pattern-proven)

---

### Goal 5: Update Collection Notification

**Description**: When an escape pod is collected, include commander information in the notification message sent to the player.

#### Task 5.1: Update Collection Message

**Action**: Modify the harvest notification to include commander collection result.

**Files**:

- `src/app/api/harvest/route.ts` — update the message sent via `MessageCache`:
  - If commander found + added: "Escape pod collected! Commander {name} rescued and added to inventory."
  - If commander found + inventory full: "Escape pod collected! Commander {name} rescued but inventory is full — commander lost!"
  - If no commander: "Escape pod collected. No survivors found."

---

## Dependencies

- No new npm packages required (HTML5 Drag-and-Drop is native, `crypto.randomUUID()` is available in Node.js)

## Arc42 Documentation Updates

**Proposed Changes**:

- Update `doc/architecture/arc42-architecture.md` section on data model / building blocks to document the inventory system as a new sub-component of the User domain
- Add inventory to the cache flow description (inventory data flows through existing UserCache as part of the User object)

## Architecture Notes

- **Storage pattern**: Inventory is stored as a JSON TEXT column on the users table, consistent with `build_queue` and `tech_tree`. The 10×10 grid is serialized as a 2D array of nullable `InventoryItem` objects. This keeps everything within the existing `UserCache` write-behind persistence — no new cache needed.

- **Cache integration**: All inventory access follows the existing UserCache pattern:
  1. API routes acquire USER_LOCK and call `userCache.getUserByIdWithLock()`
  2. User domain methods mutate the inventory in-place
  3. API routes call `userCache.updateUserInCache()` to mark the user dirty
  4. UserCache automatically persists dirty users via `persistUserToDb()`:
     - Immediately in test mode (within transaction scope)
     - Periodically in production (30-second intervals)
  5. No direct database access for inventory — all goes through the cache

- **Lock ordering**: All inventory operations happen under `USER_LOCK` (level 4), consistent with other user mutations. No new lock levels needed.

- **Extensibility**: The `InventoryItem` type uses a discriminated union (`type` field). Future item types (weapons, modules, resources) add new variants without changing the grid or persistence logic.

- **Commander IDs**: Each commander gets a `crypto.randomUUID()` for unique identification, enabling future features (equipping, trading).

- **Return type change**: `User.collected()` changes from `void` to a result object. This is a breaking change for callers — the harvest API route is the only caller and will be updated simultaneously.

- **Drag-and-drop**: Uses HTML5 native API. The `dataTransfer` object carries `row,col` as text. Drop handler calls the move API and optimistically updates local state.

## Agent Decisions

1. **JSON column over separate table**: Chosen for simplicity and consistency with existing patterns (`build_queue`, `tech_tree`). A 10×10 grid with commanders (each ~200 bytes JSON) fits comfortably in a TEXT column. The inventory is always loaded/saved with the user, so no lazy loading needed. If inventory grows beyond ~100 items or complex queries are needed, this can be migrated to a table later.

2. **2D array over flat array with position**: A 10×10 2D array (`(InventoryItem | null)[][]`) directly models the grid. It's simpler to index (`inventory[row][col]`) and maps naturally to the UI grid. A flat array with `{row, col, item}` objects would need search operations.

3. **Inventory on User class (not separate service)**: Inventory is tightly coupled to the user — it's loaded with the user, saved with the user, and mutated during user operations (collection). A separate `InventoryService` would add indirection without benefit at this scale. Methods like `addItemToInventory()` and `moveItem()` belong on the User domain object.

4. **Commander name generation**: Using a predefined list of space-themed names rather than procedural generation. Simpler, more characterful, and avoids nonsensical outputs. ~30 names gives enough variety for early gameplay.

5. **Statistical tests with tolerance**: Commander generation probabilities (90% drop rate, 60/30/10 stat distribution) are tested statistically over 1000 runs with ±5% tolerance bands. This avoids flaky tests while still validating the distribution.

6. **Optimistic UI updates for drag-and-drop**: The `moveItem` function updates local state immediately and calls the API in the background. If the API call fails, it reverts. This provides instant visual feedback for drag operations.


