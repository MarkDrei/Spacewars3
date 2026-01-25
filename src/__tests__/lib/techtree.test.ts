import { describe, expect, test } from 'vitest';
import {
  AllResearches,
  ResearchType,
  getResearchUpgradeCost,
  getResearchUpgradeDuration,
  getResearchEffect,
  createInitialTechTree,
  getResearchUpgradeDurationFromTree,
  getResearchEffectFromTree,
  triggerResearch,
  updateTechTree,
  getActiveResearch,
  getWeaponDamageModifierFromTree
} from '@/lib/server/techs/techtree';

describe('getResearchUpgradeCost', () => {
  test('getResearchUpgradeCost_levelIsStartLevel_returnsBaseCost', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 1)).toBe(100);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipSpeed], 1)).toBe(500);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 0)).toBe(5000);
  });

  test('getResearchUpgradeCost_levelIsOneAboveStartLevel_returnsBaseCost', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 2)).toBe(100);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipSpeed], 2)).toBe(500);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 1)).toBe(5000);
  });

  test('getResearchUpgradeCost_levelIsTwoAboveStartLevel_appliesIncrease', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 3)).toBe(200);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipSpeed], 3)).toBe(1000);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 2)).toBe(7500);
  });

  test('getResearchUpgradeCost_levelIsThreeAboveStartLevel_appliesIncreaseSquared', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 4)).toBe(400);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipSpeed], 4)).toBe(2000);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 3)).toBe(11250);
  });
});

describe('getResearchUpgradeDuration', () => {
  test('getResearchUpgradeDuration_levelIsStartLevel_returnsBaseDuration', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 1)).toBe(10);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipSpeed], 1)).toBe(30);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 0)).toBe(120);
  });

  test('getResearchUpgradeDuration_levelIsOneAboveStartLevel_returnsBaseDuration', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 2)).toBe(10);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipSpeed], 2)).toBe(30);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 1)).toBe(120);
  });

  test('getResearchUpgradeDuration_levelIsTwoAboveStartLevel_appliesIncrease', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 3)).toBe(20);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipSpeed], 3)).toBe(60);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 2)).toBe(180);
  });

  test('getResearchUpgradeDuration_levelIsThreeAboveStartLevel_appliesIncreaseSquared', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 4)).toBe(40);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipSpeed], 4)).toBe(120);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 3)).toBe(270);
  });
});

