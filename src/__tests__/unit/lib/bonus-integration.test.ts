// ---
// Unit tests for Tasks 5.1–5.4: bonus-system integration across User, TechService, TechFactory.
//
// Tests verify:
//   5.1.1 — updateStats() uses bonuses.ironRechargeRate / ironStorageCapacity
//   5.1.1 — mid-tick IronHarvesting completion applies levelMultiplier to new rate
//   5.3.1 — updateDefenseValues() / calculateMaxDefense() apply levelMultiplier
//   5.3.2 — updateDefenseValues() uses bonused regen rates
//   5.4.1 — TechFactory.calculateWeaponReloadTime() accepts totalReloadFactor
//   5.2.1 — TechService changes tested via parameter acceptance (route changes are integration)
//
// No database access — UserBonusCache.invalidateBonuses() is mocked.
// ---

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { User, type SaveUserCallback } from '@/lib/server/user/user';
import {
  createInitialTechTree,
  getResearchEffectFromTree,
  ResearchType,
  triggerResearch,
} from '@/lib/server/techs/techtree';
import { TechService } from '@/lib/server/techs/TechService';
import { TechFactory } from '@/lib/server/techs/TechFactory';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';
import { BASE_REGEN_RATE } from '@/lib/server/bonus/userBonusTypes';

