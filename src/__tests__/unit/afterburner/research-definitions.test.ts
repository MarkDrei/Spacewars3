import { describe, expect, test } from 'vitest';
import {
  AllResearches,
  ResearchType,
  IMPLEMENTED_RESEARCHES,
  createInitialTechTree,
  getResearchEffect,
} from '@/lib/server/techs/techtree';

describe('AfterburnerCooldown research definition', () => {
  const cooldownResearch = AllResearches[ResearchType.AfterburnerCooldown];

  test('exists_inAllResearches_withCorrectType', () => {
    expect(cooldownResearch).toBeDefined();
    expect(cooldownResearch.type).toBe(ResearchType.AfterburnerCooldown);
  });

  test('hasCorrectBaseValues', () => {
    expect(cooldownResearch.name).toBe('Afterburner Cooldown');
    expect(cooldownResearch.level).toBe(1);
    expect(cooldownResearch.baseUpgradeCost).toBe(2000);
    expect(cooldownResearch.baseUpgradeDuration).toBe(45);
    expect(cooldownResearch.baseValue).toBe(3600);
    expect(cooldownResearch.upgradeCostIncrease).toBe(2.0);
    expect(cooldownResearch.baseValueIncrease).toEqual({ type: 'valueQuadratic', value: 0.15 });
    expect(cooldownResearch.unit).toBe('seconds');
    expect(cooldownResearch.treeKey).toBe('afterburnerCooldown');
  });
});

describe('AfterburnerDuration research definition', () => {
  const durationResearch = AllResearches[ResearchType.AfterburnerDuration];

  test('startsAtLevel0_asUnlockGate', () => {
    expect(durationResearch.level).toBe(0);
  });

  test('hasCorrectBaseValues', () => {
    expect(durationResearch.name).toBe('Afterburner Duration');
    expect(durationResearch.baseUpgradeCost).toBe(2000);
    expect(durationResearch.baseUpgradeDuration).toBe(45);
    expect(durationResearch.baseValue).toBe(30);
    expect(durationResearch.baseValueIncrease).toEqual({ type: 'constant', value: 10 });
    expect(durationResearch.unit).toBe('seconds');
  });
});

describe('AfterburnerSpeedIncrease research definition', () => {
  const speedResearch = AllResearches[ResearchType.AfterburnerSpeedIncrease];

  test('startsAtLevel1', () => {
    expect(speedResearch.level).toBe(1);
  });

  test('hasCorrectBaseValues_with25PercentPerLevel', () => {
    expect(speedResearch.baseUpgradeCost).toBe(2000);
    expect(speedResearch.baseUpgradeDuration).toBe(45);
    expect(speedResearch.baseValue).toBe(50);
    expect(speedResearch.baseValueIncrease).toEqual({ type: 'constant', value: 25 });
    expect(speedResearch.unit).toBe('%');
  });
});

describe('getResearchEffect for AfterburnerCooldown', () => {
  const cooldownResearch = AllResearches[ResearchType.AfterburnerCooldown];

  test('level0_returnsZero', () => {
    expect(getResearchEffect(cooldownResearch, 0)).toBe(0);
  });

  test('level1_returnsBaseValue3600', () => {
    expect(getResearchEffect(cooldownResearch, 1)).toBeCloseTo(3600);
  });

  test('level2_returnsLowerCooldownFromHigherRechargeSpeed', () => {
    // speed multiplier = 1 + 0.15 + 0.15² = 1.1725, displayed cooldown = 3600 / 1.1725
    expect(getResearchEffect(cooldownResearch, 2)).toBeCloseTo(3070.3625, 4);
  });

  test('level3_returnsFurtherReducedCooldown', () => {
    // speed multiplier = 1 + 0.3 + 0.3² = 1.39, displayed cooldown = 3600 / 1.39
    expect(getResearchEffect(cooldownResearch, 3)).toBeCloseTo(2589.9281, 4);
  });

  test('level5_keepsReducingCooldownAsSpeedGrows', () => {
    // speed multiplier = 1 + 0.6 + 0.6² = 1.96, displayed cooldown = 3600 / 1.96
    expect(getResearchEffect(cooldownResearch, 5)).toBeCloseTo(1836.7347, 4);
  });
});

