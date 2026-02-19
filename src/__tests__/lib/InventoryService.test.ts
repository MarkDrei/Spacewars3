// ---
// Tests for InventoryService – uses a mock InventoryRepo (no DB required)
// ---

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '@/lib/server/inventory/InventoryService';
import { InventoryRepo } from '@/lib/server/inventory/InventoryRepo';
import {
  createEmptyInventoryGrid,
  InventoryGrid,
  INVENTORY_ROWS,
  INVENTORY_COLS,
} from '@/lib/server/inventory/inventoryTypes';
import {
  InventorySlotOccupiedError,
  InventorySlotEmptyError,
  InventorySlotInvalidError,
  InventoryFullError,
} from '@/lib/server/inventory/InventoryService';
import { Commander } from '@/lib/server/inventory/Commander';

// ---------------------------------------------------------------------------
// Mock repo factory
// ---------------------------------------------------------------------------

function makeMockRepo(initialGrid?: InventoryGrid) {
  let stored: InventoryGrid | null = initialGrid ?? null;

  const repo = {
    getInventory: vi.fn(async () => stored),
    saveInventory: vi.fn(async (...args: unknown[]) => {
      stored = args[2] as InventoryGrid;
    }),
    deleteInventory: vi.fn(async () => {}),
    _getStored: () => stored,
  } as unknown as InventoryRepo & { _getStored: () => InventoryGrid | null };

  return repo;
}

function makeCommander(name = 'Test Commander') {
  return Commander.withStats(name, [{ stat: 'shipSpeed', value: 0.5 }]).toJSON();
}

