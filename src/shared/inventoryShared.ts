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
