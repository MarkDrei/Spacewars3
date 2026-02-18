// ---
// Shared types for the inventory system used by both client and server
// Defines commander items, inventory slots, and stat bonuses
// ---

/**
 * Commander stat types that provide bonuses to ship performance.
 * Each commander can have 1-3 different stat bonuses.
 */
export type CommanderStatType =
  | 'shipSpeed'
  | 'projectileDamage'
  | 'projectileReloadRate'
  | 'projectileAccuracy'
  | 'energyDamage'
  | 'energyReloadRate'
  | 'energyAccuracy';

/**
 * A single stat bonus provided by a commander.
 * bonusPercent represents the percentage bonus (10 = 10%, 100 = 100%)
 * Uses 10-100 scale consistent with existing codebase patterns (TechFactory, battleTypes).
 */
export interface CommanderStat {
  statType: CommanderStatType;
  /**
   * Bonus percentage (10-100 range: 10 = 10% bonus, 100 = 100% bonus)
   * Valid range: 10-100
   */
  bonusPercent: number;
}

/**
 * Commander item that can be collected from escape pods.
 * Each commander has a unique ID, name, and 1-3 stat bonuses.
 */
export interface Commander {
  /**
   * Unique identifier (UUID v4 format)
   */
  id: string;
  /**
   * Commander's name (space-themed)
   */
  name: string;
  /**
   * List of stat bonuses (1-3 stats)
   */
  stats: CommanderStat[];
}

/**
 * Item types that can be stored in the inventory.
 * Currently only commanders, but designed for future expansion.
 */
export type InventoryItemType = 'commander';

/**
 * Inventory item using discriminated union pattern for type safety.
 * The type field enables TypeScript to narrow the data field type.
 * Extensible: future item types can be added as union variants.
 * Example: | { type: 'weapon'; data: Weapon } | { type: 'module'; data: Module }
 */
export type InventoryItem = 
  | { type: 'commander'; data: Commander };

/**
 * A single slot in the inventory grid with position and optional item.
 * Used for explicit slot representation with coordinates.
 */
export interface InventorySlot {
  row: number;
  col: number;
  item: InventoryItem | null;
}

/**
 * Complete inventory structure as a 10×10 2D array.
 * Stored row-major: slots[row][col]
 * null represents an empty slot.
 */
export interface Inventory {
  /**
   * 2D array of inventory items (10 rows × 10 columns)
   */
  slots: (InventoryItem | null)[][];
}

/**
 * Number of rows in the inventory grid
 */
export const INVENTORY_ROWS = 10;

/**
 * Number of columns in the inventory grid
 */
export const INVENTORY_COLS = 10;

/**
 * Validates that a CommanderStat has bonusPercent in the valid range (10-100).
 * @param stat - The stat to validate
 * @returns true if bonusPercent is between 10 and 100 (inclusive), false otherwise
 */
export function isValidCommanderStat(stat: CommanderStat): boolean {
  return stat.bonusPercent >= 10 && stat.bonusPercent <= 100;
}

/**
 * Validates that a Commander has:
 * - 1-3 stats
 * - No duplicate stat types
 * - All stats have valid bonusPercent values (10-100)
 * @param commander - The commander to validate
 * @returns true if all validation rules pass, false otherwise
 */
export function isValidCommander(commander: Commander): boolean {
  // Check stats count (1-3)
  if (commander.stats.length < 1 || commander.stats.length > 3) {
    return false;
  }

  // Check for duplicate stat types
  const statTypes = new Set<CommanderStatType>();
  for (const stat of commander.stats) {
    if (statTypes.has(stat.statType)) {
      return false; // duplicate found
    }
    statTypes.add(stat.statType);
  }

  // Check all stats have valid bonusPercent
  return commander.stats.every(isValidCommanderStat);
}
