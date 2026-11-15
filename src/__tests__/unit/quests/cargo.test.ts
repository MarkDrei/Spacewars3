import { describe, it, expect } from 'vitest';
import {
  addCargoToGrid,
  addItemToGrid,
  getCargoHold,
  removeAllCargoFromGrid,
  removeCargoFromGrid,
} from '@/lib/server/inventory/cargo';
import { createEmptyInventoryGrid, type InventoryGrid } from '@/lib/server/inventory/inventoryTypes';
import type { CommanderData } from '@/shared/inventoryShared';

const MAX_SLOTS = 16;

const commander = (name = 'Ada'): CommanderData => ({ itemType: 'commander', name, imageId: 0, statBonuses: [] });

function fullGrid(): InventoryGrid {
  const grid = createEmptyInventoryGrid(MAX_SLOTS);
  for (const row of grid) row.fill(commander());
  return grid;
}

describe('mission cargo in the inventory grid', () => {
  it('getCargoHold_emptyGrid_reportsAllSlotsFree', () => {
    expect(getCargoHold(createEmptyInventoryGrid(MAX_SLOTS), MAX_SLOTS)).toEqual({ counts: {}, freeSlots: MAX_SLOTS });
  });

  it('getCargoHold_cargoAndCommanders_countsCargoAndFreeSlots', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[0][0] = commander();
    grid[0][3] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 2 };
    grid[1][7] = { itemType: 'cargo', cargoId: 'hull_plating', quantity: 1 };

    expect(getCargoHold(grid, MAX_SLOTS)).toEqual({
      counts: { ore_sample: 2, hull_plating: 1 },
      freeSlots: MAX_SLOTS - 3,
    });
  });

  it('getCargoHold_gridLargerThanMaxSlots_ignoresSlotsBeyondTheLimit', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[1][0] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 4 };

    expect(getCargoHold(grid, 8)).toEqual({ counts: {}, freeSlots: 8 });
  });

  it('addCargoToGrid_newCargoType_opensStackInFirstFreeSlot', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[0][0] = commander();

    expect(addCargoToGrid(grid, MAX_SLOTS, 'ore_sample', 1)).toBe(true);

    expect(grid[0][1]).toEqual({ itemType: 'cargo', cargoId: 'ore_sample', quantity: 1 });
  });

  it('addCargoToGrid_existingStack_growsInPlace', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[1][2] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 1 };

    expect(addCargoToGrid(grid, MAX_SLOTS, 'ore_sample', 2)).toBe(true);

    expect(grid[1][2]).toEqual({ itemType: 'cargo', cargoId: 'ore_sample', quantity: 3 });
    expect(getCargoHold(grid, MAX_SLOTS).freeSlots).toBe(MAX_SLOTS - 1);
  });

  it('addCargoToGrid_fullGridAndNewType_returnsFalseAndKeepsGrid', () => {
    const grid = fullGrid();

    expect(addCargoToGrid(grid, MAX_SLOTS, 'ore_sample', 1)).toBe(false);

    expect(getCargoHold(grid, MAX_SLOTS)).toEqual({ counts: {}, freeSlots: 0 });
  });

  it('addCargoToGrid_fullGridButExistingStack_stillGrows', () => {
    const grid = fullGrid();
    grid[0][0] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 1 };

    expect(addCargoToGrid(grid, MAX_SLOTS, 'ore_sample', 1)).toBe(true);

    expect(grid[0][0]).toEqual({ itemType: 'cargo', cargoId: 'ore_sample', quantity: 2 });
  });

  it('removeCargoFromGrid_partOfAStack_reducesQuantity', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[0][0] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 5 };

    removeCargoFromGrid(grid, MAX_SLOTS, 'ore_sample', 3);

    expect(grid[0][0]).toEqual({ itemType: 'cargo', cargoId: 'ore_sample', quantity: 2 });
  });

  it('removeCargoFromGrid_wholeStack_freesTheSlot', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[0][0] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 3 };

    removeCargoFromGrid(grid, MAX_SLOTS, 'ore_sample', 3);

    expect(grid[0][0]).toBeNull();
  });

  it('removeCargoFromGrid_moreThanAvailable_removesWhatIsThereAndLeavesOtherCargo', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[0][0] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 1 };
    grid[0][1] = { itemType: 'cargo', cargoId: 'hull_plating', quantity: 2 };

    removeCargoFromGrid(grid, MAX_SLOTS, 'ore_sample', 10);

    expect(getCargoHold(grid, MAX_SLOTS).counts).toEqual({ hull_plating: 2 });
  });

  it('removeAllCargoFromGrid_mixedGrid_keepsCommanders', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    const ada = commander('Ada');
    grid[0][0] = ada;
    grid[0][1] = { itemType: 'cargo', cargoId: 'ore_sample', quantity: 1 };
    grid[1][0] = { itemType: 'cargo', cargoId: 'hull_plating', quantity: 2 };

    removeAllCargoFromGrid(grid);

    expect(grid[0][0]).toBe(ada);
    expect(getCargoHold(grid, MAX_SLOTS)).toEqual({ counts: {}, freeSlots: MAX_SLOTS - 1 });
  });

  it('addItemToGrid_freeSlot_placesItemInFirstFreeSlot', () => {
    const grid = createEmptyInventoryGrid(MAX_SLOTS);
    grid[0][0] = commander('First');
    const second = commander('Second');

    expect(addItemToGrid(grid, MAX_SLOTS, second)).toBe(true);

    expect(grid[0][1]).toBe(second);
  });

  it('addItemToGrid_fullGrid_returnsFalse', () => {
    expect(addItemToGrid(fullGrid(), MAX_SLOTS, commander('Late'))).toBe(false);
  });
});