// ---------------------------------------------------------------------------
// Mock UserBonusCache so that addXp() → invalidateBonuses() doesn't throw
// ---------------------------------------------------------------------------
vi.mock('@/lib/server/bonus/UserBonusCache', () => {
  const invalidateBonuses = vi.fn();
  const getInstance = vi.fn(() => ({ invalidateBonuses }));
  return { UserBonusCache: { getInstance, resetInstance: vi.fn() } };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const dummySave: SaveUserCallback = async () => { /* no-op */ };

const DEFAULT_TECH_COUNTS = {
  pulse_laser: 0,
  auto_turret: 0,
  plasma_lance: 0,
  gauss_rifle: 0,
  photon_torpedo: 0,
  rocket_launcher: 0,
  ship_hull: 2,
  kinetic_armor: 2,
  energy_shield: 2,
  missile_jammer: 0,
};

function makeUser(overrides: Partial<{
  iron: number;
  xp: number;
  lastUpdated: number;
  hullCurrent: number;
  armorCurrent: number;
  shieldCurrent: number;
  defenseLastRegen: number;
}> = {}): User {
  return new User(
    1,
    'testuser',
    'hash',
    overrides.iron ?? 0,
    overrides.xp ?? 0,
    overrides.lastUpdated ?? 1000,
    createInitialTechTree(),
    dummySave,
    { ...DEFAULT_TECH_COUNTS },
    overrides.hullCurrent ?? 100,
    overrides.armorCurrent ?? 100,
    overrides.shieldCurrent ?? 100,
    overrides.defenseLastRegen ?? 1000,
    false,
    null,
    [],
    null,
    0,
    0
  );
}

/** Create a level-1 UserBonuses from the user's current tech tree (no level/commander bonus) */
function makeLevel1Bonuses(user: User): UserBonuses {
  const tree = user.techTree;
  const ironHarvesting = getResearchEffectFromTree(tree, ResearchType.IronHarvesting);
  const ironCapacity = getResearchEffectFromTree(tree, ResearchType.IronCapacity);
  return {
    levelMultiplier: 1.0,
    commanderMultipliers: {} as UserBonuses['commanderMultipliers'],
    ironRechargeRate: ironHarvesting,
    ironStorageCapacity: ironCapacity,
    hullRepairSpeed: BASE_REGEN_RATE,
    armorRepairSpeed: BASE_REGEN_RATE,
    shieldRechargeRate: BASE_REGEN_RATE,
    maxShipSpeed: 25,
    projectileWeaponDamageFactor: 1.0,
    projectileWeaponReloadFactor: 1.0,
    projectileWeaponAccuracyFactor: 1.0,
    energyWeaponDamageFactor: 1.0,
    energyWeaponReloadFactor: 1.0,
    energyWeaponAccuracyFactor: 1.0,
  };
}

// ============================================================================
// Task 5.1.1 — updateStats() uses bonus iron rate and capacity
// ============================================================================

describe('Task 5.1.1 — updateStats() with bonuses', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('updateStats_noBonuses_fallsBackToTechTree', () => {
    const user = makeUser();
    // 10 seconds pass, no bonuses (backward compat mode)
    user.updateStats(1010);
    // Base iron rate = 1.0/sec
    expect(user.iron).toBeCloseTo(10, 5);
  });

  test('updateStats_withBonuses_usesIronRechargeRate', () => {
    const user = makeUser();
    const bonuses = makeLevel1Bonuses(user);
    // Override iron rate to 2.5/sec (e.g., level 2 bonus)
    bonuses.ironRechargeRate = 2.5;
    user.updateStats(1010, bonuses);
    expect(user.iron).toBeCloseTo(25, 5); // 2.5 × 10s
  });

  test('updateStats_withBonuses_capsAtIronStorageCapacity', () => {
    const user = makeUser({ iron: 4990 });
    const bonuses = makeLevel1Bonuses(user);
    // Set bonused capacity to 5100 (> default 5000)
    bonuses.ironStorageCapacity = 5100;
    user.updateStats(1200, bonuses); // 200 seconds pass
    expect(user.iron).toBe(5100); // capped at bonused capacity
  });

  test('updateStats_bonusedCapacityLowerThanResearch_capsAtBonusedValue', () => {
    const user = makeUser({ iron: 0 });
    const bonuses = makeLevel1Bonuses(user);
    // Set a lower bonused capacity to verify it is used over the research value
    bonuses.ironStorageCapacity = 100;
    bonuses.ironRechargeRate = 10; // fast accumulation
    user.updateStats(1200, bonuses); // 200 seconds pass → 2000 iron but capped at 100
    expect(user.iron).toBe(100);
  });

  test('updateStats_withLevel2Bonuses_ironRateScaledByLevelMultiplier', () => {
    const user = makeUser();
    const bonuses = makeLevel1Bonuses(user);
    // Simulate level 2: multiplier = 1.15, iron rate = 1.0 × 1.15 = 1.15
    bonuses.levelMultiplier = 1.15;
    bonuses.ironRechargeRate = 1.15;
    bonuses.ironStorageCapacity = 5000 * 1.15;
    user.updateStats(1010, bonuses);
    expect(user.iron).toBeCloseTo(11.5, 5); // 1.15 × 10s
  });
});

// ============================================================================
// Task 5.1.1 — mid-tick IronHarvesting research completion with bonuses
// ============================================================================

describe('Task 5.1.1 — mid-tick IronHarvesting with bonuses', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('midTick_researchCompletes_usesLevelMultiplierForNewRate', () => {
    const user = makeUser();
    // Start IronHarvesting research (duration 10s at level 1→2)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);

    const bonuses = makeLevel1Bonuses(user);
    // With level 2 bonus: levelMultiplier = 1.15
    bonuses.levelMultiplier = 1.15;
    bonuses.ironRechargeRate = 1.0 * 1.15; // old rate × levelMult
    bonuses.ironStorageCapacity = 5000 * 1.15;

    // 15s pass: research completes at t+10, then 5s at new rate
    // Old rate (before completion): 1.0 iron/sec
    // New rate (after completion): 1.1 × 1.15 = 1.265 iron/sec
    user.updateStats(1015, bonuses);

    // Pre-completion: 1.15 × 10 = 11.5
    // Post-completion: 1.265 × 5 = 6.325
    // Total: 17.825
    const newIronRate = getResearchEffectFromTree(user.techTree, ResearchType.IronHarvesting) * 1.15;
    const expected = bonuses.ironRechargeRate * 10 + newIronRate * 5;
    expect(user.iron).toBeCloseTo(expected, 4);
    expect(user.techTree.ironHarvesting).toBe(2); // research completed
  });

  test('midTick_researchCompletes_noBonuses_fallsBackToTechTree', () => {
    const user = makeUser();
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // No bonuses — old behavior: pre: 1.0 * 10 = 10, post: 1.1 * 5 = 5.5
    user.updateStats(1015);
    expect(user.iron).toBeCloseTo(10 + 5 * 1.1, 5);
    expect(user.techTree.ironHarvesting).toBe(2);
  });
});

