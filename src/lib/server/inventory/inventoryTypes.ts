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

// ---------------------------------------------------------------------------
// Bridge grid – same slot type, but 4 columns wide (1 row per level)
// ---------------------------------------------------------------------------

export const BRIDGE_COLS = 4;
export const DEFAULT_BRIDGE_SLOTS = 0;

/** Number of rows needed for the given bridge max-slot count */
export function getBridgeRows(maxSlots: number): number {
  return Math.ceil(maxSlots / BRIDGE_COLS);
}

/** rows×4 grid: slots[row][col] */
export type BridgeGrid = InventorySlot[][];

/** Create a fresh, empty bridge grid sized for the given max-slot count */
export function createEmptyBridgeGrid(maxSlots: number = DEFAULT_BRIDGE_SLOTS): BridgeGrid {
  if (maxSlots === 0) return [];
  const rows = getBridgeRows(maxSlots);
  return Array.from({ length: rows }, () =>
    Array.from({ length: BRIDGE_COLS }, () => null)
  );
}

/** Expand bridge grid to accommodate more slots (never shrinks; existing items preserved) */
export function ensureBridgeGridSize(grid: BridgeGrid, maxSlots: number): BridgeGrid {
  if (maxSlots === 0) return grid.length === 0 ? grid : [];
  const targetRows = getBridgeRows(maxSlots);
  if (grid.length >= targetRows) return grid;
  const expanded = grid.map(row => [...row]);
  for (let r = grid.length; r < targetRows; r++) {
    expanded.push(Array.from({ length: BRIDGE_COLS }, () => null));
  }
  return expanded;
}

/** Validate that a slot coordinate is within bounds for the given bridge max-slot count */
export function isValidBridgeSlot(slot: SlotCoordinate, maxSlots: number): boolean {
  if (maxSlots === 0) return false;
  return (
    Number.isInteger(slot.row) &&
    Number.isInteger(slot.col) &&
    slot.row >= 0 &&
    slot.row < getBridgeRows(maxSlots) &&
    slot.col >= 0 &&
    slot.col < BRIDGE_COLS
  );
}

/**
 * Returns true if the given item is allowed on the bridge.
 * Currently all items are bridge-compatible, but this will be extended in the future
 * when new item types that cannot be assigned to the bridge are introduced.
 */
export function isBridgeCompatible(_item: InventoryItemData): boolean {
  return true;
}
