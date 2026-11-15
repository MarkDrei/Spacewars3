// ---
// Mission cargo in the inventory grid: one stack (slot) per cargo type.
// Pure functions on a grid; loading and saving is done by the caller under USER_INVENTORY_LOCK.
// ---

import type { CargoHold } from '@/shared/quests/questTypes';
import { INVENTORY_COLS, getInventoryRows, type InventoryGrid, type InventoryItemData, type SlotCoordinate } from './inventoryTypes';

function forEachSlot(grid: InventoryGrid, maxSlots: number, visit: (slot: SlotCoordinate) => boolean | void): void {
  const rows = getInventoryRows(maxSlots);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < INVENTORY_COLS; col++) {
      if (visit({ row, col }) === true) return;
    }
  }
}

function findCargoSlot(grid: InventoryGrid, maxSlots: number, cargoId: string): SlotCoordinate | null {
  let found: SlotCoordinate | null = null;
  forEachSlot(grid, maxSlots, (slot) => {
    const item = grid[slot.row]?.[slot.col];
    if (item?.itemType === 'cargo' && item.cargoId === cargoId) {
      found = slot;
      return true;
    }
  });
  return found;
}

function findFreeSlot(grid: InventoryGrid, maxSlots: number): SlotCoordinate | null {
  let found: SlotCoordinate | null = null;
  forEachSlot(grid, maxSlots, (slot) => {
    if ((grid[slot.row]?.[slot.col] ?? null) === null) {
      found = slot;
      return true;
    }
  });
  return found;
}

/** Cargo counts and free slots of a grid, as the mission rules need them. */
export function getCargoHold(grid: InventoryGrid, maxSlots: number): CargoHold {
  const counts: Record<string, number> = {};
  let freeSlots = 0;
  forEachSlot(grid, maxSlots, (slot) => {
    const item = grid[slot.row]?.[slot.col] ?? null;
    if (item === null) {
      freeSlots += 1;
    } else if (item.itemType === 'cargo') {
      counts[item.cargoId] = (counts[item.cargoId] ?? 0) + item.quantity;
    }
  });
  return { counts, freeSlots };
}

/**
 * Adds cargo to its stack, or opens a new stack in the first free slot.
 * Returns false (grid unchanged) when a new stack is needed and no slot is free.
 */
export function addCargoToGrid(grid: InventoryGrid, maxSlots: number, cargoId: string, quantity: number): boolean {
  const stackSlot = findCargoSlot(grid, maxSlots, cargoId);
  if (stackSlot) {
    const stack = grid[stackSlot.row][stackSlot.col];
    if (stack?.itemType === 'cargo') {
      grid[stackSlot.row][stackSlot.col] = { ...stack, quantity: stack.quantity + quantity };
    }
    return true;
  }
  const freeSlot = findFreeSlot(grid, maxSlots);
  if (!freeSlot) return false;
  grid[freeSlot.row][freeSlot.col] = { itemType: 'cargo', cargoId, quantity };
  return true;
}

/** Removes up to `quantity` items of a cargo type; an emptied stack frees its slot. */
export function removeCargoFromGrid(grid: InventoryGrid, maxSlots: number, cargoId: string, quantity: number): void {
  let remaining = quantity;
  while (remaining > 0) {
    const slot = findCargoSlot(grid, maxSlots, cargoId);
    if (!slot) return;
    const stack = grid[slot.row][slot.col];
    if (stack?.itemType !== 'cargo') return;
    const taken = Math.min(remaining, stack.quantity);
    remaining -= taken;
    grid[slot.row][slot.col] = stack.quantity > taken ? { ...stack, quantity: stack.quantity - taken } : null;
  }
}

/** Removes every cargo stack (admin test tool: reset mission progress). */
export function removeAllCargoFromGrid(grid: InventoryGrid): void {
  for (const row of grid) {
    for (let col = 0; col < row.length; col++) {
      if (row[col]?.itemType === 'cargo') row[col] = null;
    }
  }
}

/** Places an item in the first free slot. Returns false when the grid is full. */
export function addItemToGrid(grid: InventoryGrid, maxSlots: number, item: InventoryItemData): boolean {
  const freeSlot = findFreeSlot(grid, maxSlots);
  if (!freeSlot) return false;
  grid[freeSlot.row][freeSlot.col] = item;
  return true;
}