describe('getResearchEffect for AfterburnerDuration', () => {
  const durationResearch = AllResearches[ResearchType.AfterburnerDuration];

  test('level0_returnsZero', () => {
    expect(getResearchEffect(durationResearch, 0)).toBe(0);
  });

  test('level1_returnsBaseValue30', () => {
    // constant: 30 + 10 × (1-1) = 30
    expect(getResearchEffect(durationResearch, 1)).toBeCloseTo(30);
  });

  test('level2_returns40', () => {
    // 30 + 10 × (2-1) = 40
    expect(getResearchEffect(durationResearch, 2)).toBeCloseTo(40);
  });

  test('level3_returns50', () => {
    // 30 + 10 × (3-1) = 50
    expect(getResearchEffect(durationResearch, 3)).toBeCloseTo(50);
  });
});

describe('getResearchEffect for AfterburnerSpeedIncrease', () => {
  const speedResearch = AllResearches[ResearchType.AfterburnerSpeedIncrease];

  test('level1_returnsBaseValue50', () => {
    // constant: 50 + 25 × (1-1) = 50
    expect(getResearchEffect(speedResearch, 1)).toBeCloseTo(50);
  });

  test('level2_returns75', () => {
    // 50 + 25 × (2-1) = 75
    expect(getResearchEffect(speedResearch, 2)).toBeCloseTo(75);
  });

  test('level3_returns100', () => {
    // 50 + 25 × (3-1) = 100
    expect(getResearchEffect(speedResearch, 3)).toBeCloseTo(100);
  });
});

describe('createInitialTechTree afterburner fields', () => {
  test('hasCorrectInitialValues', () => {
    const tree = createInitialTechTree();
    expect(tree.afterburnerDuration).toBe(0);
    expect(tree.afterburnerCooldown).toBe(1);
    expect(tree.afterburnerSpeedIncrease).toBe(1);
  });
});

describe('IMPLEMENTED_RESEARCHES afterburner membership', () => {
  test('afterburner_isDeprecated_notInImplemented', () => {
    expect(IMPLEMENTED_RESEARCHES.has(ResearchType.Afterburner)).toBe(false);
  });

  test('afterburnerDuration_isInImplemented', () => {
    expect(IMPLEMENTED_RESEARCHES.has(ResearchType.AfterburnerDuration)).toBe(true);
  });

  test('afterburnerCooldown_isInImplemented', () => {
    expect(IMPLEMENTED_RESEARCHES.has(ResearchType.AfterburnerCooldown)).toBe(true);
  });

  test('afterburnerSpeedIncrease_isInImplemented', () => {
    expect(IMPLEMENTED_RESEARCHES.has(ResearchType.AfterburnerSpeedIncrease)).toBe(true);
  });

  test('repairSpeed_isInImplemented', () => {
    expect(IMPLEMENTED_RESEARCHES.has(ResearchType.RepairSpeed)).toBe(true);
  });

  test('shieldRechargeRate_isInImplemented', () => {
    expect(IMPLEMENTED_RESEARCHES.has(ResearchType.ShieldRechargeRate)).toBe(true);
  });
});

describe('ResearchType enum', () => {
  test('afterburnerEnumValue_stillExists', () => {
    expect(ResearchType.Afterburner).toBe('Afterburner');
  });

  test('afterburnerCooldownEnumValue_exists', () => {
    expect(ResearchType.AfterburnerCooldown).toBe('afterburnerCooldown');
  });
});

describe('Legacy tech tree backward compatibility', () => {
  test('legacyTechTree_oldAfterburnerField_handledGracefully', () => {
    // Simulate a legacy DB record that has old 'afterburner' field but no 'afterburnerCooldown'
    const legacyJson = JSON.stringify({ afterburner: 5, shipSpeed: 3, ironHarvesting: 2 });
    const parsed = JSON.parse(legacyJson);
    const initialTree = createInitialTechTree();
    const merged = { ...initialTree, ...parsed };

    // afterburnerCooldown should get default from initialTree (1)
    expect(merged.afterburnerCooldown).toBe(1);
    // afterburnerDuration should get default from initialTree (0)
    expect(merged.afterburnerDuration).toBe(0);
    // The old afterburner field is harmless extra data
    expect((merged as Record<string, unknown>).afterburner).toBe(5);
  });

  test('legacyTechTree_missingAfterburnerDuration_getsDefault', () => {
    const legacyJson = JSON.stringify({ shipSpeed: 2 });
    const parsed = JSON.parse(legacyJson);
    const initialTree = createInitialTechTree();
    const merged = { ...initialTree, ...parsed };

    expect(merged.afterburnerDuration).toBe(0);
    expect(merged.afterburnerCooldown).toBe(1);
    expect(merged.afterburnerSpeedIncrease).toBe(1);
  });
});