describe('getResearchEffect', () => {
  test('getResearchEffect_levelIsStartLevel_returnsBaseValue', () => {
    expect(getResearchEffect(AllResearches[ResearchType.IronHarvesting], 1)).toBeCloseTo(1);
    expect(getResearchEffect(AllResearches[ResearchType.ShipSpeed], 1)).toBeCloseTo(25);
    expect(getResearchEffect(AllResearches[ResearchType.Afterburner], 0)).toBeCloseTo(0);
    expect(getResearchEffect(AllResearches[ResearchType.Afterburner], 1)).toBeCloseTo(100); // Added test for level 1
  });

  test('getResearchEffect_factorIncrease_appliesExponent', () => {
    expect(getResearchEffect(AllResearches[ResearchType.IronHarvesting], 2)).toBeCloseTo(1.1);
    expect(getResearchEffect(AllResearches[ResearchType.IronHarvesting], 3)).toBeCloseTo(1.21);
    expect(getResearchEffect(AllResearches[ResearchType.Afterburner], 2)).toBeCloseTo(120);
    expect(getResearchEffect(AllResearches[ResearchType.Afterburner], 3)).toBeCloseTo(144);
  });

  test('getResearchEffect_constantIncrease_appliesAddition', () => {
    expect(getResearchEffect(AllResearches[ResearchType.ShipSpeed], 2)).toBeCloseTo(30);
    expect(getResearchEffect(AllResearches[ResearchType.ShipSpeed], 3)).toBeCloseTo(35);
    expect(getResearchEffect(AllResearches[ResearchType.ShipSpeed], 4)).toBeCloseTo(40);
  });

  test('getResearchEffect_polynomialIncrease_appliesFormula', () => {
    // Test polynomial growth formula: baseValue * (1 + (0.1 * (1.5 * level - 1.5)) ^ 1.4)
    // For level 1: baseValue * 1 = baseValue
    // For level 2: baseValue * (1 + (0.1 * 1.5) ^ 1.4) = baseValue * ~1.070
    // For level 3: baseValue * (1 + (0.1 * 3.0) ^ 1.4) = baseValue * ~1.185
    expect(getResearchEffect(AllResearches[ResearchType.ProjectileAccuracy], 1)).toBeCloseTo(70, 1);
    expect(getResearchEffect(AllResearches[ResearchType.ProjectileAccuracy], 2)).toBeCloseTo(74.92, 1);
    expect(getResearchEffect(AllResearches[ResearchType.ProjectileAccuracy], 3)).toBeCloseTo(82.97, 1);
  });

  test('getResearchEffect_newProjectileWeapons_calculatesCorrectly', () => {
    expect(getResearchEffect(AllResearches[ResearchType.ProjectileDamage], 1)).toBeCloseTo(50);
    expect(getResearchEffect(AllResearches[ResearchType.ProjectileDamage], 2)).toBeCloseTo(57.5);
    expect(getResearchEffect(AllResearches[ResearchType.ProjectileReloadRate], 1)).toBeCloseTo(10);
    expect(getResearchEffect(AllResearches[ResearchType.ProjectileReloadRate], 2)).toBeCloseTo(20);
  });

  test('getResearchEffect_newEnergyWeapons_calculatesCorrectly', () => {
    expect(getResearchEffect(AllResearches[ResearchType.EnergyDamage], 1)).toBeCloseTo(60);
    expect(getResearchEffect(AllResearches[ResearchType.EnergyDamage], 2)).toBeCloseTo(69);
    expect(getResearchEffect(AllResearches[ResearchType.EnergyRechargeRate], 1)).toBeCloseTo(15);
    expect(getResearchEffect(AllResearches[ResearchType.EnergyRechargeRate], 2)).toBeCloseTo(30);
  });

  test('getResearchEffect_newDefenseResearches_calculatesCorrectly', () => {
    expect(getResearchEffect(AllResearches[ResearchType.HullStrength], 1)).toBeCloseTo(100);
    expect(getResearchEffect(AllResearches[ResearchType.HullStrength], 2)).toBeCloseTo(107.02, 1);
    expect(getResearchEffect(AllResearches[ResearchType.ShieldRechargeRate], 1)).toBeCloseTo(1);
    expect(getResearchEffect(AllResearches[ResearchType.ShieldRechargeRate], 2)).toBeCloseTo(1.07, 2);
  });

  test('getResearchEffect_newShipResearches_calculatesCorrectly', () => {
    expect(getResearchEffect(AllResearches[ResearchType.InventoryCapacity], 1)).toBeCloseTo(100);
    expect(getResearchEffect(AllResearches[ResearchType.InventoryCapacity], 2)).toBeCloseTo(120);
    expect(getResearchEffect(AllResearches[ResearchType.Teleport], 0)).toBeCloseTo(0);
    expect(getResearchEffect(AllResearches[ResearchType.Teleport], 1)).toBeCloseTo(100);
  });

  test('getResearchEffect_newSpyResearches_calculatesCorrectly', () => {
    expect(getResearchEffect(AllResearches[ResearchType.SpySabotageDamage], 0)).toBeCloseTo(0);
    expect(getResearchEffect(AllResearches[ResearchType.SpySabotageDamage], 1)).toBeCloseTo(50);
    expect(getResearchEffect(AllResearches[ResearchType.SpySabotageDamage], 2)).toBeCloseTo(62.5);
    expect(getResearchEffect(AllResearches[ResearchType.StealIron], 1)).toBeCloseTo(100);
    expect(getResearchEffect(AllResearches[ResearchType.StealIron], 2)).toBeCloseTo(130);
  });
});

