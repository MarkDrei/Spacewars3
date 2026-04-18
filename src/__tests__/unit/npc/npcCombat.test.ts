import { describe, test, expect } from 'vitest';
import {
  calculateNpcStats,
  calculateNpcIronReward,
  getNpcUsername,
  buildNpcTechCounts,
  buildNpcTechTree,
} from '@/lib/server/npc/npcCombat';

describe('NPC Combat', () => {
  describe('calculateNpcStats', () => {
    test('calculateNpcStats_level1_returnsBaseValues', () => {
      const stats = calculateNpcStats(1);
      expect(stats.defenseValue).toBe(100); // 100 * 5^0 = 100
      expect(stats.weaponCount).toBe(10); // 10 * 5^0 = 10
    });

    test('calculateNpcStats_level2_returns5xValues', () => {
      const stats = calculateNpcStats(2);
      expect(stats.defenseValue).toBe(500); // 100 * 5^1 = 500
      expect(stats.weaponCount).toBe(50); // 10 * 5^1 = 50
    });

    test('calculateNpcStats_level3_returns25xValues', () => {
      const stats = calculateNpcStats(3);
      expect(stats.defenseValue).toBe(2500); // 100 * 5^2 = 2500
      expect(stats.weaponCount).toBe(250); // 10 * 5^2 = 250
    });

    test('calculateNpcStats_level4_returns125xValues', () => {
      const stats = calculateNpcStats(4);
      expect(stats.defenseValue).toBe(12500); // 100 * 5^3 = 12500
      expect(stats.weaponCount).toBe(1250); // 10 * 5^3 = 1250
    });
  });

  describe('calculateNpcIronReward', () => {
    test('calculateNpcIronReward_level1_returns5000', () => {
      expect(calculateNpcIronReward(1)).toBe(5000);
    });

    test('calculateNpcIronReward_level2_returns25000', () => {
      expect(calculateNpcIronReward(2)).toBe(25000);
    });

    test('calculateNpcIronReward_level3_returns125000', () => {
      expect(calculateNpcIronReward(3)).toBe(125000);
    });

    test('calculateNpcIronReward_level4_returns625000', () => {
      expect(calculateNpcIronReward(4)).toBe(625000);
    });
  });

  describe('getNpcUsername', () => {
    test('getNpcUsername_generatesCorrectFormat', () => {
      expect(getNpcUsername(1, 0)).toBe('npc_1_0');
      expect(getNpcUsername(5, 3)).toBe('npc_5_3');
      expect(getNpcUsername(100, 2)).toBe('npc_100_2');
    });
  });

  describe('buildNpcTechCounts', () => {
    test('buildNpcTechCounts_level1_defenseAt1Hull', () => {
      const techCounts = buildNpcTechCounts(1, 'auto_turret');
      expect(techCounts.ship_hull).toBe(1); // 100/100 = 1
      expect(techCounts.kinetic_armor).toBe(1);
      expect(techCounts.energy_shield).toBe(1);
    });

    test('buildNpcTechCounts_level2_defenseAt5', () => {
      const techCounts = buildNpcTechCounts(2, 'pulse_laser');
      expect(techCounts.ship_hull).toBe(5); // 500/100 = 5
      expect(techCounts.kinetic_armor).toBe(5);
      expect(techCounts.energy_shield).toBe(5);
    });

    test('buildNpcTechCounts_level1_weaponCountIs10', () => {
      const techCounts = buildNpcTechCounts(1, 'gauss_rifle');
      expect(techCounts.gauss_rifle).toBe(10);
      // Other weapons should be 0
      expect(techCounts.pulse_laser).toBe(0);
      expect(techCounts.auto_turret).toBe(0);
    });

    test('buildNpcTechCounts_level2_weaponCountIs50', () => {
      const techCounts = buildNpcTechCounts(2, 'plasma_lance');
      expect(techCounts.plasma_lance).toBe(50);
    });

    test('buildNpcTechCounts_noWeaponSpecified_assignsRandomWeapon', () => {
      const techCounts = buildNpcTechCounts(1);
      // One weapon type should have 10 assigned
      const weaponKeys = ['pulse_laser', 'auto_turret', 'plasma_lance', 'gauss_rifle', 'photon_torpedo', 'rocket_launcher'] as const;
      const totalWeapons = weaponKeys.reduce((sum, key) => sum + techCounts[key], 0);
      expect(totalWeapons).toBe(10);
    });
  });

  describe('buildNpcTechTree', () => {
    test('buildNpcTechTree_level1_allResearchAt1', () => {
      const tree = buildNpcTechTree(1);
      expect(tree.ironHarvesting).toBe(1);
      expect(tree.shipSpeed).toBe(1);
      expect(tree.hullStrength).toBe(1);
    });

    test('buildNpcTechTree_level5_allResearchAt5', () => {
      const tree = buildNpcTechTree(5);
      expect(tree.ironHarvesting).toBe(5);
      expect(tree.shipSpeed).toBe(5);
      expect(tree.projectileDamage).toBe(5);
      expect(tree.energyDamage).toBe(5);
    });

    test('buildNpcTechTree_doesNotSetActiveResearch', () => {
      const tree = buildNpcTechTree(3);
      expect(tree.activeResearch).toBeUndefined();
    });
  });
});
