// ---
// Inventory types - shared model for the inventory system
// ---

import { CommanderData } from './Commander';

// ---------------------------------------------------------------------------
// Item union type – extend here when new item types are added
// ---------------------------------------------------------------------------

export type InventoryItemData = CommanderData;

// ---------------------------------------------------------------------------
// Slot coordinates
// ---------------------------------------------------------------------------

export interface SlotCoordinate {
  row: number; // 0-indexed
  col: number; // 0-indexed
}

// ---------------------------------------------------------------------------
// Grid dimensions
// ---------------------------------------------------------------------------

export const INVENTORY_COLS = 8;
export const DEFAULT_INVENTORY_SLOTS = 16;

/** Number of rows needed for the given max-slot count */
export function getInventoryRows(maxSlots: number): number {
  return Math.ceil(maxSlots / INVENTORY_COLS);
}

// ---------------------------------------------------------------------------
// The inventory grid itself
// A null entry means the slot is empty.
// ---------------------------------------------------------------------------

export type InventorySlot = InventoryItemData | null;

/** rows×8 grid: slots[row][col] */
export type InventoryGrid = InventorySlot[][];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh, empty inventory grid sized for the given max-slot count */
export function createEmptyInventoryGrid(maxSlots: number = DEFAULT_INVENTORY_SLOTS): InventoryGrid {
  const rows = getInventoryRows(maxSlots);
  return Array.from({ length: rows }, () =>
    Array.from({ length: INVENTORY_COLS }, () => null)
  );
}

/** Expand grid to accommodate more slots (never shrinks; existing items preserved) */
export function ensureGridSize(grid: InventoryGrid, maxSlots: number): InventoryGrid {
  const targetRows = getInventoryRows(maxSlots);
  if (grid.length >= targetRows) return grid;
  const expanded = grid.map(row => [...row]);
  for (let r = grid.length; r < targetRows; r++) {
    expanded.push(Array.from({ length: INVENTORY_COLS }, () => null));
  }
  return expanded;
}

/** Validate that a slot coordinate is within bounds for the given max-slot count */
export function isValidSlot(slot: SlotCoordinate, maxSlots: number = DEFAULT_INVENTORY_SLOTS): boolean {
  return (
    Number.isInteger(slot.row) &&
    Number.isInteger(slot.col) &&
    slot.row >= 0 &&
    slot.row < getInventoryRows(maxSlots) &&
    slot.col >= 0 &&
    slot.col < INVENTORY_COLS
  );
}
