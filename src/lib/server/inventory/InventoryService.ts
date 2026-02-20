// ---
// InventoryService - Business logic for player inventories
// Only this class may access InventoryRepo. All callers use this service.
// No caching – reads/writes go directly to the DB via InventoryRepo.
// All public methods acquire USER_INVENTORY_LOCK internally.
// ---

import { createLockContext, LockContext, LOCK_5 } from '@markdrei/ironguard-typescript-locks';
import { USER_INVENTORY_LOCK } from '../typedLocks';
import { InventoryRepo } from './InventoryRepo';
import {
  InventoryGrid,
  InventoryItemData,
  SlotCoordinate,
  createEmptyInventoryGrid,
  ensureGridSize,
  isValidSlot,
  DEFAULT_INVENTORY_SLOTS,
  INVENTORY_COLS,
  getInventoryRows,
} from './inventoryTypes';

export class InventorySlotOccupiedError extends Error {
  constructor(slot: SlotCoordinate) {
    super(`Inventory slot (${slot.row}, ${slot.col}) is already occupied`);
    this.name = 'InventorySlotOccupiedError';
  }
}

export class InventorySlotEmptyError extends Error {
  constructor(slot: SlotCoordinate) {
    super(`Inventory slot (${slot.row}, ${slot.col}) is empty`);
    this.name = 'InventorySlotEmptyError';
  }
}

export class InventorySlotInvalidError extends Error {
  constructor(slot: SlotCoordinate) {
    super(`Inventory slot (${slot.row}, ${slot.col}) is out of bounds`);
    this.name = 'InventorySlotInvalidError';
  }
}

export class InventoryFullError extends Error {
  constructor() {
    super('Inventory is full – no free slot available');
    this.name = 'InventoryFullError';
  }
}

export class InventoryService {
  private readonly repo: InventoryRepo;

  constructor(repo?: InventoryRepo) {
    this.repo = repo ?? new InventoryRepo();
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Get the full inventory grid for a user.
   * Lazily initialises an empty inventory if none exists yet.
   * Expands the grid if the user's maxSlots has grown since last save.
   */
  async getInventory(userId: number, maxSlots: number = DEFAULT_INVENTORY_SLOTS): Promise<InventoryGrid> {
    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const existing = await this.repo.getInventory(lockCtx, userId);
      if (existing !== null) {
        const sized = ensureGridSize(existing, maxSlots);
        if (sized !== existing) {
          await this.repo.saveInventory(lockCtx, userId, sized);
        }
        return sized;
      }
      // First access – persist and return empty grid
      const empty = createEmptyInventoryGrid(maxSlots);
      await this.repo.saveInventory(lockCtx, userId, empty);
      return empty;
    });
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Add an item to a specific slot.
   * Throws InventorySlotOccupiedError if the slot is already occupied.
   */
  async addItem(
    userId: number,
    item: InventoryItemData,
    slot: SlotCoordinate,
    maxSlots: number = DEFAULT_INVENTORY_SLOTS
  ): Promise<void> {
    if (!isValidSlot(slot, maxSlots)) throw new InventorySlotInvalidError(slot);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreate(lockCtx, userId, maxSlots);
      if (grid[slot.row][slot.col] !== null) {
        throw new InventorySlotOccupiedError(slot);
      }
      grid[slot.row][slot.col] = item;
      await this.repo.saveInventory(lockCtx, userId, grid);
    });
  }

  /**
   * Add an item to the first free slot (row-major order).
   * Throws InventoryFullError if no free slot is available.
   * Returns the slot coordinate where the item was placed.
   */
  async addItemToFirstFreeSlot(
    userId: number,
    item: InventoryItemData,
    maxSlots: number = DEFAULT_INVENTORY_SLOTS
  ): Promise<SlotCoordinate> {
    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreate(lockCtx, userId, maxSlots);
      const slot = this.findFirstFreeSlot(grid, maxSlots);
      if (!slot) throw new InventoryFullError();
      grid[slot.row][slot.col] = item;
      await this.repo.saveInventory(lockCtx, userId, grid);
      return slot;
    });
  }

  /**
   * Move an item from one slot to another.
   * Throws if the source slot is empty or the destination is occupied.
   */
  async moveItem(
    userId: number,
    from: SlotCoordinate,
    to: SlotCoordinate,
    maxSlots: number = DEFAULT_INVENTORY_SLOTS
  ): Promise<void> {
    if (!isValidSlot(from, maxSlots)) throw new InventorySlotInvalidError(from);
    if (!isValidSlot(to, maxSlots)) throw new InventorySlotInvalidError(to);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreate(lockCtx, userId, maxSlots);

      const item = grid[from.row][from.col];
      if (item === null) throw new InventorySlotEmptyError(from);
      if (grid[to.row][to.col] !== null) throw new InventorySlotOccupiedError(to);

      grid[to.row][to.col] = item;
      grid[from.row][from.col] = null;
      await this.repo.saveInventory(lockCtx, userId, grid);
    });
  }

  /**
   * Remove (and return) the item at the given slot.
   * Throws InventorySlotEmptyError if the slot is already empty.
   */
  async removeItem(
    userId: number,
    slot: SlotCoordinate,
    maxSlots: number = DEFAULT_INVENTORY_SLOTS
  ): Promise<InventoryItemData> {
    if (!isValidSlot(slot, maxSlots)) throw new InventorySlotInvalidError(slot);

    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreate(lockCtx, userId, maxSlots);
      const item = grid[slot.row][slot.col];
      if (item === null) throw new InventorySlotEmptyError(slot);
      grid[slot.row][slot.col] = null;
      await this.repo.saveInventory(lockCtx, userId, grid);
      return item;
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async loadOrCreate(
    lockCtx: LockContext<readonly [typeof LOCK_5]>,
    userId: number,
    maxSlots: number
  ): Promise<InventoryGrid> {
    const grid = await this.repo.getInventory(lockCtx, userId);
    if (grid !== null) return ensureGridSize(grid, maxSlots);
    return createEmptyInventoryGrid(maxSlots);
  }

  private findFirstFreeSlot(grid: InventoryGrid, maxSlots: number): SlotCoordinate | null {
    const rows = getInventoryRows(maxSlots);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < INVENTORY_COLS; col++) {
        if (grid[row]?.[col] === null || grid[row]?.[col] === undefined) return { row, col };
      }
    }
    return null;
  }
}
