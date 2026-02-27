import { describe, expect, test, beforeEach } from 'vitest';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { ResearchType, createInitialTechTree, getResearchEffectFromTree } from '@/lib/server/techs/techtree';

describe('Iron Capacity Management', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };

  beforeEach(() => {
    const defaultTechCounts = {
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
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0 // teleportLastRegen
    );
  });

  test('getMaxIronCapacity_initialLevel_returns5000', () => {
    // At level 1, inventory capacity should be 5000
    const maxCapacity = user.getMaxIronCapacity();
    expect(maxCapacity).toBe(5000);
  });

  test('getMaxIronCapacity_level2_returns10000', () => {
    // At level 2, inventory capacity should be 5000 * 2^1 = 10000
    user.techTree.ironCapacity = 2;
    const maxCapacity = user.getMaxIronCapacity();
    expect(maxCapacity).toBe(10000);
  });

  test('getMaxIronCapacity_level3_returns20000', () => {
    // At level 3, inventory capacity should be 5000 * 2^2 = 20000
    user.techTree.ironCapacity = 3;
    const maxCapacity = user.getMaxIronCapacity();
    expect(maxCapacity).toBe(20000);
  });

  test('addIron_belowCapacity_addsFullAmount', () => {
    user.iron = 1000;
    const actualAdded = user.addIron(500);
    expect(actualAdded).toBe(500);
    expect(user.iron).toBe(1500);
  });

  test('addIron_atCapacity_addsNothing', () => {
    user.iron = 5000; // At max capacity
    const actualAdded = user.addIron(500);
    expect(actualAdded).toBe(0);
    expect(user.iron).toBe(5000);
  });

  test('addIron_exceedsCapacity_capsAtMaximum', () => {
    user.iron = 4800;
    const actualAdded = user.addIron(500); // Would go to 5300, but capped at 5000
    expect(actualAdded).toBe(200); // Only 200 was actually added
    expect(user.iron).toBe(5000);
  });

  test('subtractIron_sufficientFunds_returnsTrue', () => {
    user.iron = 1000;
    const success = user.subtractIron(500);
    expect(success).toBe(true);
    expect(user.iron).toBe(500);
  });

  test('subtractIron_insufficientFunds_returnsFalse', () => {
    user.iron = 100;
    const success = user.subtractIron(500);
    expect(success).toBe(false);
    expect(user.iron).toBe(100); // Iron should not change
  });

  test('updateStats_respectsIronCapacity_capsPassiveIncome', () => {
    user.iron = 4990;
    user.last_updated = 1000;
    // 20 seconds pass, would generate 20 iron, but capacity is 5000
    user.updateStats(1020);
    expect(user.iron).toBe(5000); // Capped at max capacity
  });

  test('collected_respectsIronCapacity_capsCollectionReward', () => {
    user.iron = 4900;
    // Asteroid rewards are random 50-250, but should be capped at capacity
    // Set iron close to cap to test capping behavior
    user.collected('asteroid');
    expect(user.iron).toBeLessThanOrEqual(5000); // Should never exceed capacity
  });

  test('collected_atCapacity_cannotCollectMore', () => {
    user.iron = 5000;
    const ironBefore = user.iron;
    user.collected('asteroid');
    expect(user.iron).toBe(ironBefore); // No iron added when at capacity
  });

  test('updateStats_withInventoryUpgrade_allowsMoreIron', () => {
    user.iron = 5000; // At level 1 capacity
    user.last_updated = 1000;
    
    // Upgrade inventory capacity to level 2 (10000 capacity)
    user.techTree.ironCapacity = 2;
    
    // 1000 seconds pass, should generate 1000 iron
    user.updateStats(2000);
    expect(user.iron).toBe(6000); // Was 5000, added 1000
    expect(user.iron).toBeLessThanOrEqual(10000); // Under new capacity
  });

  test('ironCapacityResearch_doubleEachLevel_correctProgression', () => {
    // Test the research formula: baseValue * (factor ^ (level - 1))
    // Level 1: 5000 * 2^0 = 5000
    expect(getResearchEffectFromTree(user.techTree, ResearchType.IronCapacity)).toBe(5000);
    
    // Level 2: 5000 * 2^1 = 10000
    user.techTree.ironCapacity = 2;
    expect(getResearchEffectFromTree(user.techTree, ResearchType.IronCapacity)).toBe(10000);
    
    // Level 3: 5000 * 2^2 = 20000
    user.techTree.ironCapacity = 3;
    expect(getResearchEffectFromTree(user.techTree, ResearchType.IronCapacity)).toBe(20000);
    
    // Level 4: 5000 * 2^3 = 40000
    user.techTree.ironCapacity = 4;
    expect(getResearchEffectFromTree(user.techTree, ResearchType.IronCapacity)).toBe(40000);
  });

  test('collected_shipwreck_respectsCapacity', () => {
    user.iron = 4500;
    // Shipwreck rewards are 50-1000, should be capped at capacity
    user.collected('shipwreck');
    expect(user.iron).toBeLessThanOrEqual(5000);
  });

  test('addIron_negativeAmount_doesNothing', () => {
    user.iron = 1000;
    const actualAdded = user.addIron(-500);
    expect(actualAdded).toBe(0);
    expect(user.iron).toBe(1000); // Should not change
  });
});
