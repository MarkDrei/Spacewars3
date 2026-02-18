// ---
// Unit tests for inventory type definitions
// Validates type safety, structure, and constants
// ---

import { describe, it, expect } from 'vitest';
import type {
  CommanderStatType,
  CommanderStat,
  Commander,
  InventoryItemType,
  InventoryItem,
  InventorySlot,
  Inventory,
} from '@/shared/src/types/inventory';
import {
  INVENTORY_ROWS,
  INVENTORY_COLS,
  isValidCommanderStat,
  isValidCommander,
} from '@/shared/src/types/inventory';

describe('inventory types', () => {
  describe('CommanderStatType', () => {
    it('commanderStatType_shipSpeed_isValidType', () => {
      const statType: CommanderStatType = 'shipSpeed';
      expect(statType).toBe('shipSpeed');
    });

    it('commanderStatType_projectileDamage_isValidType', () => {
      const statType: CommanderStatType = 'projectileDamage';
      expect(statType).toBe('projectileDamage');
    });

    it('commanderStatType_projectileReloadRate_isValidType', () => {
      const statType: CommanderStatType = 'projectileReloadRate';
      expect(statType).toBe('projectileReloadRate');
    });

    it('commanderStatType_projectileAccuracy_isValidType', () => {
      const statType: CommanderStatType = 'projectileAccuracy';
      expect(statType).toBe('projectileAccuracy');
    });

    it('commanderStatType_energyDamage_isValidType', () => {
      const statType: CommanderStatType = 'energyDamage';
      expect(statType).toBe('energyDamage');
    });

    it('commanderStatType_energyReloadRate_isValidType', () => {
      const statType: CommanderStatType = 'energyReloadRate';
      expect(statType).toBe('energyReloadRate');
    });

    it('commanderStatType_energyAccuracy_isValidType', () => {
      const statType: CommanderStatType = 'energyAccuracy';
      expect(statType).toBe('energyAccuracy');
    });
  });

  describe('CommanderStat', () => {
    it('commanderStat_validStructure_createsCorrectly', () => {
      const stat: CommanderStat = {
        statType: 'shipSpeed',
        bonusPercent: 50,
      };
      
      expect(stat.statType).toBe('shipSpeed');
      expect(stat.bonusPercent).toBe(50);
    });

    it('commanderStat_minBonusPercent_isValid', () => {
      const stat: CommanderStat = {
        statType: 'projectileDamage',
        bonusPercent: 10,
      };
      
      expect(stat.bonusPercent).toBe(10);
      expect(stat.bonusPercent).toBeGreaterThanOrEqual(10);
    });

    it('commanderStat_maxBonusPercent_isValid', () => {
      const stat: CommanderStat = {
        statType: 'energyAccuracy',
        bonusPercent: 100,
      };
      
      expect(stat.bonusPercent).toBe(100);
      expect(stat.bonusPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Commander', () => {
    it('commander_validStructure_createsCorrectly', () => {
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Captain Nova',
        stats: [
          { statType: 'shipSpeed', bonusPercent: 30 },
          { statType: 'projectileDamage', bonusPercent: 50 },
        ],
      };
      
      expect(commander.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(commander.name).toBe('Captain Nova');
      expect(commander.stats).toHaveLength(2);
    });

    it('commander_singleStat_isValid', () => {
      const commander: Commander = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Lieutenant Storm',
        stats: [
          { statType: 'energyDamage', bonusPercent: 70 },
        ],
      };
      
      expect(commander.stats).toHaveLength(1);
      expect(commander.stats[0].statType).toBe('energyDamage');
    });

    it('commander_threeStats_isValid', () => {
      const commander: Commander = {
        id: '987fcdeb-51a2-43f1-9c87-654321098765',
        name: 'Admiral Cosmos',
        stats: [
          { statType: 'shipSpeed', bonusPercent: 20 },
          { statType: 'projectileAccuracy', bonusPercent: 40 },
          { statType: 'energyReloadRate', bonusPercent: 60 },
        ],
      };
      
      expect(commander.stats).toHaveLength(3);
      expect(commander.stats[0].statType).toBe('shipSpeed');
      expect(commander.stats[1].statType).toBe('projectileAccuracy');
      expect(commander.stats[2].statType).toBe('energyReloadRate');
    });
  });

  describe('InventoryItem', () => {
    it('inventoryItem_commanderType_createsCorrectly', () => {
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Captain Nova',
        stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
      };
      
      const item: InventoryItem = {
        type: 'commander',
        data: commander,
      };
      
      expect(item.type).toBe('commander');
      expect(item.data).toBe(commander);
      expect(item.data.name).toBe('Captain Nova');
    });

    it('inventoryItem_discriminatedUnion_allowsTypeNarrowing', () => {
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Captain Nova',
        stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
      };
      
      const item: InventoryItem = {
        type: 'commander',
        data: commander,
      };
      
      // Type narrowing based on discriminator
      if (item.type === 'commander') {
        expect(item.data.name).toBe('Captain Nova');
        expect(item.data.stats).toHaveLength(1);
      }
    });

    it('inventoryItem_discriminatedUnion_demonstratesExtensibility', () => {
      // This test demonstrates that InventoryItem is a true union type
      // that can be extended in the future without breaking existing code
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Captain Nova',
        stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
      };
      
      const item: InventoryItem = {
        type: 'commander',
        data: commander,
      };
      
      // Type guard function - would work with future item types too
      function isCommander(item: InventoryItem): item is { type: 'commander'; data: Commander } {
        return item.type === 'commander';
      }
      
      expect(isCommander(item)).toBe(true);
      if (isCommander(item)) {
        // TypeScript correctly narrows the type here
        expect(item.data.name).toBe('Captain Nova');
      }
    });
  });

  describe('InventorySlot', () => {
    it('inventorySlot_withItem_createsCorrectly', () => {
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Captain Nova',
        stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
      };
      
      const slot: InventorySlot = {
        row: 0,
        col: 0,
        item: { type: 'commander', data: commander },
      };
      
      expect(slot.row).toBe(0);
      expect(slot.col).toBe(0);
      expect(slot.item).not.toBeNull();
      expect(slot.item?.type).toBe('commander');
    });

    it('inventorySlot_emptySlot_hasNullItem', () => {
      const slot: InventorySlot = {
        row: 3,
        col: 5,
        item: null,
      };
      
      expect(slot.row).toBe(3);
      expect(slot.col).toBe(5);
      expect(slot.item).toBeNull();
    });
  });

  describe('Inventory', () => {
    it('inventory_emptyGrid_createsCorrectly', () => {
      const inventory: Inventory = {
        slots: Array(INVENTORY_ROWS)
          .fill(null)
          .map(() => Array(INVENTORY_COLS).fill(null)),
      };
      
      expect(inventory.slots).toHaveLength(INVENTORY_ROWS);
      expect(inventory.slots[0]).toHaveLength(INVENTORY_COLS);
      expect(inventory.slots[0][0]).toBeNull();
    });

    it('inventory_withItems_storesCorrectly', () => {
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Captain Nova',
        stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
      };
      
      const inventory: Inventory = {
        slots: Array(INVENTORY_ROWS)
          .fill(null)
          .map(() => Array(INVENTORY_COLS).fill(null)),
      };
      
      // Add item to specific slot
      inventory.slots[0][0] = { type: 'commander', data: commander };
      
      expect(inventory.slots[0][0]).not.toBeNull();
      expect(inventory.slots[0][0]?.type).toBe('commander');
      expect(inventory.slots[0][0]?.data.name).toBe('Captain Nova');
    });

    it('inventory_rowMajorIndexing_accessesCorrectSlot', () => {
      const inventory: Inventory = {
        slots: Array(INVENTORY_ROWS)
          .fill(null)
          .map(() => Array(INVENTORY_COLS).fill(null)),
      };
      
      const commander1: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Row 2 Col 3',
        stats: [{ statType: 'shipSpeed', bonusPercent: 50 }],
      };
      
      const commander2: Commander = {
        id: '987fcdeb-51a2-43f1-9c87-654321098765',
        name: 'Row 5 Col 7',
        stats: [{ statType: 'energyDamage', bonusPercent: 80 }],
      };
      
      inventory.slots[2][3] = { type: 'commander', data: commander1 };
      inventory.slots[5][7] = { type: 'commander', data: commander2 };
      
      expect(inventory.slots[2][3]?.data.name).toBe('Row 2 Col 3');
      expect(inventory.slots[5][7]?.data.name).toBe('Row 5 Col 7');
    });
  });

  describe('Constants', () => {
    it('inventoryRows_equals10', () => {
      expect(INVENTORY_ROWS).toBe(10);
    });

    it('inventoryCols_equals10', () => {
      expect(INVENTORY_COLS).toBe(10);
    });

    it('inventorySize_is100slots', () => {
      const totalSlots = INVENTORY_ROWS * INVENTORY_COLS;
      expect(totalSlots).toBe(100);
    });
  });

  describe('Type Safety', () => {
    it('commanderStatType_allSevenTypes_areValid', () => {
      const allTypes: CommanderStatType[] = [
        'shipSpeed',
        'projectileDamage',
        'projectileReloadRate',
        'projectileAccuracy',
        'energyDamage',
        'energyReloadRate',
        'energyAccuracy',
      ];
      
      expect(allTypes).toHaveLength(7);
      
      // Verify each type is a string
      allTypes.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });

    it('inventoryItemType_currentlyOnlyCommander', () => {
      const itemType: InventoryItemType = 'commander';
      expect(itemType).toBe('commander');
    });
  });

  describe('Validation Functions', () => {
    describe('isValidCommanderStat', () => {
      it('isValidCommanderStat_validBonusPercent_returnsTrue', () => {
        const validStat: CommanderStat = {
          statType: 'shipSpeed',
          bonusPercent: 50,
        };
        
        expect(isValidCommanderStat(validStat)).toBe(true);
      });

      it('isValidCommanderStat_minBonusPercent10_returnsTrue', () => {
        const minStat: CommanderStat = {
          statType: 'projectileDamage',
          bonusPercent: 10,
        };
        
        expect(isValidCommanderStat(minStat)).toBe(true);
      });

      it('isValidCommanderStat_maxBonusPercent100_returnsTrue', () => {
        const maxStat: CommanderStat = {
          statType: 'energyAccuracy',
          bonusPercent: 100,
        };
        
        expect(isValidCommanderStat(maxStat)).toBe(true);
      });

      it('isValidCommanderStat_bonusPercentBelow10_returnsFalse', () => {
        const invalidStat: CommanderStat = {
          statType: 'shipSpeed',
          bonusPercent: 9,
        };
        
        expect(isValidCommanderStat(invalidStat)).toBe(false);
      });

      it('isValidCommanderStat_bonusPercentAbove100_returnsFalse', () => {
        const invalidStat: CommanderStat = {
          statType: 'projectileAccuracy',
          bonusPercent: 101,
        };
        
        expect(isValidCommanderStat(invalidStat)).toBe(false);
      });
    });

    describe('isValidCommander', () => {
      it('isValidCommander_validCommanderWith1Stat_returnsTrue', () => {
        const commander: Commander = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Captain Nova',
          stats: [
            { statType: 'shipSpeed', bonusPercent: 50 },
          ],
        };
        
        expect(isValidCommander(commander)).toBe(true);
      });

      it('isValidCommander_validCommanderWith3Stats_returnsTrue', () => {
        const commander: Commander = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Admiral Cosmos',
          stats: [
            { statType: 'shipSpeed', bonusPercent: 20 },
            { statType: 'projectileDamage', bonusPercent: 50 },
            { statType: 'energyAccuracy', bonusPercent: 75 },
          ],
        };
        
        expect(isValidCommander(commander)).toBe(true);
      });

      it('isValidCommander_zeroStats_returnsFalse', () => {
        const commander: Commander = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Invalid Commander',
          stats: [],
        };
        
        expect(isValidCommander(commander)).toBe(false);
      });

      it('isValidCommander_moreThan3Stats_returnsFalse', () => {
        const commander: Commander = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Invalid Commander',
          stats: [
            { statType: 'shipSpeed', bonusPercent: 20 },
            { statType: 'projectileDamage', bonusPercent: 30 },
            { statType: 'energyAccuracy', bonusPercent: 40 },
            { statType: 'projectileAccuracy', bonusPercent: 50 },
          ],
        };
        
        expect(isValidCommander(commander)).toBe(false);
      });

      it('isValidCommander_duplicateStatTypes_returnsFalse', () => {
        const commander: Commander = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Invalid Commander',
          stats: [
            { statType: 'shipSpeed', bonusPercent: 30 },
            { statType: 'shipSpeed', bonusPercent: 50 },
          ],
        };
        
        expect(isValidCommander(commander)).toBe(false);
      });

      it('isValidCommander_invalidBonusPercent_returnsFalse', () => {
        const commander: Commander = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Invalid Commander',
          stats: [
            { statType: 'shipSpeed', bonusPercent: 50 },
            { statType: 'projectileDamage', bonusPercent: 5 }, // below minimum
          ],
        };
        
        expect(isValidCommander(commander)).toBe(false);
      });
    });
  });
});
