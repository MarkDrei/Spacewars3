// ---
// Unit tests for User inventory methods
// ---

import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '../../lib/server/user/user';
import { createInitialTechTree } from '../../lib/server/techs/techtree';
import { TechCounts } from '../../lib/server/techs/TechFactory';
import { InventoryItem, INVENTORY_ROWS, INVENTORY_COLS } from '../../shared/src/types/inventory';

describe('User Inventory Methods', () => {
  let user: User;
  let emptyInventory: (InventoryItem | null)[][];

  beforeEach(() => {
    // Create empty 10×10 inventory
    emptyInventory = Array.from({ length: INVENTORY_ROWS }, () =>
      Array.from({ length: INVENTORY_COLS }, () => null)
    );

    const techTree = createInitialTechTree();
    const techCounts: TechCounts = {
      pulse_laser: 5,
      auto_turret: 5,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0,
    };

    // Create test user with empty inventory
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0,
      Date.now(),
      techTree,
      async () => {}, // Mock save callback
      techCounts,
      100,
      100,
      100,
      Date.now(),
      false,
      null,
      [],
      null,
      emptyInventory
    );
  });

  describe('getInventory', () => {
    it('getInventory_emptyInventory_returns10x10Grid', () => {
      const inventory = user.getInventory();
      
      expect(inventory).toHaveLength(INVENTORY_ROWS);
      for (const row of inventory) {
        expect(row).toHaveLength(INVENTORY_COLS);
        for (const slot of row) {
          expect(slot).toBeNull();
        }
      }
    });

    it('getInventory_withItems_returnsPopulatedGrid', () => {
      const commander: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Captain Nova',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };
      user.inventory[0][0] = commander;

      const inventory = user.getInventory();
      expect(inventory[0][0]).toEqual(commander);
    });
  });

  describe('findFirstFreeSlot', () => {
    it('findFirstFreeSlot_emptyInventory_returnsZeroZero', () => {
      const slot = user.findFirstFreeSlot();
      expect(slot).toEqual({ row: 0, col: 0 });
    });

    it('findFirstFreeSlot_firstSlotOccupied_returnsZeroOne', () => {
      user.inventory[0][0] = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Captain Nova',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };

      const slot = user.findFirstFreeSlot();
      expect(slot).toEqual({ row: 0, col: 1 });
    });

    it('findFirstFreeSlot_firstRowFull_returnsSecondRowFirstCol', () => {
      // Fill first row
      for (let col = 0; col < INVENTORY_COLS; col++) {
        user.inventory[0][col] = {
          type: 'commander',
          data: {
            id: crypto.randomUUID(),
            name: `Commander ${col}`,
            stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
          },
        };
      }

      const slot = user.findFirstFreeSlot();
      expect(slot).toEqual({ row: 1, col: 0 });
    });

    it('findFirstFreeSlot_allFull_returnsNull', () => {
      // Fill entire inventory
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        for (let col = 0; col < INVENTORY_COLS; col++) {
          user.inventory[row][col] = {
            type: 'commander',
            data: {
              id: crypto.randomUUID(),
              name: `Commander ${row}-${col}`,
              stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
            },
          };
        }
      }

      const slot = user.findFirstFreeSlot();
      expect(slot).toBeNull();
    });

    it('findFirstFreeSlot_middleSlotFree_returnsFirstFree', () => {
      // Fill some slots
      user.inventory[0][0] = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Commander A',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };
      user.inventory[0][1] = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Commander B',
          stats: [{ statType: 'energyDamage', bonusPercent: 30 }],
        },
      };
      // user.inventory[0][2] is free

      const slot = user.findFirstFreeSlot();
      expect(slot).toEqual({ row: 0, col: 2 });
    });
  });

  describe('addItemToInventory', () => {
    it('addItemToInventory_emptyInventory_addsToFirstSlot', () => {
      const commander: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Captain Nova',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };

      const result = user.addItemToInventory(commander);
      expect(result).toBe(true);
      expect(user.inventory[0][0]).toEqual(commander);
    });

    it('addItemToInventory_partiallyFull_addsToNextFreeSlot', () => {
      // Fill first 5 slots
      for (let i = 0; i < 5; i++) {
        user.inventory[0][i] = {
          type: 'commander',
          data: {
            id: crypto.randomUUID(),
            name: `Commander ${i}`,
            stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
          },
        };
      }

      const newCommander: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440099',
          name: 'New Commander',
          stats: [{ statType: 'energyDamage', bonusPercent: 75 }],
        },
      };

      const result = user.addItemToInventory(newCommander);
      expect(result).toBe(true);
      expect(user.inventory[0][5]).toEqual(newCommander);
    });

    it('addItemToInventory_fullInventory_returnsFalse', () => {
      // Fill entire inventory
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        for (let col = 0; col < INVENTORY_COLS; col++) {
          user.inventory[row][col] = {
            type: 'commander',
            data: {
              id: crypto.randomUUID(),
              name: `Commander ${row}-${col}`,
              stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
            },
          };
        }
      }

      const newCommander: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440099',
          name: 'Overflow Commander',
          stats: [{ statType: 'energyDamage', bonusPercent: 75 }],
        },
      };

      const result = user.addItemToInventory(newCommander);
      expect(result).toBe(false);
    });
  });

  describe('moveItem', () => {
    it('moveItem_toEmptySlot_movesItem', () => {
      const commander: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Captain Nova',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };
      user.inventory[0][0] = commander;

      const result = user.moveItem(0, 0, 2, 3);
      expect(result).toBe(true);
      expect(user.inventory[0][0]).toBeNull();
      expect(user.inventory[2][3]).toEqual(commander);
    });

    it('moveItem_toOccupiedSlot_swapsItems', () => {
      const commander1: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Commander A',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };
      const commander2: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Commander B',
          stats: [{ statType: 'energyDamage', bonusPercent: 30 }],
        },
      };
      user.inventory[0][0] = commander1;
      user.inventory[1][1] = commander2;

      const result = user.moveItem(0, 0, 1, 1);
      expect(result).toBe(true);
      expect(user.inventory[0][0]).toEqual(commander2);
      expect(user.inventory[1][1]).toEqual(commander1);
    });

    it('moveItem_sameSlot_noChange', () => {
      const commander: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Captain Nova',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };
      user.inventory[0][0] = commander;

      const result = user.moveItem(0, 0, 0, 0);
      expect(result).toBe(true);
      expect(user.inventory[0][0]).toEqual(commander);
    });

    it('moveItem_fromRowOutOfBounds_returnsFalse', () => {
      const result = user.moveItem(-1, 0, 0, 0);
      expect(result).toBe(false);
    });

    it('moveItem_fromColOutOfBounds_returnsFalse', () => {
      const result = user.moveItem(0, 10, 0, 0);
      expect(result).toBe(false);
    });

    it('moveItem_toRowOutOfBounds_returnsFalse', () => {
      const result = user.moveItem(0, 0, 10, 0);
      expect(result).toBe(false);
    });

    it('moveItem_toColOutOfBounds_returnsFalse', () => {
      const result = user.moveItem(0, 0, 0, -1);
      expect(result).toBe(false);
    });

    it('moveItem_allCoordinatesOutOfBounds_returnsFalse', () => {
      const result = user.moveItem(-1, -1, 10, 10);
      expect(result).toBe(false);
    });
  });

  describe('removeItem', () => {
    it('removeItem_occupiedSlot_returnsItemAndClearsSlot', () => {
      const commander: InventoryItem = {
        type: 'commander',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Captain Nova',
          stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
        },
      };
      user.inventory[0][0] = commander;

      const removed = user.removeItem(0, 0);
      expect(removed).toEqual(commander);
      expect(user.inventory[0][0]).toBeNull();
    });

    it('removeItem_emptySlot_returnsNull', () => {
      const removed = user.removeItem(0, 0);
      expect(removed).toBeNull();
    });

    it('removeItem_rowOutOfBounds_returnsNull', () => {
      const removed = user.removeItem(-1, 0);
      expect(removed).toBeNull();
    });

    it('removeItem_colOutOfBounds_returnsNull', () => {
      const removed = user.removeItem(0, 10);
      expect(removed).toBeNull();
    });

    it('removeItem_bothCoordinatesOutOfBounds_returnsNull', () => {
      const removed = user.removeItem(10, -1);
      expect(removed).toBeNull();
    });
  });
});
