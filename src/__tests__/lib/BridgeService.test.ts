// ---
// Tests for InventoryService bridge functionality – uses a mock InventoryRepo (no DB required)
// ---

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '@/lib/server/inventory/InventoryService';
import { InventoryRepo } from '@/lib/server/inventory/InventoryRepo';
import {
  createEmptyInventoryGrid,
  createEmptyBridgeGrid,
  InventoryGrid,
  BridgeGrid,
  BRIDGE_COLS,
  getBridgeRows,
} from '@/lib/server/inventory/inventoryTypes';
import {
  BridgeSlotOccupiedError,
  BridgeSlotEmptyError,
  BridgeSlotInvalidError,
  BridgeFullError,
  InventorySlotEmptyError,
  InventorySlotInvalidError,
  InventorySlotOccupiedError,
} from '@/lib/server/inventory/InventoryService';
import { Commander } from '@/lib/server/inventory/Commander';

// ---------------------------------------------------------------------------
// Mock repo factory (supports both inventory and bridge)
// ---------------------------------------------------------------------------

function makeMockRepo(initialInventory?: InventoryGrid, initialBridge?: BridgeGrid) {
  let storedInventory: InventoryGrid | null = initialInventory ?? null;
  let storedBridge: BridgeGrid | null = initialBridge ?? null;

  const repo = {
    getInventory: vi.fn(async () => storedInventory),
    saveInventory: vi.fn(async (...args: unknown[]) => {
      storedInventory = args[2] as InventoryGrid;
    }),
    getBridge: vi.fn(async () => storedBridge),
    saveBridge: vi.fn(async (...args: unknown[]) => {
      storedBridge = args[2] as BridgeGrid;
    }),
    deleteInventory: vi.fn(async () => {}),
    _getStoredInventory: () => storedInventory,
    _getStoredBridge: () => storedBridge,
  } as unknown as InventoryRepo & {
    _getStoredInventory: () => InventoryGrid | null;
    _getStoredBridge: () => BridgeGrid | null;
  };

  return repo;
}

function makeCommander(name = 'Test Commander') {
  return Commander.withStats(name, [{ stat: 'shipSpeed', value: 0.5 }]).toJSON();
}

const USER_ID = 42;
/** 1 level = 4 bridge slots = 1 row */
const MAX_BRIDGE_SLOTS_1 = 4;
/** 2 levels = 8 bridge slots = 2 rows */
const MAX_BRIDGE_SLOTS_2 = 8;

const MAX_INVENTORY_SLOTS = 16;

