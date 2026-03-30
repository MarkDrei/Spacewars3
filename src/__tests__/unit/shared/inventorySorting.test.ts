import { describe, it, expect } from 'vitest';
import { sortGrid, getStatTotal, getStatValue } from '@/shared/inventoryShared';
import type { InventoryItemData, InventorySlot } from '@/shared/inventoryShared';

const makeCommander = (name: string, bonuses: { stat: InventoryItemData['statBonuses'][0]['stat'], value: number }[]): InventoryItemData => ({
  itemType: 'commander',
  name,
  imageId: 0,
  statBonuses: bonuses,
});

const alpha = makeCommander('Alpha', [
  { stat: 'shipSpeed', value: 10 },
  { stat: 'energyWeaponDamage', value: 5 },
]);

const beta = makeCommander('Beta', [
  { stat: 'shipSpeed', value: 3 },
  { stat: 'projectileWeaponDamage', value: 20 },
]);

const gamma = makeCommander('Gamma', [
  { stat: 'energyWeaponDamage', value: 1 },
]);

describe('getStatTotal', () => {
  it('sums all stat bonus values', () => {
    expect(getStatTotal(alpha)).toBe(15);
    expect(getStatTotal(beta)).toBe(23);
    expect(getStatTotal(gamma)).toBe(1);
  });

  it('returns 0 for a commander with no bonuses', () => {
    const empty = makeCommander('Empty', []);
    expect(getStatTotal(empty)).toBe(0);
  });
});

describe('getStatValue', () => {
  it('returns the value for a specific stat', () => {
    expect(getStatValue(alpha, 'shipSpeed')).toBe(10);
    expect(getStatValue(beta, 'projectileWeaponDamage')).toBe(20);
  });

  it('returns 0 when the stat is absent', () => {
    expect(getStatValue(gamma, 'shipSpeed')).toBe(0);
    expect(getStatValue(alpha, 'projectileWeaponDamage')).toBe(0);
  });
});

describe('sortGrid', () => {
  // A 1-row × 4-col grid: [alpha, beta, null, gamma]
  const grid: InventorySlot[][] = [[alpha, beta, null, gamma]];
  const cols = 4;

  it('sortGrid_byTotal_descendingOrder', () => {
    const result = sortGrid(grid, cols, 'total', 'desc');
    const items = result.flat().filter((s): s is InventoryItemData => s !== null);
    expect(items.map((i) => i.name)).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('sortGrid_byTotal_ascendingOrder', () => {
    const result = sortGrid(grid, cols, 'total', 'asc');
    const items = result.flat().filter((s): s is InventoryItemData => s !== null);
    expect(items.map((i) => i.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('sortGrid_bySingleStat_descendingOrder', () => {
    const result = sortGrid(grid, cols, 'shipSpeed', 'desc');
    const items = result.flat().filter((s): s is InventoryItemData => s !== null);
    expect(items.map((i) => i.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sortGrid_bySingleStat_ascendingOrder', () => {
    const result = sortGrid(grid, cols, 'shipSpeed', 'asc');
    const items = result.flat().filter((s): s is InventoryItemData => s !== null);
    // Gamma=0, Beta=3, Alpha=10
    expect(items.map((i) => i.name)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('sortGrid_preservesGridDimensions', () => {
    const result = sortGrid(grid, cols, 'total', 'desc');
    expect(result.length).toBe(1);
    expect(result[0].length).toBe(4);
  });

  it('sortGrid_emptySlotsMovedToEnd', () => {
    const result = sortGrid(grid, cols, 'total', 'desc');
    // 3 items + 1 null; null must be at the very last position
    expect(result[0][3]).toBeNull();
  });

  it('sortGrid_emptyGrid_returnsEmptyGrid', () => {
    const empty: InventorySlot[][] = [[null, null], [null, null]];
    const result = sortGrid(empty, 2, 'total', 'desc');
    expect(result.flat().every((s) => s === null)).toBe(true);
  });

  it('sortGrid_multipleRows_preservesRowCount', () => {
    // 2-row × 2-col grid
    const twoRow: InventorySlot[][] = [
      [alpha, null],
      [beta, gamma],
    ];
    const result = sortGrid(twoRow, 2, 'total', 'desc');
    expect(result.length).toBe(2);
    const items = result.flat().filter((s): s is InventoryItemData => s !== null);
    expect(items.map((i) => i.name)).toEqual(['Beta', 'Alpha', 'Gamma']);
  });
});