// ============================================================================
// Task 5.3.1 — calculateMaxDefense() with levelMultiplier
// ============================================================================

describe('Task 5.3.1 — calculateMaxDefense() with levelMultiplier', () => {
  const techCounts = { ...DEFAULT_TECH_COUNTS, ship_hull: 2, kinetic_armor: 2, energy_shield: 2 };
  const techTree = createInitialTechTree();

  test('calculateMaxDefense_level1_multiplierIsOne_sameAsBase', () => {
    const base = TechService.calculateMaxDefense(techCounts, techTree);
    const withOne = TechService.calculateMaxDefense(techCounts, techTree, 1.0);
    expect(withOne.hull).toBe(base.hull);
    expect(withOne.armor).toBe(base.armor);
    expect(withOne.shield).toBe(base.shield);
  });

  test('calculateMaxDefense_level2_multiplierScalesValues', () => {
    const base = TechService.calculateMaxDefense(techCounts, techTree, 1.0);
    const level2 = TechService.calculateMaxDefense(techCounts, techTree, 1.15);
    expect(level2.hull).toBe(Math.round(base.hull * 1.15));
    expect(level2.armor).toBe(Math.round(base.armor * 1.15));
    expect(level2.shield).toBe(Math.round(base.shield * 1.15));
  });

  test('calculateMaxDefense_defaultMultiplier_isOne', () => {
    // Calling without multiplier should equal calling with 1.0
    const noParam = TechService.calculateMaxDefense(techCounts, techTree);
    const withOne = TechService.calculateMaxDefense(techCounts, techTree, 1.0);
    expect(noParam.hull).toBe(withOne.hull);
    expect(noParam.armor).toBe(withOne.armor);
    expect(noParam.shield).toBe(withOne.shield);
  });
});

// ============================================================================
// Task 5.3.2 — getDefenseStats() uses regen rates
// ============================================================================

describe('Task 5.3.2 — getDefenseStats() with bonused regen rates', () => {
  const techCounts = { ...DEFAULT_TECH_COUNTS, ship_hull: 2, kinetic_armor: 2, energy_shield: 2 };
  const techTree = createInitialTechTree();
  const currentValues = { hull: 100, armor: 100, shield: 100 };

  test('getDefenseStats_defaultRegenRates_areOne', () => {
    const result = TechService.getDefenseStats(techCounts, techTree, currentValues);
    expect(result.hull.regenRate).toBe(1);
    expect(result.armor.regenRate).toBe(1);
    expect(result.shield.regenRate).toBe(1);
  });

  test('getDefenseStats_bonusedRegenRates_overrideDefaults', () => {
    const regenRates = { hull: 1.5, armor: 2.0, shield: 1.3 };
    const result = TechService.getDefenseStats(techCounts, techTree, currentValues, 1.0, regenRates);
    expect(result.hull.regenRate).toBe(1.5);
    expect(result.armor.regenRate).toBe(2.0);
    expect(result.shield.regenRate).toBe(1.3);
  });

  test('getDefenseStats_withLevelMultiplier_scalesMaxValues', () => {
    const base = TechService.getDefenseStats(techCounts, techTree, currentValues, 1.0);
    const level2 = TechService.getDefenseStats(techCounts, techTree, currentValues, 1.15);
    expect(level2.hull.max).toBe(Math.round(base.hull.max * 1.15));
    expect(level2.armor.max).toBe(Math.round(base.armor.max * 1.15));
    expect(level2.shield.max).toBe(Math.round(base.shield.max * 1.15));
  });

  test('getDefenseStats_currentValues_unchanged', () => {
    const regenRates = { hull: 2.0, armor: 2.0, shield: 2.0 };
    const result = TechService.getDefenseStats(techCounts, techTree, currentValues, 1.15, regenRates);
    expect(result.hull.current).toBe(100);
    expect(result.armor.current).toBe(100);
    expect(result.shield.current).toBe(100);
  });
});

