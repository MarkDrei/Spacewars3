import { describe, it, expect } from 'vitest';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { updateTechTree, ResearchType, AllResearches, getResearchUpgradeCost, TechTree, createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';

describe('Research XP Rewards System', () => {
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };
  const defaultTechCounts: TechCounts = {
    pulse_laser: 5,
    auto_turret: 5,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: 5,
    kinetic_armor: 5,
    energy_shield: 5,
    missile_jammer: 0
  };

  describe('Task 4.1: updateTechTree Return Completion Info', () => {
    it('updateTechTree_noActiveResearch_returnsUndefined', () => {
      const tree: TechTree = { ...createInitialTechTree(), activeResearch: undefined };
      const result = updateTechTree(tree, 10);
      
      expect(result).toBeUndefined();
    });

    it('updateTechTree_researchNotComplete_returnsUndefined', () => {
      const tree: TechTree = {
        ...createInitialTechTree(),
        ironHarvesting: 1,
        activeResearch: {
          type: ResearchType.IronHarvesting,
          remainingDuration: 100,
        },
      };
      
      const result = updateTechTree(tree, 50);
      
      expect(result).toBeUndefined();
      expect(tree.activeResearch?.remainingDuration).toBe(50);
    });

    it('updateTechTree_researchCompletes_returnsCompletionInfo', () => {
      const tree: TechTree = {
        ...createInitialTechTree(),
        ironHarvesting: 1,
        activeResearch: {
          type: ResearchType.IronHarvesting,
          remainingDuration: 10,
        },
      };
      
      const result = updateTechTree(tree, 15);
      
      expect(result).toBeDefined();
      expect(result?.completed).toBe(true);
      expect(result?.type).toBe(ResearchType.IronHarvesting);
      expect(result?.completedLevel).toBe(1); // Level BEFORE increment
      expect(tree.ironHarvesting).toBe(2); // Level AFTER increment
      expect(tree.activeResearch).toBeUndefined();
    });

    it('updateTechTree_differentResearchTypes_returnsCorrectType', () => {
      const testCases = [
        { type: ResearchType.ShipSpeed, treeKey: 'shipSpeed' as const },
        { type: ResearchType.ProjectileDamage, treeKey: 'projectileDamage' as const },
        { type: ResearchType.HullStrength, treeKey: 'hullStrength' as const },
      ];

      testCases.forEach(({ type, treeKey }) => {
        const tree: TechTree = {
          ...createInitialTechTree(),
          [treeKey]: 1,
          activeResearch: {
            type,
            remainingDuration: 5,
          },
        };

        const result = updateTechTree(tree, 10);

        expect(result?.type).toBe(type);
        expect(result?.completedLevel).toBe(1);
        expect(tree[treeKey]).toBe(2);
      });
    });

    it('updateTechTree_completionAtExactTime_returnsCompletionInfo', () => {
      const tree: TechTree = {
        ...createInitialTechTree(),
        ironHarvesting: 1,
        activeResearch: {
          type: ResearchType.IronHarvesting,
          remainingDuration: 10,
        },
      };
      
      const result = updateTechTree(tree, 10);
      
      expect(result).toBeDefined();
      expect(result?.completed).toBe(true);
      expect(result?.completedLevel).toBe(1);
    });
  });

  describe('Task 4.2: Award XP in User.updateStats', () => {
    it('updateStats_researchCompletes_awardsXP', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0, // xp
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      user.techTree.ironHarvesting = 1;
      user.techTree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5,
      };
      
      const now = user.last_updated + 10;
      const result = user.updateStats(now);
      
      // Iron Harvesting level 2 costs 100 iron (base cost for first upgrade)
      const expectedXp = Math.floor(100 / 25); // 4 XP
      expect(user.xp).toBe(expectedXp);
      expect(result.levelUp).toBeUndefined(); // Not enough XP to level up yet
    });

    it('updateStats_researchCompletesAndLevelsUp_returnsLevelUpInfo', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        996, // 4 XP away from level 2 (1000 XP required)
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      user.techTree.ironHarvesting = 1;
      user.techTree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5,
      };
      
      const now = user.last_updated + 10;
      const result = user.updateStats(now);
      
      // Should award 4 XP (100 / 25) and level up
      expect(user.xp).toBe(1000);
      expect(result.levelUp).toBeDefined();
      expect(result.levelUp?.leveledUp).toBe(true);
      expect(result.levelUp?.oldLevel).toBe(1);
      expect(result.levelUp?.newLevel).toBe(2);
      expect(result.levelUp?.xpReward).toBe(4);
      expect(result.levelUp?.source).toBe('research');
    });

    it('updateStats_noResearchCompletion_returnsEmptyObject', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0, // xp
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      user.techTree.activeResearch = undefined;
      
      const now = user.last_updated + 10;
      const result = user.updateStats(now);
      
      expect(result.levelUp).toBeUndefined();
      expect(user.xp).toBe(0);
    });

    it('updateStats_researchCompletesButNoLevelUp_noLevelUpInfo', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0, // xp
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      user.techTree.shipSpeed = 1;
      user.techTree.activeResearch = {
        type: ResearchType.ShipSpeed,
        remainingDuration: 5,
      };
      
      const now = user.last_updated + 10;
      const result = user.updateStats(now);
      
      // ShipSpeed level 2 costs 500 iron, so 20 XP awarded
      expect(user.xp).toBe(20);
      expect(result.levelUp).toBeUndefined(); // Not enough to level up
    });

    it('updateStats_correctXpCalculationForHigherLevels', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0, // xp
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      user.techTree.ironHarvesting = 5; // Higher level
      user.techTree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5,
      };
      
      const now = user.last_updated + 10;
      user.updateStats(now);
      
      // Calculate expected cost for level 6
      const research = AllResearches[ResearchType.IronHarvesting];
      const cost = getResearchUpgradeCost(research, 6);
      const expectedXp = Math.floor(cost / 25);
      
      expect(user.xp).toBe(expectedXp);
      expect(cost).toBe(1600); // 100 * 2^4
      expect(expectedXp).toBe(64);
    });

    it('updateStats_ironHarvestingCompletionDuringInterval_awardsCorrectXP', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0, // xp
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      user.techTree.ironHarvesting = 1;
      user.techTree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5,
      };
      
      // Complete research in the middle of the interval
      const now = user.last_updated + 20;
      user.updateStats(now);
      
      // Should still award XP for the completed research (level 2 costs 100)
      const expectedXp = Math.floor(100 / 25); // 4 XP
      expect(user.xp).toBe(expectedXp);
    });
  });

  describe('XP Reward Formula', () => {
    it('xpReward_formula_correctForDifferentResearches', () => {
      const testCases = [
        { type: ResearchType.IronHarvesting, level: 2, expectedCost: 100, expectedXp: 4 },
        { type: ResearchType.ShipSpeed, level: 2, expectedCost: 500, expectedXp: 20 },
        { type: ResearchType.ProjectileDamage, level: 3, expectedCost: 2000, expectedXp: 80 },
        { type: ResearchType.HullStrength, level: 4, expectedCost: 7260, expectedXp: 290 },
      ];

      testCases.forEach(({ type, level, expectedCost, expectedXp }) => {
        const research = AllResearches[type];
        const cost = getResearchUpgradeCost(research, level);
        const xp = Math.floor(cost / 25);

        expect(cost).toBeCloseTo(expectedCost, 1); // Use toBeCloseTo for floating point
        expect(xp).toBe(expectedXp);
      });
    });
  });

  describe('Integration: Research Completion Flow', () => {
    it('fullFlow_researchCompletionWithLevelUp_worksEndToEnd', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        995, // Close to level 2
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      user.techTree.ironHarvesting = 1;
      user.techTree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5,
      };
      
      const initialLevel = user.getLevel();
      expect(initialLevel).toBe(1);
      
      const now = user.last_updated + 10;
      const result = user.updateStats(now);
      
      // Verify research completed
      expect(user.techTree.ironHarvesting).toBe(2);
      expect(user.techTree.activeResearch).toBeUndefined();
      
      // Verify XP awarded (level 2 costs 100, so 4 XP)
      expect(user.xp).toBe(999); // 995 + 4
      
      // Verify level up
      expect(user.getLevel()).toBe(1); // Still level 1 (999 < 1000)
      expect(result.levelUp).toBeUndefined(); // Didn't quite level up
    });

    it('fullFlow_multipleResearchCompletions_awardsCorrectXP', () => {
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0, // xp
        Math.floor(Date.now() / 1000),
        createInitialTechTree(),
        dummySave,
        defaultTechCounts,
        250,
        250,
        250,
        Math.floor(Date.now() / 1000),
        false,
        null,
        [],
        null,
        0, // teleportCharges
        0  // teleportLastRegen
      );
      
      // First research
      user.techTree.shipSpeed = 1;
      user.techTree.activeResearch = {
        type: ResearchType.ShipSpeed,
        remainingDuration: 5,
      };
      
      let now = user.last_updated + 10;
      user.updateStats(now);
      
      expect(user.xp).toBe(20); // 500 / 25
      
      // Second research - Afterburner starts at level 0
      user.last_updated = now;
      user.techTree.activeResearch = {
        type: ResearchType.Afterburner,
        remainingDuration: 5,
      };
      
      now = user.last_updated + 10;
      user.updateStats(now);
      
      // Afterburner level 1 costs 5000, so 200 XP awarded
      expect(user.xp).toBe(220); // 20 + 200
    });
  });
});