const USER_ID = 42;
const SLOT_0_0 = { row: 0, col: 0 };
const SLOT_0_1 = { row: 0, col: 1 };
const SLOT_9_9 = { row: 9, col: 9 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InventoryService', () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: InventoryService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new InventoryService(repo);
  });

  // -------------------------------------------------------------------------
  // getInventory
  // -------------------------------------------------------------------------

  describe('getInventory', () => {
    test('getInventory_noExistingRow_returnsEmptyGridAndPersists', async () => {
      const grid = await service.getInventory(USER_ID);

      expect(grid).toHaveLength(INVENTORY_ROWS);
      expect(grid[0]).toHaveLength(INVENTORY_COLS);
      expect(grid[0][0]).toBeNull();
      expect(repo.saveInventory).toHaveBeenCalledOnce();
    });

    test('getInventory_existingRow_returnsStoredGrid', async () => {
      const existing = createEmptyInventoryGrid();
      existing[3][4] = makeCommander();
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      const grid = await service.getInventory(USER_ID);

      expect(grid[3][4]).not.toBeNull();
      expect(repo.saveInventory).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // addItem
  // -------------------------------------------------------------------------

  describe('addItem', () => {
    test('addItem_emptySlot_placesItemAndSaves', async () => {
      const item = makeCommander();
      await service.addItem(USER_ID, item, SLOT_0_0);

      const stored = repo._getStored();
      expect(stored![0][0]).toEqual(item);
      expect(repo.saveInventory).toHaveBeenCalledOnce();
    });

    test('addItem_occupiedSlot_throwsInventorySlotOccupiedError', async () => {
      const existing = createEmptyInventoryGrid();
      existing[0][0] = makeCommander('First');
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      await expect(service.addItem(USER_ID, makeCommander('Second'), SLOT_0_0))
        .rejects.toThrow(InventorySlotOccupiedError);
    });

    test('addItem_invalidSlotNegativeRow_throwsInventorySlotInvalidError', async () => {
      await expect(service.addItem(USER_ID, makeCommander(), { row: -1, col: 0 }))
        .rejects.toThrow(InventorySlotInvalidError);
    });

    test('addItem_invalidSlotOutOfBounds_throwsInventorySlotInvalidError', async () => {
      await expect(service.addItem(USER_ID, makeCommander(), { row: 10, col: 0 }))
        .rejects.toThrow(InventorySlotInvalidError);
    });

    test('addItem_lastValidSlot_placesItem', async () => {
      const item = makeCommander();
      await service.addItem(USER_ID, item, SLOT_9_9);

      expect(repo._getStored()![9][9]).toEqual(item);
    });
  });

  // -------------------------------------------------------------------------
  // addItemToFirstFreeSlot
  // -------------------------------------------------------------------------

  describe('addItemToFirstFreeSlot', () => {
    test('addItemToFirstFreeSlot_emptyInventory_placesAtSlot00', async () => {
      const item = makeCommander();
      const slot = await service.addItemToFirstFreeSlot(USER_ID, item);

      expect(slot).toEqual(SLOT_0_0);
      expect(repo._getStored()![0][0]).toEqual(item);
    });

    test('addItemToFirstFreeSlot_firstRowFull_placesAtSecondRow', async () => {
      const existing = createEmptyInventoryGrid();
      for (let col = 0; col < INVENTORY_COLS; col++) {
        existing[0][col] = makeCommander(`row0-${col}`);
      }
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      const slot = await service.addItemToFirstFreeSlot(USER_ID, makeCommander());

      expect(slot).toEqual({ row: 1, col: 0 });
    });

    test('addItemToFirstFreeSlot_fullInventory_throwsInventoryFullError', async () => {
      const full = createEmptyInventoryGrid();
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        for (let col = 0; col < INVENTORY_COLS; col++) {
          full[row][col] = makeCommander(`${row}-${col}`);
        }
      }
      repo = makeMockRepo(full);
      service = new InventoryService(repo);

      await expect(service.addItemToFirstFreeSlot(USER_ID, makeCommander()))
        .rejects.toThrow(InventoryFullError);
    });

    test('addItemToFirstFreeSlot_returnsCorrectSlot', async () => {
      const existing = createEmptyInventoryGrid();
      existing[0][0] = makeCommander('occupied');
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      const slot = await service.addItemToFirstFreeSlot(USER_ID, makeCommander());
      expect(slot).toEqual(SLOT_0_1);
    });
  });

  // -------------------------------------------------------------------------
  // moveItem
  // -------------------------------------------------------------------------

  describe('moveItem', () => {
    test('moveItem_validMove_movesItemAndClearsSource', async () => {
      const item = makeCommander();
      const existing = createEmptyInventoryGrid();
      existing[0][0] = item;
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      await service.moveItem(USER_ID, SLOT_0_0, SLOT_9_9);

      const stored = repo._getStored()!;
      expect(stored[0][0]).toBeNull();
      expect(stored[9][9]).toEqual(item);
    });

    test('moveItem_sourceEmpty_throwsInventorySlotEmptyError', async () => {
      await expect(service.moveItem(USER_ID, SLOT_0_0, SLOT_0_1))
        .rejects.toThrow(InventorySlotEmptyError);
    });

    test('moveItem_destinationOccupied_throwsInventorySlotOccupiedError', async () => {
      const existing = createEmptyInventoryGrid();
      existing[0][0] = makeCommander('A');
      existing[0][1] = makeCommander('B');
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      await expect(service.moveItem(USER_ID, SLOT_0_0, SLOT_0_1))
        .rejects.toThrow(InventorySlotOccupiedError);
    });

    test('moveItem_invalidSourceSlot_throwsInventorySlotInvalidError', async () => {
      await expect(service.moveItem(USER_ID, { row: -1, col: 0 }, SLOT_0_1))
        .rejects.toThrow(InventorySlotInvalidError);
    });

    test('moveItem_invalidDestinationSlot_throwsInventorySlotInvalidError', async () => {
      const existing = createEmptyInventoryGrid();
      existing[0][0] = makeCommander();
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      await expect(service.moveItem(USER_ID, SLOT_0_0, { row: 10, col: 0 }))
        .rejects.toThrow(InventorySlotInvalidError);
    });
  });

  // -------------------------------------------------------------------------
  // removeItem
  // -------------------------------------------------------------------------

  describe('removeItem', () => {
    test('removeItem_occupiedSlot_returnsItemAndClearsSlot', async () => {
      const item = makeCommander();
      const existing = createEmptyInventoryGrid();
      existing[0][0] = item;
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      const removed = await service.removeItem(USER_ID, SLOT_0_0);

      expect(removed).toEqual(item);
      expect(repo._getStored()![0][0]).toBeNull();
    });

    test('removeItem_emptySlot_throwsInventorySlotEmptyError', async () => {
      await expect(service.removeItem(USER_ID, SLOT_0_0))
        .rejects.toThrow(InventorySlotEmptyError);
    });

    test('removeItem_invalidSlot_throwsInventorySlotInvalidError', async () => {
      await expect(service.removeItem(USER_ID, { row: 0, col: -1 }))
        .rejects.toThrow(InventorySlotInvalidError);
    });

    test('removeItem_savesAfterRemoval', async () => {
      const existing = createEmptyInventoryGrid();
      existing[5][5] = makeCommander();
      repo = makeMockRepo(existing);
      service = new InventoryService(repo);

      await service.removeItem(USER_ID, { row: 5, col: 5 });

      expect(repo.saveInventory).toHaveBeenCalledOnce();
    });
  });
});