// ============================================================================
// Task 5.3.2 — updateDefenseValues() with bonused regen rates
// ============================================================================

describe('Task 5.3.2 — updateDefenseValues() with bonuses', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const techCounts = { ...DEFAULT_TECH_COUNTS, ship_hull: 2, kinetic_armor: 2, energy_shield: 2 };

  test('updateDefenseValues_noBonuses_regenRate1PerSec', () => {
    const user = makeUser({ hullCurrent: 0, armorCurrent: 0, shieldCurrent: 0, defenseLastRegen: 1000 });
    user.techCounts = { ...techCounts };
    user.updateDefenseValues(1010); // 10s elapsed, no bonuses
    // Base regen = 1/sec, so 10 each
    expect(user.hullCurrent).toBeCloseTo(10, 5);
    expect(user.armorCurrent).toBeCloseTo(10, 5);
    expect(user.shieldCurrent).toBeCloseTo(10, 5);
  });

  test('updateDefenseValues_withBonuses_usesHullRepairSpeed', () => {
    const user = makeUser({ hullCurrent: 0, armorCurrent: 0, shieldCurrent: 0, defenseLastRegen: 1000 });
    user.techCounts = { ...techCounts };
    const bonuses = makeLevel1Bonuses(user);
    bonuses.hullRepairSpeed = 2.5;
    bonuses.armorRepairSpeed = 1.0;
    bonuses.shieldRechargeRate = 3.0;
    user.updateDefenseValues(1010, bonuses); // 10s elapsed
    expect(user.hullCurrent).toBeCloseTo(25, 4);   // 2.5 × 10
    expect(user.armorCurrent).toBeCloseTo(10, 4);  // 1.0 × 10
    expect(user.shieldCurrent).toBeCloseTo(30, 4); // 3.0 × 10
  });

  test('updateDefenseValues_withLevel2Bonuses_maxDefenseScaledByLevelMultiplier', () => {
    // With 1 ship_hull (150 base), hullFactor at base level = 100/100 = 1.0
    // maxHull without bonus = 150 * 1.0 = 150
    // maxHull with level 2 bonus = 150 * 1.15 = 172.5 → rounded to 173
    const user = makeUser({ hullCurrent: 0, armorCurrent: 0, shieldCurrent: 0, defenseLastRegen: 1000 });
    user.techCounts = { ...DEFAULT_TECH_COUNTS, ship_hull: 1, kinetic_armor: 1, energy_shield: 1 };
    const bonuses = makeLevel1Bonuses(user);
    bonuses.levelMultiplier = 1.15;
    bonuses.hullRepairSpeed = 100; // high regen to hit max quickly
    bonuses.armorRepairSpeed = 100;
    bonuses.shieldRechargeRate = 100;
    user.updateDefenseValues(1010, bonuses); // 10s at 100/sec → hits max
    const expectedMaxHull = Math.round(150 * (100 / 100) * 1.15); // 150 * 1.15 = 172.5 → 173 (rounded)
    expect(user.hullCurrent).toBe(expectedMaxHull);
  });
});

// ============================================================================
// Task 5.4.1 — TechFactory.calculateWeaponReloadTime() with totalReloadFactor
// ============================================================================