describe('getResearchUpgradeDurationFromTree', () => {
  test('getResearchUpgradeDurationFromTree_treeWithDefaultLevels_returnsBaseDurations', () => {
    const tree = createInitialTechTree();
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.IronHarvesting)).toBe(10);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.ShipSpeed)).toBe(30);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.Afterburner)).toBe(120);
  });

  test('getResearchUpgradeDurationFromTree_treeWithIncreasedLevels_returnsScaledDurations', () => {
    const tree = createInitialTechTree();
    tree.ironHarvesting = 4;
    tree.shipSpeed = 4;
    tree.afterburner = 3;
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.IronHarvesting)).toBe(40);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.ShipSpeed)).toBe(120);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.Afterburner)).toBe(270);
  });
});

describe('getResearchEffectFromTree', () => {
  test('getResearchEffectFromTree_treeWithDefaultLevels_returnsBaseEffects', () => {
    const tree = createInitialTechTree();
    expect(getResearchEffectFromTree(tree, ResearchType.IronHarvesting)).toBeCloseTo(1);
    expect(getResearchEffectFromTree(tree, ResearchType.ShipSpeed)).toBeCloseTo(25);
    expect(getResearchEffectFromTree(tree, ResearchType.Afterburner)).toBeCloseTo(0);
  });

  test('getResearchEffectFromTree_treeWithIncreasedLevels_returnsScaledEffects', () => {
    const tree = createInitialTechTree();
    tree.ironHarvesting = 3;
    tree.shipSpeed = 4;
    tree.afterburner = 2;
    expect(getResearchEffectFromTree(tree, ResearchType.IronHarvesting)).toBeCloseTo(1.21);
    expect(getResearchEffectFromTree(tree, ResearchType.ShipSpeed)).toBeCloseTo(40);
    expect(getResearchEffectFromTree(tree, ResearchType.Afterburner)).toBeCloseTo(120);
  });
});

describe('triggerResearch', () => {
  test('triggerResearch_noActiveResearch_setsActiveResearchAndDuration', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.IronHarvesting);
    expect(tree.activeResearch).toBeDefined();
    expect(tree.activeResearch?.type).toBe(ResearchType.IronHarvesting);
    expect(tree.activeResearch?.remainingDuration).toBe(
      getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], tree.ironHarvesting + 1)
    );
  });

  test('triggerResearch_withActiveResearch_throwsError', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.IronHarvesting);
    expect(() => triggerResearch(tree, ResearchType.ShipSpeed)).toThrow('A research is already in progress.');
  });
});

describe('updateTechTree', () => {
  test('updateTechTree_noActiveResearch_doesNothing', () => {
    const tree = createInitialTechTree();
    updateTechTree(tree, 10);
    expect(tree.activeResearch).toBeUndefined();
    expect(tree.ironHarvesting).toBe(1);
  });

  test('updateTechTree_activeResearchNotComplete_decreasesDuration', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.IronHarvesting);
    const initialDuration = tree.activeResearch?.remainingDuration;
    updateTechTree(tree, 3);
    expect(tree.activeResearch).toBeDefined();
    expect(tree.activeResearch?.remainingDuration).toBe(initialDuration! - 3);
    expect(tree.ironHarvesting).toBe(1);
  });

  test('updateTechTree_activeResearchCompletes_increasesLevelAndUnsetsActiveResearch', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.IronHarvesting);
    const duration = tree.activeResearch?.remainingDuration;
    expect(duration).toBeDefined();
    updateTechTree(tree, duration!);
    expect(tree.activeResearch).toBeUndefined();
    expect(tree.ironHarvesting).toBe(2);
  });

  test('updateTechTree_activeResearchCompletesWithOverflow_increasesLevelAndUnsetsActiveResearch', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.IronHarvesting);
    const duration = tree.activeResearch?.remainingDuration;
    expect(duration).toBeDefined();
    updateTechTree(tree, duration! + 10);
    expect(tree.activeResearch).toBeUndefined();
    expect(tree.ironHarvesting).toBe(2);
  });
});