const BRIDGE_SLOT_0_0 = { row: 0, col: 0 };
const BRIDGE_SLOT_0_1 = { row: 0, col: 1 };
const BRIDGE_SLOT_0_3 = { row: 0, col: 3 };
const INV_SLOT_0_0 = { row: 0, col: 0 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InventoryService – Bridge', () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: InventoryService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new InventoryService(repo);
  });

  // -------------------------------------------------------------------------
  // getBridge
  // -------------------------------------------------------------------------

  describe('getBridge', () => {
    test('getBridge_zeroSlots_returnsEmptyArray', async () => {
      const grid = await service.getBridge(USER_ID, 0);
      expect(grid).toHaveLength(0);
    });

    test('getBridge_noExistingRow_returnsEmptyGridAndPersists', async () => {
      const grid = await service.getBridge(USER_ID, MAX_BRIDGE_SLOTS_1);

      const expectedRows = getBridgeRows(MAX_BRIDGE_SLOTS_1); // 1
      expect(grid).toHaveLength(expectedRows);
      expect(grid[0]).toHaveLength(BRIDGE_COLS); // 4
      expect(grid[0][0]).toBeNull();
      expect(repo.saveBridge).toHaveBeenCalledOnce();
    });

    test('getBridge_existingRow_returnsStoredGrid', async () => {
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_2);
      existing[0][2] = makeCommander('Zara');
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      const grid = await service.getBridge(USER_ID, MAX_BRIDGE_SLOTS_2);

      expect(grid[0][2]).not.toBeNull();
      expect(grid[0][2]!.name).toBe('Zara');
      expect(repo.saveBridge).not.toHaveBeenCalled();
    });

    test('getBridge_existingGridSmaller_expandsAndPersists', async () => {
      // Start with 1-row bridge, then grow to 2 rows
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      existing[0][0] = makeCommander('Old');
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      const grid = await service.getBridge(USER_ID, MAX_BRIDGE_SLOTS_2);

      expect(grid).toHaveLength(2);
      expect(grid[0][0]?.name).toBe('Old');
      expect(grid[1][0]).toBeNull();
      expect(repo.saveBridge).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // addItemToBridgeSlot
  // -------------------------------------------------------------------------

  describe('addItemToBridgeSlot', () => {
    test('addItemToBridgeSlot_emptySlot_placesItemAndSaves', async () => {
      const item = makeCommander();
      await service.addItemToBridgeSlot(USER_ID, item, BRIDGE_SLOT_0_0, MAX_BRIDGE_SLOTS_1);

      const stored = repo._getStoredBridge();
      expect(stored![0][0]).toEqual(item);
      expect(repo.saveBridge).toHaveBeenCalledOnce();
    });

    test('addItemToBridgeSlot_occupiedSlot_throwsBridgeSlotOccupiedError', async () => {
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      existing[0][0] = makeCommander('First');
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      await expect(
        service.addItemToBridgeSlot(USER_ID, makeCommander('Second'), BRIDGE_SLOT_0_0, MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeSlotOccupiedError);
    });

    test('addItemToBridgeSlot_invalidSlot_throwsBridgeSlotInvalidError', async () => {
      // col 4 is out of bounds for BRIDGE_COLS=4 (valid: 0-3)
      await expect(
        service.addItemToBridgeSlot(USER_ID, makeCommander(), { row: 0, col: 4 }, MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeSlotInvalidError);
    });

    test('addItemToBridgeSlot_slotBeyondMaxSlots_throwsBridgeSlotInvalidError', async () => {
      // row 1 doesn't exist at level 1 (only 1 row)
      await expect(
        service.addItemToBridgeSlot(USER_ID, makeCommander(), { row: 1, col: 0 }, MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeSlotInvalidError);
    });
  });

  // -------------------------------------------------------------------------
  // addItemToBridgeFirstFreeSlot
  // -------------------------------------------------------------------------

  describe('addItemToBridgeFirstFreeSlot', () => {
    test('addItemToBridgeFirstFreeSlot_emptyBridge_placesAtFirstSlot', async () => {
      const item = makeCommander('Alice');
      const placed = await service.addItemToBridgeFirstFreeSlot(USER_ID, item, MAX_BRIDGE_SLOTS_1);

      expect(placed).toEqual(BRIDGE_SLOT_0_0);
      expect(repo._getStoredBridge()![0][0]).toEqual(item);
    });

    test('addItemToBridgeFirstFreeSlot_firstSlotOccupied_placesAtSecondSlot', async () => {
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      existing[0][0] = makeCommander('First');
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      const placed = await service.addItemToBridgeFirstFreeSlot(USER_ID, makeCommander('Second'), MAX_BRIDGE_SLOTS_1);
      expect(placed).toEqual(BRIDGE_SLOT_0_1);
    });

    test('addItemToBridgeFirstFreeSlot_bridgeFull_throwsBridgeFullError', async () => {
      const full = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      for (let col = 0; col < BRIDGE_COLS; col++) {
        full[0][col] = makeCommander(`Commander${col}`);
      }
      repo = makeMockRepo(undefined, full);
      service = new InventoryService(repo);

      await expect(
        service.addItemToBridgeFirstFreeSlot(USER_ID, makeCommander('Extra'), MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeFullError);
    });
  });

  // -------------------------------------------------------------------------
  // moveBridgeItem
  // -------------------------------------------------------------------------

  describe('moveBridgeItem', () => {
    test('moveBridgeItem_validMove_movesItemAndSaves', async () => {
      const item = makeCommander('Nav');
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      existing[0][0] = item;
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      await service.moveBridgeItem(USER_ID, BRIDGE_SLOT_0_0, BRIDGE_SLOT_0_3, MAX_BRIDGE_SLOTS_1);

      const stored = repo._getStoredBridge()!;
      expect(stored[0][0]).toBeNull();
      expect(stored[0][3]).toEqual(item);
    });

    test('moveBridgeItem_emptySourceSlot_throwsBridgeSlotEmptyError', async () => {
      await expect(
        service.moveBridgeItem(USER_ID, BRIDGE_SLOT_0_0, BRIDGE_SLOT_0_1, MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeSlotEmptyError);
    });

    test('moveBridgeItem_occupiedDestSlot_throwsBridgeSlotOccupiedError', async () => {
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      existing[0][0] = makeCommander('A');
      existing[0][1] = makeCommander('B');
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      await expect(
        service.moveBridgeItem(USER_ID, BRIDGE_SLOT_0_0, BRIDGE_SLOT_0_1, MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeSlotOccupiedError);
    });

    test('moveBridgeItem_invalidDestSlot_throwsBridgeSlotInvalidError', async () => {
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      existing[0][0] = makeCommander();
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      await expect(
        service.moveBridgeItem(USER_ID, BRIDGE_SLOT_0_0, { row: 1, col: 0 }, MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeSlotInvalidError);
    });
  });

  // -------------------------------------------------------------------------
  // removeFromBridge
  // -------------------------------------------------------------------------

  describe('removeFromBridge', () => {
    test('removeFromBridge_occupiedSlot_returnsItemAndClearsSlot', async () => {
      const item = makeCommander('Remy');
      const existing = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      existing[0][2] = item;
      repo = makeMockRepo(undefined, existing);
      service = new InventoryService(repo);

      const removed = await service.removeFromBridge(USER_ID, { row: 0, col: 2 }, MAX_BRIDGE_SLOTS_1);

      expect(removed).toEqual(item);
      expect(repo._getStoredBridge()![0][2]).toBeNull();
    });

    test('removeFromBridge_emptySlot_throwsBridgeSlotEmptyError', async () => {
      await expect(
        service.removeFromBridge(USER_ID, BRIDGE_SLOT_0_0, MAX_BRIDGE_SLOTS_1)
      ).rejects.toThrow(BridgeSlotEmptyError);
    });
  });

  // -------------------------------------------------------------------------
  // moveInventoryToBridge
  // -------------------------------------------------------------------------

  describe('moveInventoryToBridge', () => {
    test('moveInventoryToBridge_validMove_movesAtomically', async () => {
      const item = makeCommander('Commodore');
      const inventory = createEmptyInventoryGrid(MAX_INVENTORY_SLOTS);
      inventory[0][0] = item;
      repo = makeMockRepo(inventory, createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1));
      service = new InventoryService(repo);

      await service.moveInventoryToBridge(
        USER_ID, INV_SLOT_0_0, BRIDGE_SLOT_0_0, MAX_INVENTORY_SLOTS, MAX_BRIDGE_SLOTS_1
      );

      expect(repo._getStoredInventory()![0][0]).toBeNull();
      expect(repo._getStoredBridge()![0][0]).toEqual(item);
      expect(repo.saveInventory).toHaveBeenCalledOnce();
      expect(repo.saveBridge).toHaveBeenCalledOnce();
    });

    test('moveInventoryToBridge_emptyInventorySlot_throwsInventorySlotEmptyError', async () => {
      repo = makeMockRepo(
        createEmptyInventoryGrid(MAX_INVENTORY_SLOTS),
        createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1)
      );
      service = new InventoryService(repo);

      await expect(
        service.moveInventoryToBridge(
          USER_ID, INV_SLOT_0_0, BRIDGE_SLOT_0_0, MAX_INVENTORY_SLOTS, MAX_BRIDGE_SLOTS_1
        )
      ).rejects.toThrow(InventorySlotEmptyError);
    });

    test('moveInventoryToBridge_occupiedBridgeSlot_throwsBridgeSlotOccupiedError', async () => {
      const inventory = createEmptyInventoryGrid(MAX_INVENTORY_SLOTS);
      inventory[0][0] = makeCommander('A');
      const bridge = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      bridge[0][0] = makeCommander('B');
      repo = makeMockRepo(inventory, bridge);
      service = new InventoryService(repo);

      await expect(
        service.moveInventoryToBridge(
          USER_ID, INV_SLOT_0_0, BRIDGE_SLOT_0_0, MAX_INVENTORY_SLOTS, MAX_BRIDGE_SLOTS_1
        )
      ).rejects.toThrow(BridgeSlotOccupiedError);
    });

    test('moveInventoryToBridge_invalidInventorySlot_throwsInventorySlotInvalidError', async () => {
      await expect(
        service.moveInventoryToBridge(
          USER_ID, { row: -1, col: 0 }, BRIDGE_SLOT_0_0, MAX_INVENTORY_SLOTS, MAX_BRIDGE_SLOTS_1
        )
      ).rejects.toThrow(InventorySlotInvalidError);
    });

    test('moveInventoryToBridge_invalidBridgeSlot_throwsBridgeSlotInvalidError', async () => {
      const inventory = createEmptyInventoryGrid(MAX_INVENTORY_SLOTS);
      inventory[0][0] = makeCommander();
      repo = makeMockRepo(inventory, createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1));
      service = new InventoryService(repo);

      await expect(
        service.moveInventoryToBridge(
          USER_ID, INV_SLOT_0_0, { row: 5, col: 0 }, MAX_INVENTORY_SLOTS, MAX_BRIDGE_SLOTS_1
        )
      ).rejects.toThrow(BridgeSlotInvalidError);
    });
  });

  // -------------------------------------------------------------------------
  // moveBridgeToInventory
  // -------------------------------------------------------------------------

  describe('moveBridgeToInventory', () => {
    test('moveBridgeToInventory_validMove_movesAtomically', async () => {
      const item = makeCommander('Admiral');
      const bridge = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      bridge[0][0] = item;
      repo = makeMockRepo(createEmptyInventoryGrid(MAX_INVENTORY_SLOTS), bridge);
      service = new InventoryService(repo);

      await service.moveBridgeToInventory(
        USER_ID, BRIDGE_SLOT_0_0, INV_SLOT_0_0, MAX_BRIDGE_SLOTS_1, MAX_INVENTORY_SLOTS
      );

      expect(repo._getStoredBridge()![0][0]).toBeNull();
      expect(repo._getStoredInventory()![0][0]).toEqual(item);
      expect(repo.saveBridge).toHaveBeenCalledOnce();
      expect(repo.saveInventory).toHaveBeenCalledOnce();
    });

    test('moveBridgeToInventory_emptyBridgeSlot_throwsBridgeSlotEmptyError', async () => {
      repo = makeMockRepo(
        createEmptyInventoryGrid(MAX_INVENTORY_SLOTS),
        createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1)
      );
      service = new InventoryService(repo);

      await expect(
        service.moveBridgeToInventory(
          USER_ID, BRIDGE_SLOT_0_0, INV_SLOT_0_0, MAX_BRIDGE_SLOTS_1, MAX_INVENTORY_SLOTS
        )
      ).rejects.toThrow(BridgeSlotEmptyError);
    });

    test('moveBridgeToInventory_occupiedInventorySlot_throwsInventorySlotOccupiedError', async () => {
      const bridge = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      bridge[0][0] = makeCommander('A');
      const inventory = createEmptyInventoryGrid(MAX_INVENTORY_SLOTS);
      inventory[0][0] = makeCommander('B');
      repo = makeMockRepo(inventory, bridge);
      service = new InventoryService(repo);

      await expect(
        service.moveBridgeToInventory(
          USER_ID, BRIDGE_SLOT_0_0, INV_SLOT_0_0, MAX_BRIDGE_SLOTS_1, MAX_INVENTORY_SLOTS
        )
      ).rejects.toThrow(InventorySlotOccupiedError);
    });

    test('moveBridgeToInventory_invalidBridgeSlot_throwsBridgeSlotInvalidError', async () => {
      await expect(
        service.moveBridgeToInventory(
          USER_ID, { row: 99, col: 0 }, INV_SLOT_0_0, MAX_BRIDGE_SLOTS_1, MAX_INVENTORY_SLOTS
        )
      ).rejects.toThrow(BridgeSlotInvalidError);
    });

    test('moveBridgeToInventory_invalidInventorySlot_throwsInventorySlotInvalidError', async () => {
      const bridge = createEmptyBridgeGrid(MAX_BRIDGE_SLOTS_1);
      bridge[0][0] = makeCommander();
      repo = makeMockRepo(undefined, bridge);
      service = new InventoryService(repo);

      await expect(
        service.moveBridgeToInventory(
          USER_ID, BRIDGE_SLOT_0_0, { row: 0, col: -1 }, MAX_BRIDGE_SLOTS_1, MAX_INVENTORY_SLOTS
        )
      ).rejects.toThrow(InventorySlotInvalidError);
    });
  });

  // -------------------------------------------------------------------------
  // Bridge grid dimensions
  // -------------------------------------------------------------------------

  describe('getBridgeRows', () => {
    test('bridgeRows_4slots_equals1row', () => {
      expect(getBridgeRows(4)).toBe(1);
    });

    test('bridgeRows_8slots_equals2rows', () => {
      expect(getBridgeRows(8)).toBe(2);
    });

    test('bridgeRows_12slots_equals3rows', () => {
      expect(getBridgeRows(12)).toBe(3);
    });
  });
});
