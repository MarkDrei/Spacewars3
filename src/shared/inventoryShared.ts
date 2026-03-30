// ---
// Shared inventory types used by both client and server
// These are plain data interfaces with no runtime dependencies.
// ---

export type CommanderStatKey =
  | 'shipSpeed'
  | 'projectileWeaponDamage'
  | 'projectileWeaponReloadRate'
  | 'projectileWeaponAccuracy'
  | 'energyWeaponDamage'
  | 'energyWeaponReloadRate'
  | 'energyWeaponAccuracy';

export const COMMANDER_STAT_LABELS: Record<CommanderStatKey, string> = {
  shipSpeed: 'Ship Speed',
  projectileWeaponDamage: 'Projectile Damage',
  projectileWeaponReloadRate: 'Projectile Reload Rate',
  projectileWeaponAccuracy: 'Projectile Accuracy',
  energyWeaponDamage: 'Energy Damage',
  energyWeaponReloadRate: 'Energy Reload Rate',
  energyWeaponAccuracy: 'Energy Accuracy',
};

export interface CommanderStatBonus {
  stat: CommanderStatKey;
  /** Bonus percentage, e.g. 0.3 means +0.3% */
  value: number;
}

export interface CommanderData {
  readonly itemType: 'commander';
  readonly name: string;
  /** Image identifier 0..9 that determines which commander image to display */
  readonly imageId: number;
  readonly statBonuses: CommanderStatBonus[];
}

export type InventoryItemData = CommanderData;

export interface SlotCoordinate {
  row: number; // 0-indexed
  col: number; // 0-indexed
}

export const INVENTORY_COLS = 8;
export const DEFAULT_INVENTORY_SLOTS = 16;

/** Number of rows needed for the given max-slot count */
export function getInventoryRows(maxSlots: number): number {
  return Math.ceil(maxSlots / INVENTORY_COLS);
}

export type InventorySlot = InventoryItemData | null;

/** rows×8 grid: slots[row][col] */
export type InventoryGrid = InventorySlot[][];

// ---------------------------------------------------------------------------
// Bridge grid (4 columns wide, 1 row per research level)
// ---------------------------------------------------------------------------

export const BRIDGE_COLS = 4;
export const DEFAULT_BRIDGE_SLOTS = 0;

/** Number of rows needed for the given bridge max-slot count */
export function getBridgeRows(maxSlots: number): number {
  return Math.ceil(maxSlots / BRIDGE_COLS);
}

/** rows×4 grid reusing the same InventorySlot type */
export type BridgeGrid = InventorySlot[][];

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

export type SortStatKey = CommanderStatKey | 'total';
export type SortDirection = 'asc' | 'desc';

/** Returns the sum of all stat bonus values for a commander item. */
export function getStatTotal(item: InventoryItemData): number {
  return item.statBonuses.reduce((sum, b) => sum + b.value, 0);
}

/** Returns the value of a specific stat for a commander item (0 if absent). */
export function getStatValue(item: InventoryItemData, stat: CommanderStatKey): number {
  return item.statBonuses.find((b) => b.stat === stat)?.value ?? 0;
}

/**
 * Returns a visually-sorted copy of the given grid.
 * Non-null items are sorted by the given stat (or total), with empty slots
 * pushed to the end. The grid dimensions are preserved.
 */
export function sortGrid(
  grid: InventorySlot[][],
  cols: number,
  sortBy: SortStatKey,
  direction: SortDirection,
): InventorySlot[][] {
  const items = grid.flat().filter((s): s is InventoryItemData => s !== null);

  items.sort((a, b) => {
    const aVal = sortBy === 'total' ? getStatTotal(a) : getStatValue(a, sortBy);
    const bVal = sortBy === 'total' ? getStatTotal(b) : getStatValue(b, sortBy);
    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const rows = grid.length;
  const result: InventorySlot[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[r][c] = idx < items.length ? items[idx++] : null;
    }
  }
  return result;
}
