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

export const INVENTORY_ROWS = 10;
export const INVENTORY_COLS = 10;

// ---------------------------------------------------------------------------
// The inventory grid itself
// A null entry means the slot is empty.
// ---------------------------------------------------------------------------

export type InventorySlot = InventoryItemData | null;

/** 10×10 grid: slots[row][col] */
export type InventoryGrid = InventorySlot[][];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh, empty 10×10 inventory grid */
export function createEmptyInventoryGrid(): InventoryGrid {
  return Array.from({ length: INVENTORY_ROWS }, () =>
    Array.from({ length: INVENTORY_COLS }, () => null)
  );
}

/** Validate that a slot coordinate is within bounds */
export function isValidSlot(slot: SlotCoordinate): boolean {
  return (
    Number.isInteger(slot.row) &&
    Number.isInteger(slot.col) &&
    slot.row >= 0 &&
    slot.row < INVENTORY_ROWS &&
    slot.col >= 0 &&
    slot.col < INVENTORY_COLS
  );
}
