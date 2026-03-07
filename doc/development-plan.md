# Development Plan: Starbase Feature

## Vision

As a player, I can discover hardcoded Starbases on the game canvas, click on them while in Attack Mode to dock, and open a shop where I can sell Commanders from my inventory or buy one of 10 randomly generated Commanders — paying and receiving Iron based on each Commander's total bonus value.

---

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL (no new tables — Starbases are hardcoded; shop state lives in iron-session)
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively (`import`/`export` only)

## Project Structure

- `src/app/starbase/` — new Starbase page (Server Component + Client Component)
- `src/app/api/starbase/` — new API routes (shop, buy, sell)
- `src/lib/client/renderers/StarbaseRenderer.ts` — new renderer
- `src/lib/client/game/Starbase.ts` — hardcoded starbase definitions (positions, IDs)
- `src/shared/src/types/gameTypes.ts` — extend SpaceObject type union
- `src/lib/server/session.ts` — extend SessionData with starbase shop state
- `public/assets/images/station1.png` — new image asset (**already added to repo**)

---

## Goals

### Goal 1: Extend SpaceObject Model and Rendering for Starbases

**Description**: Add `'starbase'` as a recognized object type, create a dedicated renderer that draws it at 5× the standard size, and wire it into the existing `SpaceObjectsRenderer` dispatch.

**Quality Requirements**: The renderer must follow the existing `SpaceObjectRendererBase` template-method pattern so wrapping and hover detection are inherited for free.

#### Task 1.1: Add 'starbase' to the SpaceObject type union

**Action**: In `src/shared/src/types/gameTypes.ts`, add `'starbase'` to `SpaceObject['type']`. Add a `Starbase` interface extending `SpaceObject` with `type: 'starbase'` (no extra fields needed). Update any exhaustive `switch`/`if-else` chains in the codebase that already narrow on `SpaceObject['type']` to either handle `'starbase'` or add a compile-time exhaustiveness check.

**Files**:

- `src/shared/src/types/gameTypes.ts` — add union member + `Starbase` interface

**Quality Requirements**: TypeScript strict mode must compile without errors after this change.

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `'starbase'` to the `SpaceObject['type']` union and added a `StarbaseObject` interface extending `SpaceObject` with `type: 'starbase'`. Verified no exhaustive switch/if-else chains were broken (the only switch in `World.ts` has a `default` case).
**Files Modified/Created**:
- `src/shared/src/types/gameTypes.ts` — Added `'starbase'` to type union and added `StarbaseObject` interface
**Deviations from Plan**: Used `StarbaseObject` as the interface name (as specified in the task details) rather than `Starbase` (as named in the Action text) to avoid potential naming conflicts with future `Starbase.ts` module.
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing (61 pre-existing failures unrelated to this change, 639 passing), no new failures introduced

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Core change is correct — `'starbase'` correctly added to the shared type union and `StarbaseObject` interface properly declares the discriminant. No exhaustive switch chains are broken (client `World.ts` default case handles unknown types gracefully; server `user.ts` default case is similarly safe). Server-side `world.ts` SpaceObject was intentionally not updated, which is correct per the plan (starbases are hardcoded and never stored in DB). Arc42 update correctly omitted. Minor note: the `StarbaseObject` name deviates from the existing convention (`Asteroid`, `Shipwreck`, `EscapePod`) where shared interface names match their future client-class names — the rationale (avoiding naming conflicts) is questionable since the existing pattern already co-locates same-named interfaces and classes (e.g., `EscapePod` interface + `EscapePod` class, aliased on import as `SharedEscapePod`). The deviation is documented and does not affect correctness; future tasks should be aware they will import `StarbaseObject` rather than `Starbase` from gameTypes.

#### Task 1.2: Add starbase image asset

**Action**: The image `public/assets/images/station1.png` has already been added to the repository. Document the path in a comment inside `StarbaseRenderer.ts`.

**Files**:

- `public/assets/images/station1.png` — already present in repo (no action needed)

#### Task 1.3: Create StarbaseRenderer

**Action**: Create `src/lib/client/renderers/StarbaseRenderer.ts` extending `SpaceObjectRendererBase`. Override:

- `getObjectImage()` → load/return the `station1.png` image at `/assets/images/station1.png` (same lazy-load pattern as `OtherShipRenderer`)
- `getObjectSize()` → return `5 * BASE_OBJECT_SIZE` (where `BASE_OBJECT_SIZE` matches the value used by other renderers, e.g. `50`)
- `getFallbackColor()` → return a distinct color (e.g. `'#4488ff'`) for when the image is not yet loaded
- `getImageRotationOffset()` → `0` (no rotation offset needed for a station)

