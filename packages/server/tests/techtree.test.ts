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
  getActiveResearch
} from '../techtree';

describe('getResearchUpgradeCost', () => {
  test('getResearchUpgradeCost_levelIsStartLevel_returnsBaseCost', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 1)).toBe(100);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipVelocity], 1)).toBe(500);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 0)).toBe(5000);
  });

  test('getResearchUpgradeCost_levelIsOneAboveStartLevel_returnsBaseCost', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 2)).toBe(100);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipVelocity], 2)).toBe(500);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 1)).toBe(5000);
  });

  test('getResearchUpgradeCost_levelIsTwoAboveStartLevel_appliesIncrease', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 3)).toBe(200);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipVelocity], 3)).toBe(1000);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 2)).toBe(7500);
  });

  test('getResearchUpgradeCost_levelIsThreeAboveStartLevel_appliesIncreaseSquared', () => {
    expect(getResearchUpgradeCost(AllResearches[ResearchType.IronHarvesting], 4)).toBe(400);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.ShipVelocity], 4)).toBe(2000);
    expect(getResearchUpgradeCost(AllResearches[ResearchType.Afterburner], 3)).toBe(11250);
  });
});

describe('getResearchUpgradeDuration', () => {
  test('getResearchUpgradeDuration_levelIsStartLevel_returnsBaseDuration', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 1)).toBe(10);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipVelocity], 1)).toBe(30);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 0)).toBe(120);
  });

  test('getResearchUpgradeDuration_levelIsOneAboveStartLevel_returnsBaseDuration', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 2)).toBe(10);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipVelocity], 2)).toBe(30);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 1)).toBe(120);
  });

  test('getResearchUpgradeDuration_levelIsTwoAboveStartLevel_appliesIncrease', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 3)).toBe(20);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipVelocity], 3)).toBe(60);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 2)).toBe(180);
  });

  test('getResearchUpgradeDuration_levelIsThreeAboveStartLevel_appliesIncreaseSquared', () => {
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.IronHarvesting], 4)).toBe(40);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.ShipVelocity], 4)).toBe(120);
    expect(getResearchUpgradeDuration(AllResearches[ResearchType.Afterburner], 3)).toBe(270);
  });
});

describe('getResearchEffect', () => {
  test('getResearchEffect_levelIsStartLevel_returnsBaseValue', () => {
    expect(getResearchEffect(AllResearches[ResearchType.IronHarvesting], 1)).toBeCloseTo(1);
    expect(getResearchEffect(AllResearches[ResearchType.ShipVelocity], 1)).toBeCloseTo(25);
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
    expect(getResearchEffect(AllResearches[ResearchType.ShipVelocity], 2)).toBeCloseTo(30);
    expect(getResearchEffect(AllResearches[ResearchType.ShipVelocity], 3)).toBeCloseTo(35);
    expect(getResearchEffect(AllResearches[ResearchType.ShipVelocity], 4)).toBeCloseTo(40);
  });
});

describe('getResearchUpgradeDurationFromTree', () => {
  test('getResearchUpgradeDurationFromTree_treeWithDefaultLevels_returnsBaseDurations', () => {
    const tree = createInitialTechTree();
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.IronHarvesting)).toBe(10);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.ShipVelocity)).toBe(30);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.Afterburner)).toBe(120);
  });

  test('getResearchUpgradeDurationFromTree_treeWithIncreasedLevels_returnsScaledDurations', () => {
    const tree = createInitialTechTree();
    tree.ironHarvesting = 4;
    tree.shipVelocity = 4;
    tree.afterburner = 3;
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.IronHarvesting)).toBe(40);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.ShipVelocity)).toBe(120);
    expect(getResearchUpgradeDurationFromTree(tree, ResearchType.Afterburner)).toBe(270);
  });
});

describe('getResearchEffectFromTree', () => {
  test('getResearchEffectFromTree_treeWithDefaultLevels_returnsBaseEffects', () => {
    const tree = createInitialTechTree();
    expect(getResearchEffectFromTree(tree, ResearchType.IronHarvesting)).toBeCloseTo(1);
    expect(getResearchEffectFromTree(tree, ResearchType.ShipVelocity)).toBeCloseTo(25);
    expect(getResearchEffectFromTree(tree, ResearchType.Afterburner)).toBeCloseTo(0);
  });

  test('getResearchEffectFromTree_treeWithIncreasedLevels_returnsScaledEffects', () => {
    const tree = createInitialTechTree();
    tree.ironHarvesting = 3;
    tree.shipVelocity = 4;
    tree.afterburner = 2;
    expect(getResearchEffectFromTree(tree, ResearchType.IronHarvesting)).toBeCloseTo(1.21);
    expect(getResearchEffectFromTree(tree, ResearchType.ShipVelocity)).toBeCloseTo(40);
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
    expect(() => triggerResearch(tree, ResearchType.ShipVelocity)).toThrow('A research is already in progress.');
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
    const duration = tree.activeResearch?.remainingDuration!;
    updateTechTree(tree, duration);
    expect(tree.activeResearch).toBeUndefined();
    expect(tree.ironHarvesting).toBe(2);
  });

  test('updateTechTree_activeResearchCompletesWithOverflow_increasesLevelAndUnsetsActiveResearch', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.IronHarvesting);
    const duration = tree.activeResearch?.remainingDuration!;
    updateTechTree(tree, duration + 10);
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
    triggerResearch(tree, ResearchType.ShipVelocity);
    const info = getActiveResearch(tree);
    expect(info).toBeDefined();
    expect(info?.type).toBe(ResearchType.ShipVelocity);
    expect(info?.nextLevel).toBe(tree.shipVelocity + 1);
    expect(info?.remainingDuration).toBe(tree.activeResearch?.remainingDuration);
  });

  test('getActiveResearch_afterUpdateTechTree_returnsUndefinedIfCompleted', () => {
    const tree = createInitialTechTree();
    triggerResearch(tree, ResearchType.Afterburner);
    updateTechTree(tree, 9999); // complete it
    expect(getActiveResearch(tree)).toBeUndefined();
  });
});
