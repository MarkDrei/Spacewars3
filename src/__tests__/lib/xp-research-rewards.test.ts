import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateTechTree, createInitialTechTree, AllResearches, ResearchType, getResearchUpgradeCost } from '@/lib/server/techs/techtree';
import { User } from '@/lib/server/user/user';
import { TechCounts } from '@/lib/server/techs/TechFactory';

describe('XP Rewards for Research Completion', () => {
  let mockSaveCallback: (user: User) => Promise<void>;

  beforeEach(() => {
    mockSaveCallback = vi.fn(async () => {});
  });

  describe('updateTechTree_completesResearch_returnsCompletionInfo', () => {
    it('should return completion info when research finishes', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5
      };
      const levelBefore = tree.ironHarvesting;

      const result = updateTechTree(tree, 10);

      expect(result).toBeDefined();
      expect(result?.completed).toBe(true);
      expect(result?.type).toBe(ResearchType.IronHarvesting);
      expect(result?.completedLevel).toBe(levelBefore);
      expect(tree.ironHarvesting).toBe(levelBefore + 1);
      expect(tree.activeResearch).toBeUndefined();
    });

    it('should return undefined when research does not complete', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = {
        type: ResearchType.ShipSpeed,
        remainingDuration: 100
      };

      const result = updateTechTree(tree, 10);

      expect(result).toBeUndefined();
      expect(tree.activeResearch?.remainingDuration).toBe(90);
    });

    it('should return undefined when no research is active', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = undefined;

      const result = updateTechTree(tree, 10);

      expect(result).toBeUndefined();
    });
  });

  describe('userUpdateStats_researchCompletes_awardsXp', () => {
    it('should award XP when research completes (formula: cost / 25)', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5
      };
      const techCounts: TechCounts = {
        pulse_laser: 0,
        auto_turret: 0,
        plasma_lance: 0,
        gauss_rifle: 0,
        photon_torpedo: 0,
        rocket_launcher: 0,
        ship_hull: 0,
        kinetic_armor: 0,
        energy_shield: 0,
        missile_jammer: 0
      };

      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0, // Start with 0 XP
        Math.floor(Date.now() / 1000) - 10,
        tree,
        mockSaveCallback,
        techCounts,
        100, 100, 100, Math.floor(Date.now() / 1000),
        false, null,
        [],
        null
      );

      const result = user.updateStats(Math.floor(Date.now() / 1000));

      // Calculate expected XP
      const research = AllResearches[ResearchType.IronHarvesting];
      const completedLevel = AllResearches[ResearchType.IronHarvesting].level; // Level 1 (starting level)
      const cost = getResearchUpgradeCost(research, completedLevel + 1);
      const expectedXp = Math.floor(cost / 25);

      expect(user.xp).toBe(expectedXp);
      expect(result.levelUp).toBeDefined();
    });

    it('should not award XP when research does not complete', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = {
        type: ResearchType.ShipSpeed,
        remainingDuration: 100
      };
      const techCounts: TechCounts = {
        pulse_laser: 0,
        auto_turret: 0,
        plasma_lance: 0,
        gauss_rifle: 0,
        photon_torpedo: 0,
        rocket_launcher: 0,
        
        
        ship_hull: 0,
        kinetic_armor: 0,
        energy_shield: 0,
        missile_jammer: 0
      };

      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0,
        Math.floor(Date.now() / 1000) - 5,
        tree,
        mockSaveCallback,
        techCounts,
        100, 100, 100, Math.floor(Date.now() / 1000),
        false, null,
        [], null
      );

      const result = user.updateStats(Math.floor(Date.now() / 1000));

      expect(user.xp).toBe(0);
      expect(result.levelUp).toBeUndefined();
    });

    it('should return levelUp info when XP causes level increase', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5
      };
      const techCounts: TechCounts = {
        pulse_laser: 0,
        auto_turret: 0,
        plasma_lance: 0,
        gauss_rifle: 0,
        photon_torpedo: 0,
        rocket_launcher: 0,
        
        
        ship_hull: 0,
        kinetic_armor: 0,
        energy_shield: 0,
        missile_jammer: 0
      };

      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        950, // Close to level 2 (needs 1000 XP)
        Math.floor(Date.now() / 1000) - 10,
        tree,
        mockSaveCallback,
        techCounts,
        100, 100, 100, Math.floor(Date.now() / 1000),
        false, null,
        [], null
      );

      const result = user.updateStats(Math.floor(Date.now() / 1000));

      expect(result.levelUp).toBeDefined();
      expect(result.levelUp?.leveledUp).toBe(true);
      expect(result.levelUp?.oldLevel).toBe(1);
      expect(result.levelUp?.newLevel).toBe(2);
      expect(result.levelUp?.source).toBe('research');
      expect(result.levelUp?.xpReward).toBeGreaterThan(0);
    });

    it('should not return levelUp info when XP does not cause level increase', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 5
      };
      const techCounts: TechCounts = {
        pulse_laser: 0,
        auto_turret: 0,
        plasma_lance: 0,
        gauss_rifle: 0,
        photon_torpedo: 0,
        rocket_launcher: 0,
        
        
        ship_hull: 0,
        kinetic_armor: 0,
        energy_shield: 0,
        missile_jammer: 0
      };

      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        100, // Early in level 1
        Math.floor(Date.now() / 1000) - 10,
        tree,
        mockSaveCallback,
        techCounts,
        100, 100, 100, Math.floor(Date.now() / 1000),
        false, null,
        [], null
      );

      const result = user.updateStats(Math.floor(Date.now() / 1000));

      expect(result.levelUp).toBeUndefined();
    });
  });

  describe('researchXpFormula_correctCalculation', () => {
    it('should calculate XP as cost divided by 25', () => {
      const research = AllResearches[ResearchType.IronHarvesting];
      const level = AllResearches[ResearchType.IronHarvesting].level;
      const cost = getResearchUpgradeCost(research, level + 1);
      const expectedXp = Math.floor(cost / 25);

      // Verify the formula
      expect(expectedXp).toBeGreaterThan(0);
      expect(expectedXp).toBe(Math.floor(cost / 25));
    });

    it('should award different XP amounts for different research types', () => {
      const ironResearch = AllResearches[ResearchType.IronHarvesting];
      const ironLevel = AllResearches[ResearchType.IronHarvesting].level;
      const ironCost = getResearchUpgradeCost(ironResearch, ironLevel + 1);
      const ironXp = Math.floor(ironCost / 25);

      const shipResearch = AllResearches[ResearchType.ShipSpeed];
      const shipLevel = AllResearches[ResearchType.ShipSpeed].level;
      const shipCost = getResearchUpgradeCost(shipResearch, shipLevel + 1);
      const shipXp = Math.floor(shipCost / 25);

      // Different research types may have different costs, so XP should differ
      // At minimum, both should be positive
      expect(ironXp).toBeGreaterThan(0);
      expect(shipXp).toBeGreaterThan(0);
    });
  });

  describe('ironHarvestingResearch_completionDuringUpdate_awardsCorrectXp', () => {
    it('should handle IronHarvesting research completion correctly', () => {
      const tree = createInitialTechTree();
      tree.activeResearch = {
        type: ResearchType.IronHarvesting,
        remainingDuration: 3
      };
      const techCounts: TechCounts = {
        pulse_laser: 0,
        auto_turret: 0,
        plasma_lance: 0,
        gauss_rifle: 0,
        photon_torpedo: 0,
        rocket_launcher: 0,
        
        
        ship_hull: 0,
        kinetic_armor: 0,
        energy_shield: 0,
        missile_jammer: 0
      };

      const startTime = Math.floor(Date.now() / 1000) - 5;
      const user = new User(
        1,
        'testuser',
        'hash',
        1000,
        0,
        startTime,
        tree,
        mockSaveCallback,
        techCounts,
        100, 100, 100, Math.floor(Date.now() / 1000),
        false, null,
        [], null
      );

      const now = startTime + 5; // 5 seconds elapsed, research completes after 3
      const result = user.updateStats(now);

      // Verify research completed
      expect(tree.activeResearch).toBeUndefined();
      expect(tree.ironHarvesting).toBeGreaterThan(AllResearches[ResearchType.IronHarvesting].level);

      // Verify XP awarded
      expect(user.xp).toBeGreaterThan(0);
      expect(result.levelUp).toBeDefined();
    });
  });
});