Add a public method `drawStarbase(ctx, centerX, centerY, shipX, shipY, obj: SpaceObject): void` that delegates to `this.drawSpaceObject(...)`.

**Files**:

- `src/lib/client/renderers/StarbaseRenderer.ts` — new file

**Status**: ✅ COMPLETED
**Implementation Summary**: Created `StarbaseRenderer.ts` extending `SpaceObjectRendererBase` with lazy-loaded station image, 5× base object size (250px), blue fallback color, zero rotation offset, and a `drawStarbase()` public method delegating to `drawSpaceObject()`.
**Files Modified/Created**:
- `src/lib/client/renderers/StarbaseRenderer.ts` — new renderer file
**Deviations from Plan**: None. Used `imageLoaded` boolean flag (simpler than OtherShipRenderer's Map-based pattern since there's only one image).
**Arc42 Updates**: None required
**Test Results**: ✅ Build passes, 639 tests passing, 61 pre-existing failures unrelated to this change, no new failures introduced

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Implementation is correct and architecturally consistent. One minor observation: the `imageLoaded` boolean flag in `getObjectImage()` is redundant — `SpaceObjectRendererBase` already guards against unloaded images via `image.complete && image.naturalHeight !== 0` (lines 114 and 181 of the base class), which is exactly the pattern used by `AsteroidRenderer`, `EscapePodRenderer`, and `ShipwreckRenderer`. Returning `this.stationImage` directly (without the flag) would be simpler and more consistent with those three renderers. The Knight acknowledged this as a conscious deviation for clarity, and it is functionally equivalent, so approval stands. The `BASE_OBJECT_SIZE` local constant, `drawStarbase()` delegation pattern, fallback color, and zero rotation offset all correctly follow the established renderer conventions.

#### Task 1.4: Register StarbaseRenderer in SpaceObjectsRenderer

**Action**: In `src/lib/client/renderers/SpaceObjectsRenderer.ts`:

1. Import and instantiate `StarbaseRenderer` alongside the other renderers.
2. Add an `else if (collectible.type === 'starbase')` branch in `renderObject()` that calls `this.starbaseRenderer.drawStarbase(...)`.

**Files**:

- `src/lib/client/renderers/SpaceObjectsRenderer.ts` — add import, field, dispatch branch

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `StarbaseRenderer` import, private field, and constructor instantiation to `SpaceObjectsRenderer`, and wired a new `else if (collectible.type === 'starbase')` dispatch branch in `renderObject()` that delegates to `this.starbaseRenderer.drawStarbase(...)`.
**Files Modified/Created**:
- `src/lib/client/renderers/SpaceObjectsRenderer.ts` — added import, `starbaseRenderer` field, constructor instantiation, and dispatch branch
- `src/__tests__/unit/renderers/SpaceObjectsRenderer.test.ts` — new test file covering all 5 renderer dispatch paths including starbase
**Deviations from Plan**: None.
**Arc42 Updates**: None required
**Test Results**: ✅ 647 tests passing (8 new), 57 test files passing (1 new), 61 pre-existing integration failures (no DB), no linting errors

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Implementation is a minimal, correct extension of the existing dispatcher pattern. Import, field, constructor instantiation, and dispatch branch all match the established conventions exactly. The new test file is thorough — mocking all five sub-renderers and asserting dispatch-level behavior (not just coverage): it covers constructor instantiation, all five dispatch paths, a meaningful negative case (non-starbase type doesn't trigger starbaseRenderer), and a multi-type rendering scenario. No Arc42 update required or needed. No code duplication, no design issues.

---

### Goal 2: Expose Hardcoded Starbases via the World API

**Description**: Starbases are hardcoded (not stored in the DB). The `/api/world` route appends static starbase objects to the response so the client's `World` class treats them like any other `SpaceObject` — enabling hover detection and rendering without special-casing.

**Quality Requirements**: Starbase IDs must never collide with auto-incremented DB IDs. Use a constant offset (e.g. `STARBASE_ID_OFFSET = 9000`).

#### Task 2.1: Define hardcoded Starbase constants

**Action**: Create `src/lib/client/game/Starbase.ts` with an exported `STARBASES` constant — an array of `SpaceObject` records with `type: 'starbase'`, fixed positions, `speed: 0`, `angle: 0`, and IDs starting at `9001`. Start with a single starbase at approximately (2500, 2500) (center of the 5000×5000 world). This file is imported by both the server route and the client, so it must live in `src/shared/` rather than `src/lib/client/` to avoid a client-only import from a server route.

**Decision**: Place in `src/shared/starbases.ts` so it can be imported from `src/app/api/world/route.ts` (server) and from `src/lib/client/game/World.ts` (client) without bundling client-only code into server routes. Export `STARBASE_DOCK_RANGE = 500` from this file as well, so both `Game.ts` and any future server-side range checks share the same constant.

**Files**:

- `src/shared/starbases.ts` — new file with `STARBASES: StarbaseObject[]` constant and `STARBASE_DOCK_RANGE = 500`

**Content**: One Starbase at world position (2500, 2500), `id: 9001`, `type: 'starbase'`, `speed: 0`, `angle: 0`, `picture_id: 1`.

**Status**: ✅ COMPLETED
**Implementation Summary**: Created `src/shared/starbases.ts` with `STARBASE_ID_OFFSET`, `STARBASE_DOCK_RANGE`, and `STARBASES` array containing one starbase at (2500, 2500).
**Files Modified/Created**:
- `src/shared/starbases.ts` — new file with `STARBASES: StarbaseObject[]` constant, `STARBASE_DOCK_RANGE = 500`, and `STARBASE_ID_OFFSET = 9000`
**Deviations from Plan**: Used `@shared/types/gameTypes` import alias (consistent with codebase conventions). Added `last_position_update_ms: 0` required by the `SpaceObject` interface. The proposed code in the task used a wrong import path (`'./src/types/gameTypes'`) — corrected to use the project's `@shared/` alias.
**Arc42 Updates**: None required
**Test Results**: ✅ TypeScript compilation passes (`npx tsc --noEmit`)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Revision applied correctly — `id: STARBASE_ID_OFFSET + 1` now structurally enforces the no-collision invariant. All required exports (`STARBASE_ID_OFFSET`, `STARBASE_DOCK_RANGE`, `STARBASES`) are present, the `StarbaseObject[]` type annotation is correct, and the import alias follows codebase conventions. Implementation meets all requirements.

#### Task 2.2: Append hardcoded starbases to /api/world response

**Action**: In `src/app/api/world/route.ts`, after fetching the live world data from `WorldCache`, append the entries from `STARBASES` to the `spaceObjects` array before returning the JSON response.

**Files**:

- `src/app/api/world/route.ts` — import `STARBASES` and append them to the response

---

### Goal 3: Enable Starbase Interaction from the Game Canvas

**Description**: When the player is in Attack Mode and clicks on a Starbase object, the game navigates to the `/starbase` page instead of initiating a battle. Outside Attack Mode, clicking a Starbase does nothing.

**Quality Requirements**: The interaction hook must follow the same callback-injection pattern as `setTeleportClickCallback` and `setAttackSuccessCallback` so `Game.ts` remains decoupled from React routing.

#### Task 3.1: Add Starbase entry callback to Game.ts

**Action**: In `src/lib/client/game/Game.ts`:

1. Add a private field `private onStarbaseEntryCallback: ((starbaseId: number) => void) | null = null`.
2. Add a public method `setStarbaseEntryCallback(fn: (starbaseId: number) => void): void`.
3. In `initializeClickHandler()`, after the existing player-ship attack branch, add a branch:
   ```
   if hoveredObject.type === 'starbase' && attackClickMode:
     const dist = toroidalDistance(ship, hoveredObject, World.WIDTH, World.HEIGHT)
     if dist <= 500:
       this.onStarbaseEntryCallback?.(hoveredObject.id)
     else:
       handleInterception(hoveredObject)   // fly toward it first
   ```
   This branch must be checked before the generic empty-space click fallthrough. The `500` distance constant should be defined as `STARBASE_DOCK_RANGE = 500` in `src/shared/starbases.ts`.

**Files**:

- `src/lib/client/game/Game.ts` — new field, method, and click handler branch

#### Task 3.2: Wire starbase entry callback in GamePageClient

**Action**: In `src/app/game/GamePageClient.tsx`:

1. Create a `handleStarbaseEntry` callback (with `useCallback`) that calls `router.push('/starbase')`.
2. In the `useEffect` that wires world data to the game instance, also call `gameInstanceRef.current.setStarbaseEntryCallback?.(handleStarbaseEntry)`.

**Files**:

- `src/app/game/GamePageClient.tsx` — new callback and wiring in the world-data useEffect

---

### Goal 4: Starbase Shop API

**Description**: Three new API routes handle the shop: fetch the shop's 10 random Commanders (generating fresh ones on each call), buy a Commander from the shop (slot-indexed, deducts Iron, adds to inventory), and sell a Commander from inventory (adds Iron, removes from inventory).

**Quality Requirements**: Buy/sell operations must be atomic and lock-safe. Sell-price and buy-price formulas must be implemented in a single shared helper function to avoid divergence. Shop state is stored in the iron-session so buy requests are validated server-side against the generated shop.

#### Task 4.1: Create price calculation utility

**Action**: Create `src/lib/server/starbase/commanderPrice.ts` exporting:

- `commanderSellPrice(commander: CommanderData): number` → `Math.round(totalBonusValue / 0.1) * 100`  
  where `totalBonusValue = sum of all statBonuses[i].value`
- `commanderBuyPrice(commander: CommanderData): number` → `Math.round(totalBonusValue / 0.1) * 500`

These are pure functions with no I/O — unit-testable directly.

**Files**:

- `src/lib/server/starbase/commanderPrice.ts` — new file

#### Task 4.2: Extend SessionData with starbase shop state

**Action**: In `src/lib/server/session.ts`, extend the `SessionData` interface with `starbaseShop?: CommanderData[]`. Import `CommanderData` from the shared Commander module.

**Files**:

- `src/lib/server/session.ts` — add optional `starbaseShop` field to `SessionData`

#### Task 4.3: Create GET /api/starbase/shop

**Action**: Create `src/app/api/starbase/shop/route.ts`. On each GET:

1. Authenticate with `getIronSession()` and `requireAuth()`.
2. Generate 10 commanders using `Commander.random()`.
3. Store them in `session.starbaseShop` and call `session.save()`.
4. Return `{ commanders: CommanderData[] }`.

This re-rolls on every visit (no caching), matching the spec.

**Files**:

- `src/app/api/starbase/shop/route.ts` — new file

#### Task 4.4: Create POST /api/starbase/buy-commander

**Action**: Create `src/app/api/starbase/buy/route.ts`. On POST `{ slotIndex: number }`:

1. Authenticate and load session.
2. Validate `slotIndex` is 0–9 and `session.starbaseShop` exists.
3. Get the `CommanderData` for that slot.
4. Compute `price = commanderBuyPrice(commander)`.
5. Acquire USER_LOCK, then USER_INVENTORY_LOCK in order.
6. Verify user has enough Iron (`user.iron >= price`); return 400 if not.
7. Deduct Iron from user (call `user.updateStats(now, bonuses)` first to apply accrual, then subtract).
8. Add the Commander to the user's inventory via `InventoryService.addItem(userId, commander)`.
9. Save user (dirty flag) and release locks.
10. Return `{ success: true, newIron: number }`.

**Files**:

- `src/app/api/starbase/buy/route.ts` — new file

**Inputs**: `session.starbaseShop` (set by Task 4.3)

#### Task 4.5: Create POST /api/starbase/sell-commander

**Action**: Create `src/app/api/starbase/sell/route.ts`. On POST `{ row: number, col: number }`:

1. Authenticate.
2. Acquire USER_INVENTORY_LOCK and retrieve the item at `(row, col)`.
3. Validate it is a Commander (`item.itemType === 'commander'`).
4. Compute `price = commanderSellPrice(commander)`.
5. Remove the Commander from inventory via `InventoryService.removeItem(userId, row, col)`.
6. Acquire USER_LOCK and add Iron to user.
7. Return `{ success: true, newIron: number, ironEarned: number }`.

**Lock order**: Acquire USER_LOCK (4) first, then USER_INVENTORY_LOCK (5) — respecting the ascending lock hierarchy. Both locks are held for the duration of the route handler: read item, validate it's a Commander, remove from inventory, then add Iron to user. Release both in finally block.

**Files**:

- `src/app/api/starbase/sell/route.ts` — new file

---

### Goal 5: Starbase Frontend Page

**Description**: A new `/starbase` page (not linked in the Navigation menu) with two panels: a "Sell" panel listing the player's inventory Commanders with sell prices and a "Buy" panel showing the 10 shop Commanders. Layout mirrors the Ship page's Inventory section style.

**Quality Requirements**: The page must redirect unauthenticated users to `/login` via `requireAuth()`. It must provide a "Return to Game" button. The Buy panel must reflect real-time Iron balance after transactions.

#### Task 5.1: Create Starbase page route (Server Component)

**Action**: Create `src/app/starbase/page.tsx` as a Next.js async Server Component. Call `requireAuth()` to protect the route. Pass `auth: ServerAuthState` to the `StarbasePageClient`.

**Files**:

- `src/app/starbase/page.tsx` — new file

#### Task 5.2: Create StarbasePageClient (Client Component)

**Action**: Create `src/app/starbase/StarbasePageClient.tsx` as a `'use client'` React component. It should:

1. On mount, `GET /api/starbase/shop` to load the 10 shop Commanders and `GET /api/inventory` to load the player's current inventory Commanders.
2. Display current Iron balance (from `GET /api/user-stats`).
3. Render the **Sell Panel**: list all Commander items from inventory with name, bonus stats, computed sell price, and a "Sell" button. On sell: `POST /api/starbase/sell`, then refresh inventory and Iron balance.
4. Render the **Buy Panel**: list 10 shop Commanders with name, bonus stats, computed buy price, and a "Buy" button (disabled if insufficient Iron or if inventory is full). On buy: `POST /api/starbase/buy`, then refresh inventory and Iron balance.
5. Show a "Return to Game" button that calls `router.push('/game')`.
6. Display a status message (success/error, auto-cleared after 3 seconds) — same pattern as `ShipPageClient`.

**Files**:

- `src/app/starbase/StarbasePageClient.tsx` — new file
- `src/app/starbase/StarbasePage.css` — new CSS file for page layout

#### Task 5.3: Create CommanderCard component

**Action**: Create `src/components/Starbase/CommanderCard.tsx` as a reusable component for displaying a single Commander in both panels. Props: `commander: CommanderData`, `price: number`, `actionLabel: string`, `onAction: () => void`, `disabled?: boolean`. Shows: commander name, portrait image (from `imageId`), each stat bonus as a labeled row, and the price + action button.

**Files**:

- `src/components/Starbase/CommanderCard.tsx` — new file
- `src/components/Starbase/CommanderCard.css` — new CSS file

#### Task 5.4: Expose iron balance from sell/buy responses

**Action**: Both `/api/starbase/sell` and `/api/starbase/buy` must return `newIron` in their response. `StarbasePageClient` uses this to update the displayed Iron balance optimistically without a separate `GET /api/user-stats` round-trip after each transaction.

**Files**: Already covered by Tasks 4.4 and 4.5 response shapes.

---

### Goal 6: Tests

**Description**: Cover all new business logic with appropriate tests following the test pyramid (unit > integration > UI).

#### Task 6.1: Unit tests for price calculation

**Action**: Create `src/__tests__/unit/lib/commanderPrice.test.ts`. Test cases:

- `commanderSellPrice_singleBonus0.1_returns100`
- `commanderSellPrice_threeBonus0.2each_returns600`
- `commanderBuyPrice_singleBonus0.1_returns500`
- `commanderBuyPrice_threeBonus0.2each_returns3000`

**Files**:

- `src/__tests__/unit/lib/commanderPrice.test.ts` — new file

#### Task 6.2: Unit tests for shop route (auth guard)

**Action**: Create `src/__tests__/unit/api/starbase.test.ts`. Use `createMockSessionCookie` and `createRequest` helpers to test the early-exit paths of all three routes (missing auth, invalid slot index, etc.) without touching the DB.

**Files**:

- `src/__tests__/unit/api/starbase.test.ts` — new file

#### Task 6.3: Integration tests for buy and sell flows

**Action**: Create `src/__tests__/integration/api/starbase-shop.test.ts`. Cover:

- `buyCommander_sufficientIron_deductsIronAndAddsToInventory`
- `buyCommander_insufficientIron_returns400AndNoChange`
- `buyCommander_invalidSlotIndex_returns400`
- `sellCommander_commanderInInventory_addsIronAndRemovesItem`
- `sellCommander_emptySlot_returns400`

Each test uses `withTransaction()` for rollback isolation.

**Files**:

- `src/__tests__/integration/api/starbase-shop.test.ts` — new file

#### Task 6.4: Unit tests for StarbaseRenderer

**Action**: Create `src/__tests__/unit/renderers/StarbaseRenderer.test.ts`. Verify:

- `getObjectSize_returnsBaseSizeMultiplied5x`
- `getFallbackColor_returnsExpectedHex`
- Renderer instantiates and exposes `drawStarbase` method

**Files**:

- `src/__tests__/unit/renderers/StarbaseRenderer.test.ts` — new file

---

## Dependencies

No new npm packages required. All functionality uses existing packages: iron-session (session storage), existing Commander/InventoryService, existing lock infrastructure.

---

## Arc42 Documentation Updates

**Proposed Changes**:

- Update `doc/architecture/arc42-architecture.md` Section 8 (Concepts) to document the Starbase as a hardcoded, non-persisted world object appended to the world API response.
- No new architectural patterns introduced — this reuses the existing click-callback injection pattern, inventory service, lock hierarchy, and renderer base class.

---

## Architecture Notes

### Hardcoded Starbase Pattern

Starbases do not live in the DB. They are defined in `src/shared/starbases.ts` as static `SpaceObject` records. The `/api/world` route appends them to every world response. IDs start at `9001` (well above auto-increment DB IDs) to prevent collisions. Client-side, they behave identically to DB objects for rendering and hover detection.

### Lock Order for Sell

The sell flow must NOT acquire USER_INVENTORY_LOCK (5) and then USER_LOCK (4) — that violates the ascending lock hierarchy (4 must come before 5). Instead, acquire USER_LOCK first, then USER_INVENTORY_LOCK, perform both the inventory removal and the iron update within that scope, then release in reverse order.

### Shop State in Session

The 10 shop Commanders are stored in the iron-session cookie after `GET /api/starbase/shop`. This prevents a client from submitting fabricated CommanderData in a buy request — the server always resolves the Commander from its own session-stored shop list. The session payload size increase is small (≈ 1–2 KB for 10 Commander JSON objects).

### Starbase Interaction in Attack Mode

Clicking a Starbase in Attack Mode checks the toroidal distance between the player's ship and the Starbase. If within **500 world units** (`STARBASE_DOCK_RANGE`), the `onStarbaseEntryCallback` is fired and the player navigates to `/starbase`. If outside range, `handleInterception()` is called so the ship flies toward the Starbase — the same behavior as clicking a distant collectible. The `setStarbaseEntryCallback` pattern mirrors `setTeleportClickCallback`.

### Commander Portrait Images

`CommanderCard` uses `imageId` (0–17) to reference portrait images at `public/assets/images/commander/` — the same path pattern used by the existing Ship page inventory UI.

---

## Agent Decisions

1. **Starbases in `src/shared/starbases.ts` (not `src/lib/client/`)**: Since `/api/world/route.ts` (server) needs to import the starbase definitions, they cannot live under `src/lib/client/`. Placing them in `src/shared/` makes them importable from both server and client code.

2. **Session-based shop state over deterministic seeding**: Storing shop Commanders in the session is simpler and more flexible than a seeded RNG approach. The 10 Commanders are re-generated on each `GET /api/starbase/shop` call. Client re-entry re-rolls the shop.

3. **500-unit dock range with interception fallback**: If the player is outside 500 world units when clicking a Starbase in Attack Mode, `handleInterception()` is called — consistent with how distant collectibles and player-ships behave.

4. **Full page navigation to `/starbase` (not a modal)**: Consistent with the existing full-page pattern (e.g. `/game` → `/` after attack). A separate page is simpler to implement, authenticate, and test than a canvas overlay.

5. **`STARBASE_ID_OFFSET = 9000`**: Provides ample headroom above DB auto-increment IDs. Could be increased if needed.

6. **Sell lock order**: USER_LOCK (4) acquired first, then USER_INVENTORY_LOCK (5), in the sell route handler — respects the ascending lock hierarchy. Both operations (inventory removal + iron credit) execute within the same combined lock scope.

7. **Image asset `station1.png`**: Already added to `public/assets/images/station1.png` by the user. Renderer references this path directly.

---

## Resolved Decisions

1. **Starbase entry distance**: **500 world units**. Outside range → `handleInterception()` (fly toward it). Inside range → navigate to `/starbase`.
2. **Number of Starbases**: **One**, at world center (2500, 2500).
3. **Sell lock order**: Route acquires **USER_LOCK (4) then USER_INVENTORY_LOCK (5)** in the correct ascending order. Both held for the full remove+iron-credit operation.
4. **Image asset**: `public/assets/images/station1.png` — already added to the repository.
