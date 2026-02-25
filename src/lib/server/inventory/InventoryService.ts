// ---
// InventoryService - Business logic for player inventories and the bridge
// Only this class may access InventoryRepo. All callers use this service.
// No caching – reads/writes go directly to the DB via InventoryRepo.
// All public methods acquire USER_INVENTORY_LOCK internally.
// ---

import { createLockContext, LockContext, LOCK_5 } from '@markdrei/ironguard-typescript-locks';
import { USER_INVENTORY_LOCK } from '../typedLocks';
import { InventoryRepo } from './InventoryRepo';
import {
  InventoryGrid,
  BridgeGrid,
  InventoryItemData,
  SlotCoordinate,
  createEmptyInventoryGrid,
  createEmptyBridgeGrid,
  ensureGridSize,
  ensureBridgeGridSize,
  isValidSlot,
  isValidBridgeSlot,
  isBridgeCompatible,
  DEFAULT_INVENTORY_SLOTS,
  DEFAULT_BRIDGE_SLOTS,
  INVENTORY_COLS,
  BRIDGE_COLS,
  getInventoryRows,
  getBridgeRows,
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

export class BridgeSlotOccupiedError extends Error {
  constructor(slot: SlotCoordinate) {
    super(`Bridge slot (${slot.row}, ${slot.col}) is already occupied`);
    this.name = 'BridgeSlotOccupiedError';
  }
}

export class BridgeSlotEmptyError extends Error {
  constructor(slot: SlotCoordinate) {
    super(`Bridge slot (${slot.row}, ${slot.col}) is empty`);
    this.name = 'BridgeSlotEmptyError';
  }
}

export class BridgeSlotInvalidError extends Error {
  constructor(slot: SlotCoordinate) {
    super(`Bridge slot (${slot.row}, ${slot.col}) is out of bounds`);
    this.name = 'BridgeSlotInvalidError';
  }
}

export class BridgeFullError extends Error {
  constructor() {
    super('Bridge is full – no free slot available');
    this.name = 'BridgeFullError';
  }
}

export class BridgeItemIncompatibleError extends Error {
  constructor() {
    super('This item cannot be assigned to the bridge');
    this.name = 'BridgeItemIncompatibleError';
  }
}

export class InventoryService {
  private readonly repo: InventoryRepo;

  constructor(repo?: InventoryRepo) {
    this.repo = repo ?? new InventoryRepo();
  }

  // ---------------------------------------------------------------------------
  // Inventory – Read
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
  // Inventory – Write
  // ---------------------------------------------------------------------------

  /**
   * Add an item to a specific inventory slot.
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
   * Add an item to the first free inventory slot (row-major order).
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
   * Move an item from one inventory slot to another.
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
   * Remove (and return) the item at the given inventory slot.
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
  // Bridge – Read
  // ---------------------------------------------------------------------------

  /**
   * Get the full bridge grid for a user.
   * Lazily initialises an empty bridge if none exists yet.
   * Expands the grid if the user's maxBridgeSlots has grown since last save.
   * Returns an empty array (no rows) when maxBridgeSlots is 0.
   */
  async getBridge(userId: number, maxBridgeSlots: number = DEFAULT_BRIDGE_SLOTS): Promise<BridgeGrid> {
    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const existing = await this.repo.getBridge(lockCtx, userId);
      if (existing !== null) {
        const sized = ensureBridgeGridSize(existing, maxBridgeSlots);
        if (sized !== existing) {
          await this.repo.saveBridge(lockCtx, userId, sized);
        }
        return sized;
      }
      // First access – persist and return empty grid
      const empty = createEmptyBridgeGrid(maxBridgeSlots);
      await this.repo.saveBridge(lockCtx, userId, empty);
      return empty;
    });
  }

  // ---------------------------------------------------------------------------
  // Bridge – Write
  // ---------------------------------------------------------------------------

  /**
   * Add an item to a specific bridge slot.
   * Throws BridgeSlotOccupiedError if the slot is already occupied.
   * Throws BridgeItemIncompatibleError if the item cannot be placed on the bridge.
   */
  async addItemToBridgeSlot(
    userId: number,
    item: InventoryItemData,
    slot: SlotCoordinate,
    maxBridgeSlots: number
  ): Promise<void> {
    if (!isBridgeCompatible(item)) throw new BridgeItemIncompatibleError();
    if (!isValidBridgeSlot(slot, maxBridgeSlots)) throw new BridgeSlotInvalidError(slot);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);
      if (grid[slot.row][slot.col] !== null) {
        throw new BridgeSlotOccupiedError(slot);
      }
      grid[slot.row][slot.col] = item;
      await this.repo.saveBridge(lockCtx, userId, grid);
    });
  }

  /**
   * Add an item to the first free bridge slot (row-major order).
   * Throws BridgeFullError if no free slot is available.
   * Throws BridgeItemIncompatibleError if the item cannot be placed on the bridge.
   * Returns the slot coordinate where the item was placed.
   */
  async addItemToBridgeFirstFreeSlot(
    userId: number,
    item: InventoryItemData,
    maxBridgeSlots: number
  ): Promise<SlotCoordinate> {
    if (!isBridgeCompatible(item)) throw new BridgeItemIncompatibleError();

    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);
      const slot = this.findFirstFreeBridgeSlot(grid, maxBridgeSlots);
      if (!slot) throw new BridgeFullError();
      grid[slot.row][slot.col] = item;
      await this.repo.saveBridge(lockCtx, userId, grid);
      return slot;
    });
  }

  /**
   * Move an item from one bridge slot to another.
   * Throws if the source slot is empty or the destination is occupied.
   */
  async moveBridgeItem(
    userId: number,
    from: SlotCoordinate,
    to: SlotCoordinate,
    maxBridgeSlots: number
  ): Promise<void> {
    if (!isValidBridgeSlot(from, maxBridgeSlots)) throw new BridgeSlotInvalidError(from);
    if (!isValidBridgeSlot(to, maxBridgeSlots)) throw new BridgeSlotInvalidError(to);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);

      const item = grid[from.row][from.col];
      if (item === null) throw new BridgeSlotEmptyError(from);
      if (grid[to.row][to.col] !== null) throw new BridgeSlotOccupiedError(to);

      grid[to.row][to.col] = item;
      grid[from.row][from.col] = null;
      await this.repo.saveBridge(lockCtx, userId, grid);
    });
  }

  /**
   * Remove (and return) the item at the given bridge slot.
   * Throws BridgeSlotEmptyError if the slot is already empty.
   */
  async removeFromBridge(
    userId: number,
    slot: SlotCoordinate,
    maxBridgeSlots: number
  ): Promise<InventoryItemData> {
    if (!isValidBridgeSlot(slot, maxBridgeSlots)) throw new BridgeSlotInvalidError(slot);

    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const grid = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);
      const item = grid[slot.row][slot.col];
      if (item === null) throw new BridgeSlotEmptyError(slot);
      grid[slot.row][slot.col] = null;
      await this.repo.saveBridge(lockCtx, userId, grid);
      return item;
    });
  }

  // ---------------------------------------------------------------------------
  // Cross-storage moves (Inventory ↔ Bridge)
  // ---------------------------------------------------------------------------

  /**
   * Move an item from an inventory slot to a bridge slot atomically.
   * Validates that the item is bridge-compatible before moving.
   * Throws BridgeItemIncompatibleError if the item cannot be placed on the bridge.
   */
  async moveInventoryToBridge(
    userId: number,
    from: SlotCoordinate,
    to: SlotCoordinate,
    maxInventorySlots: number,
    maxBridgeSlots: number
  ): Promise<void> {
    if (!isValidSlot(from, maxInventorySlots)) throw new InventorySlotInvalidError(from);
    if (!isValidBridgeSlot(to, maxBridgeSlots)) throw new BridgeSlotInvalidError(to);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const inventory = await this.loadOrCreate(lockCtx, userId, maxInventorySlots);
      const bridge = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);

      const item = inventory[from.row][from.col];
      if (item === null) throw new InventorySlotEmptyError(from);
      if (!isBridgeCompatible(item)) throw new BridgeItemIncompatibleError();
      if (bridge[to.row][to.col] !== null) throw new BridgeSlotOccupiedError(to);

      inventory[from.row][from.col] = null;
      bridge[to.row][to.col] = item;

      await this.repo.saveInventory(lockCtx, userId, inventory);
      await this.repo.saveBridge(lockCtx, userId, bridge);
    });
  }

  /**
   * Move an item from an inventory slot to the first available bridge slot.
   * Returns the destination slot that was used.
   * Throws BridgeFullError if no free bridge slot is available.
   */
  async moveInventoryToBridgeFirstFree(
    userId: number,
    from: SlotCoordinate,
    maxInventorySlots: number,
    maxBridgeSlots: number
  ): Promise<SlotCoordinate> {
    if (!isValidSlot(from, maxInventorySlots)) throw new InventorySlotInvalidError(from);

    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const inventory = await this.loadOrCreate(lockCtx, userId, maxInventorySlots);
      const bridge = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);

      const item = inventory[from.row][from.col];
      if (item === null) throw new InventorySlotEmptyError(from);
      if (!isBridgeCompatible(item)) throw new BridgeItemIncompatibleError();

      const slot = this.findFirstFreeBridgeSlot(bridge, maxBridgeSlots);
      if (!slot) throw new BridgeFullError();

      inventory[from.row][from.col] = null;
      bridge[slot.row][slot.col] = item;
      await this.repo.saveInventory(lockCtx, userId, inventory);
      await this.repo.saveBridge(lockCtx, userId, bridge);
      return slot;
    });
  }

  /**
   * Move an item from a bridge slot to the first available inventory slot.
   * Returns the destination slot that was used.
   * Throws InventoryFullError if no free inventory slot is available.
   */
  async moveBridgeToInventoryFirstFree(
    userId: number,
    from: SlotCoordinate,
    maxBridgeSlots: number,
    maxInventorySlots: number
  ): Promise<SlotCoordinate> {
    if (!isValidBridgeSlot(from, maxBridgeSlots)) throw new BridgeSlotInvalidError(from);

    const ctx = createLockContext();
    return ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const bridge = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);
      const inventory = await this.loadOrCreate(lockCtx, userId, maxInventorySlots);

      const item = bridge[from.row][from.col];
      if (item === null) throw new BridgeSlotEmptyError(from);

      const slot = this.findFirstFreeSlot(inventory, maxInventorySlots);
      if (!slot) throw new InventoryFullError();

      bridge[from.row][from.col] = null;
      inventory[slot.row][slot.col] = item;
      await this.repo.saveBridge(lockCtx, userId, bridge);
      await this.repo.saveInventory(lockCtx, userId, inventory);
      return slot;
    });
  }

  /**
   * Move an item from a bridge slot to an inventory slot atomically.
   */
  async moveBridgeToInventory(
    userId: number,
    from: SlotCoordinate,
    to: SlotCoordinate,
    maxBridgeSlots: number,
    maxInventorySlots: number
  ): Promise<void> {
    if (!isValidBridgeSlot(from, maxBridgeSlots)) throw new BridgeSlotInvalidError(from);
    if (!isValidSlot(to, maxInventorySlots)) throw new InventorySlotInvalidError(to);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_INVENTORY_LOCK, async (lockCtx) => {
      const bridge = await this.loadOrCreateBridge(lockCtx, userId, maxBridgeSlots);
      const inventory = await this.loadOrCreate(lockCtx, userId, maxInventorySlots);

      const item = bridge[from.row][from.col];
      if (item === null) throw new BridgeSlotEmptyError(from);
      if (inventory[to.row][to.col] !== null) throw new InventorySlotOccupiedError(to);

      bridge[from.row][from.col] = null;
      inventory[to.row][to.col] = item;

      await this.repo.saveBridge(lockCtx, userId, bridge);
      await this.repo.saveInventory(lockCtx, userId, inventory);
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers – Inventory
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

  // ---------------------------------------------------------------------------
  // Private helpers – Bridge
  // ---------------------------------------------------------------------------

  private async loadOrCreateBridge(
    lockCtx: LockContext<readonly [typeof LOCK_5]>,
    userId: number,
    maxBridgeSlots: number
  ): Promise<BridgeGrid> {
    const grid = await this.repo.getBridge(lockCtx, userId);
    if (grid !== null) return ensureBridgeGridSize(grid, maxBridgeSlots);
    return createEmptyBridgeGrid(maxBridgeSlots);
  }

  private findFirstFreeBridgeSlot(grid: BridgeGrid, maxBridgeSlots: number): SlotCoordinate | null {
    const rows = getBridgeRows(maxBridgeSlots);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < BRIDGE_COLS; col++) {
        if (grid[row]?.[col] === null || grid[row]?.[col] === undefined) return { row, col };
      }
    }
    return null;
  }
}