describe('Task 5.4.1 — calculateWeaponReloadTime() with totalReloadFactor', () => {
  const techTree = createInitialTechTree();

  test('calculateWeaponReloadTime_noFactor_usesResearchFromTree', () => {
    // auto_turret: 12 min × 60 = 720s base, at base ProjectileReloadRate level 1,
    // effect = 10% → speedFactor = 1/0.9 ≈ 1.111 → 720 / 1.111 ≈ 648s
    const result = TechFactory.calculateWeaponReloadTime('auto_turret', techTree);
    // At ProjectileReloadRate level 1, effect = 10 → speedFactor = 1 / (1 - 0.1) = 1/0.9
    const speedFactor = 1 / (1 - 10 / 100); // 1/0.9
    expect(result).toBeCloseTo(720 / speedFactor, 4);
  });

  test('calculateWeaponReloadTime_withResearchFactor_identicalToNone', () => {
    // When passing the same factor the tree produces, result should match
    const base = TechFactory.calculateWeaponReloadTime('auto_turret', techTree);
    const speedFactor = 1 / (1 - 10 / 100); // research level 1 factor
    const withFactor = TechFactory.calculateWeaponReloadTime('auto_turret', techTree, speedFactor);
    expect(withFactor).toBeCloseTo(base, 4);
  });

  test('calculateWeaponReloadTime_withHigherFactor_producesFasterReload', () => {
    // Double the speed factor → half the cooldown
    const speedFactor = 1 / (1 - 10 / 100); // research level 1
    const base = TechFactory.calculateWeaponReloadTime('auto_turret', techTree, speedFactor);
    const faster = TechFactory.calculateWeaponReloadTime('auto_turret', techTree, speedFactor * 2);
    expect(faster).toBeCloseTo(base / 2, 4);
  });

  test('calculateWeaponReloadTime_withFactor1_returnsRawBaseCooldown', () => {
    // factor = 1.0 means "no research bonus" — returns raw base cooldown
    const result = TechFactory.calculateWeaponReloadTime('auto_turret', techTree, 1.0);
    expect(result).toBeCloseTo(720, 4); // 12min × 60s = 720s
  });

  test('calculateWeaponReloadTime_energyWeapon_withFactor_works', () => {
    // pulse_laser: 12 min × 60 = 720s base
    const factor = 1.5; // arbitrary bonus factor
    const result = TechFactory.calculateWeaponReloadTime('pulse_laser', techTree, factor);
    expect(result).toBeCloseTo(720 / factor, 4);
  });
});

// ============================================================================
// addIron() with optional maxCapacity
// ============================================================================

describe('addIron() with optional maxCapacity', () => {
  test('addIron_noMaxCapacity_usesResearchCapacity', () => {
    const user = makeUser({ iron: 4900 });
    // Default capacity = 5000 (level 1)
    user.addIron(200);
    expect(user.iron).toBe(5000); // capped at 5000
  });

  test('addIron_withHigherBonusedCapacity_capsAtBonusedValue', () => {
    const user = makeUser({ iron: 4900 });
    // Pass a higher bonused capacity
    user.addIron(200, 5200);
    expect(user.iron).toBe(5100); // 4900 + 200 = 5100, below 5200
  });

  test('addIron_withLowerBonusedCapacity_capsAtBonusedValue', () => {
    const user = makeUser({ iron: 90 });
    user.addIron(200, 100); // bonused cap = 100
    expect(user.iron).toBe(100); // capped at bonused 100
  });

  test('addIron_noCapacityParam_behavesSameAsResearchBased', () => {
    const user1 = makeUser({ iron: 0 });
    const user2 = makeUser({ iron: 0 });
    // Both add same amount; user1 via optional param, user2 via no param
    const capacity = user1.getMaxIronCapacity();
    user1.addIron(50, capacity);
    user2.addIron(50);
    expect(user1.iron).toBe(user2.iron);
  });
});