describe('getActiveResearch', () => {
  test('getActiveResearch_noActiveResearch_returnsUndefined', () => {
    const tree = createInitialTechTree();
    expect(getActiveResearch(tree)).toBeUndefined();
  });

  test('getActiveResearch_withActiveResearch_returnsTypeNextLevelAndDuration', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.ShipSpeed);
    const info = getActiveResearch(tree);
    expect(info).toBeDefined();
    expect(info?.type).toBe(ResearchType.ShipSpeed);
    expect(info?.nextLevel).toBe(tree.shipSpeed + 1);
    expect(info?.remainingDuration).toBe(tree.activeResearch?.remainingDuration);
  });

  test('getActiveResearch_afterUpdateTechTree_returnsUndefinedIfCompleted', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.Afterburner);
    updateTechTree(tree, 9999); // complete it
    expect(getActiveResearch(tree)).toBeUndefined();
  });
});

describe('getWeaponDamageModifierFromTree', () => {
  test('getWeaponDamageModifierFromTree_projectileWeaponAtLevel1_returns1', () => {
    const tree = createInitialTechTree();
    // Projectile damage starts at level 1 with baseValue 1 and effect 1
    const modifier = getWeaponDamageModifierFromTree('auto_turret', tree);
    expect(modifier).toBeCloseTo(1.0);
  });

  test('getWeaponDamageModifierFromTree_energyWeaponAtLevel1_returns1', () => {
    const tree = createInitialTechTree();
    // Energy damage starts at level 1 with baseValue 1 and effect 1
    const modifier = getWeaponDamageModifierFromTree('pulse_laser', tree);
    expect(modifier).toBeCloseTo(1.0);
  });

  test('getWeaponDamageModifierFromTree_projectileWeaponAtLevel2_returns115Percent', () => {
    const tree = createInitialTechTree();
    // Upgrade projectile damage to level 2
    triggerResearch(tree, ResearchType.ProjectileDamage);
    updateTechTree(tree, 9999); // complete the research
    
    // At level 2, effect should be 1.15 (factor 1.15 applied once)
    const modifier = getWeaponDamageModifierFromTree('gauss_rifle', tree);
    expect(modifier).toBeCloseTo(1.15);
  });

  test('getWeaponDamageModifierFromTree_energyWeaponAtLevel2_returns115Percent', () => {
    const tree = createInitialTechTree();
    // Upgrade energy damage to level 2
    triggerResearch(tree, ResearchType.EnergyDamage);
    updateTechTree(tree, 9999); // complete the research
    
    // At level 2, effect should be 1.15 (factor 1.15 applied once)
    const modifier = getWeaponDamageModifierFromTree('plasma_lance', tree);
    expect(modifier).toBeCloseTo(1.15);
  });

  test('getWeaponDamageModifierFromTree_projectileWeaponAtLevel3_returnsScaledModifier', () => {
    const tree = createInitialTechTree();
    // Upgrade projectile damage to level 3
    triggerResearch(tree, ResearchType.ProjectileDamage);
    updateTechTree(tree, 9999); // complete to level 2
    triggerResearch(tree, ResearchType.ProjectileDamage);
    updateTechTree(tree, 9999); // complete to level 3
    
    // At level 3, effect should be 1.3225 (1.15^2)
    const modifier = getWeaponDamageModifierFromTree('rocket_launcher', tree);
    expect(modifier).toBeCloseTo(1.3225);
  });

  test('getWeaponDamageModifierFromTree_unknownWeaponType_returns1', () => {
    const tree = createInitialTechTree();
    // Unknown weapon should return 1.0 as safe default
    const modifier = getWeaponDamageModifierFromTree('unknown_weapon', tree);
    expect(modifier).toBe(1.0);
  });
});
