// ---
// Numeric equivalence and API documentation tests for weapon modifier functions:
// - Task 1.1: Accuracy modifier (additive → multiplicative, baseValue now 100 for all)
// - Task 1.2: Reload modifier (speed factor = effect/baseValue, baseValue now 100 for all)
//
// These tests document the API behaviour at research levels 1–10.
//
// ACCEPTED BALANCE CHANGE — Task 1.1 Accuracy:
// Accuracy base values changed from (Projectile: 70, Energy: 65) to 100 for both.
// The old additive formula (baseAccuracy + (effect - researchBaseValue)) and the
// new multiplicative formula (baseAccuracy × effect/researchBaseValue) only coincide
// at level 1 (where effect === baseValue). At levels 2+, the new formula gives lower
// accuracy than the old additive formula. This delta is an accepted balance trade-off.
//
// ACCEPTED BALANCE CHANGE — Task 1.2 Reload:
// Reload base values changed from (Projectile: 10, Energy: 15) to 100 for both.
// The new formula is speedFactor = effect / baseValue (= effect / 100).
// Level 1 now gives speedFactor = 1.0 (no speedup — 100% is the baseline).
// Each subsequent level adds +10 to effect → +0.10 to speed factor.
// ---

import { describe, test, expect } from 'vitest';
import {
  AllResearches,
  ResearchType,
  getResearchEffect,
  getWeaponAccuracyModifierFromTree,
  getWeaponReloadTimeModifierFromTree,
  createInitialTechTree,
} from '@/lib/server/techs/techtree';
import { TechFactory } from '@/lib/server/techs/TechFactory';

// ---------------------------------------------------------------------------
// Helper: build a TechTree with a specific research level
// ---------------------------------------------------------------------------

function treeAt(projectileAccuracy: number, energyAccuracy: number, projectileReload: number, energyRecharge: number) {
  const tree = createInitialTechTree();
  tree.projectileAccuracy = projectileAccuracy;
  tree.energyAccuracy = energyAccuracy;
  tree.projectileReloadRate = projectileReload;
  tree.energyRechargeRate = energyRecharge;
  return tree;
}

// ---------------------------------------------------------------------------
// Task 1.1 — Accuracy modifier: new API returns effect / baseValue (factor ≥ 1.0)
// ---------------------------------------------------------------------------

describe('Task 1.1 – Accuracy modifier multiplicative refactor', () => {
  describe('projectile accuracy factor at levels 1–10', () => {
    const projectileBaseValue = AllResearches[ResearchType.ProjectileAccuracy].baseValue; // 100

    for (let level = 1; level <= 10; level++) {
      test(`projectileAccuracy_level${level}_factorEqualsEffectDividedByBase`, () => {
        const tree = createInitialTechTree();
        tree.projectileAccuracy = level;

        const factor = getWeaponAccuracyModifierFromTree(tree, 'auto_turret');
        const effect = getResearchEffect(AllResearches[ResearchType.ProjectileAccuracy], level);
        const expectedFactor = effect / projectileBaseValue;

        expect(factor).toBeCloseTo(expectedFactor, 5);
        // Factor is always ≥ 1.0 for levels ≥ 1
        expect(factor).toBeGreaterThanOrEqual(1.0);
      });
    }

    test('projectileAccuracy_level1_factorIs1', () => {
      const tree = treeAt(1, 1, 1, 1);
      expect(getWeaponAccuracyModifierFromTree(tree, 'auto_turret')).toBeCloseTo(1.0);
    });

    test('projectileAccuracy_level1_finalAccuracyEqualToOldFormula', () => {
      // Old formula: baseAccuracy + 0 = baseAccuracy (modifier was 0 at level 1)
      // New formula: baseAccuracy × 1.0 = baseAccuracy
      const auto_turret_baseAccuracy = 50;
      const tree = treeAt(1, 1, 1, 1);
      const factor = getWeaponAccuracyModifierFromTree(tree, 'auto_turret');
      expect(auto_turret_baseAccuracy * factor).toBeCloseTo(auto_turret_baseAccuracy);
    });

    test('projectileAccuracy_increasingLevels_factorMonotonicallyIncreases', () => {
      let prevFactor = 0;
      for (let level = 1; level <= 10; level++) {
        const tree = createInitialTechTree();
        tree.projectileAccuracy = level;
        const factor = getWeaponAccuracyModifierFromTree(tree, 'auto_turret');
        expect(factor).toBeGreaterThanOrEqual(prevFactor);
        prevFactor = factor;
      }
    });
  });

  describe('energy accuracy factor at levels 1–10', () => {
    const energyBaseValue = AllResearches[ResearchType.EnergyAccuracy].baseValue; // 100

    for (let level = 1; level <= 10; level++) {
      test(`energyAccuracy_level${level}_factorEqualsEffectDividedByBase`, () => {
        const tree = createInitialTechTree();
        tree.energyAccuracy = level;

        const factor = getWeaponAccuracyModifierFromTree(tree, 'pulse_laser');
        const effect = getResearchEffect(AllResearches[ResearchType.EnergyAccuracy], level);
        const expectedFactor = effect / energyBaseValue;

        expect(factor).toBeCloseTo(expectedFactor, 5);
        expect(factor).toBeGreaterThanOrEqual(1.0);
      });
    }

    test('energyAccuracy_level1_factorIs1', () => {
      const tree = treeAt(1, 1, 1, 1);
      expect(getWeaponAccuracyModifierFromTree(tree, 'pulse_laser')).toBeCloseTo(1.0);
    });
  });

  // ---------------------------------------------------------------------------
  // Old-vs-new accuracy comparison at levels 2–10 (projectile)
  //
  // Documents the accepted balance divergence between:
  //   Old additive formula: finalAccuracy = baseAccuracy + (effect - researchBaseValue)
  //   New multiplicative formula: finalAccuracy = baseAccuracy × (effect / researchBaseValue)
  //
  // For auto_turret (baseAccuracy=50) with ProjectileAccuracy baseValue=100:
  //   Level 2:  old=67.25pp,  new=58.625pp, delta=−8.625pp
  //   Level 5:  old=146.00pp, new=98.000pp, delta=−48.000pp
  // These tests assert the divergence is present (not hidden).
  // ---------------------------------------------------------------------------
  describe('projectile accuracy old-vs-new comparison at levels 2–10 (accepted balance delta)', () => {
    const AUTO_TURRET_BASE_ACCURACY = 50;
    const PROJ_RESEARCH_BASE_VALUE = AllResearches[ResearchType.ProjectileAccuracy].baseValue; // 100

    // Level 1: formulas coincide (both produce exactly baseAccuracy = 50)
    test('projectileAccuracy_level1_oldAndNewFormulasAreEqual', () => {
      const effect = getResearchEffect(AllResearches[ResearchType.ProjectileAccuracy], 1);
      const oldFinalAccuracy = AUTO_TURRET_BASE_ACCURACY + (effect - PROJ_RESEARCH_BASE_VALUE);
      const factor = effect / PROJ_RESEARCH_BASE_VALUE;
      const newFinalAccuracy = AUTO_TURRET_BASE_ACCURACY * factor;
      // At level 1: effect === baseValue, so both formulas equal baseAccuracy
      expect(oldFinalAccuracy).toBeCloseTo(newFinalAccuracy, 5);
    });

    // Levels 2–10: new formula produces LOWER accuracy than the old additive formula.
    for (let level = 2; level <= 10; level++) {
      test(`projectileAccuracy_level${level}_newFormulaIsLowerThanOldAdditive`, () => {
        const effect = getResearchEffect(AllResearches[ResearchType.ProjectileAccuracy], level);

        // Old additive formula (pre-refactor behaviour)
        const oldFinalAccuracy = AUTO_TURRET_BASE_ACCURACY + (effect - PROJ_RESEARCH_BASE_VALUE);

        // New multiplicative formula (post-refactor: factor applied to base)
        const factor = effect / PROJ_RESEARCH_BASE_VALUE;
        const newFinalAccuracy = AUTO_TURRET_BASE_ACCURACY * factor;

        // The new formula produces strictly lower accuracy at all levels 2+.
        expect(newFinalAccuracy).toBeLessThan(oldFinalAccuracy);
      });
    }
  });

  describe('energy accuracy old-vs-new comparison at levels 1–10 (accepted balance delta)', () => {
    // pulse_laser base accuracy = 65; EnergyAccuracy research baseValue = 100
    // These differ (65 ≠ 100), so old and new formulas diverge at levels 2+.
    const PULSE_LASER_BASE_ACCURACY = 65;
    const ENERGY_RESEARCH_BASE_VALUE = AllResearches[ResearchType.EnergyAccuracy].baseValue; // 100

    // Level 1: formulas coincide (effect === baseValue)
    test('energyAccuracy_level1_oldAndNewFormulasAreEqual', () => {
      const effect = getResearchEffect(AllResearches[ResearchType.EnergyAccuracy], 1);
      const oldFinalAccuracy = PULSE_LASER_BASE_ACCURACY + (effect - ENERGY_RESEARCH_BASE_VALUE);
      const factor = effect / ENERGY_RESEARCH_BASE_VALUE;
      const newFinalAccuracy = PULSE_LASER_BASE_ACCURACY * factor;
      expect(oldFinalAccuracy).toBeCloseTo(newFinalAccuracy, 5);
    });

    // Levels 2–10: new formula produces LOWER accuracy than the old additive formula.
    for (let level = 2; level <= 10; level++) {
      test(`energyAccuracy_level${level}_newFormulaIsLowerThanOldAdditive`, () => {
        const effect = getResearchEffect(AllResearches[ResearchType.EnergyAccuracy], level);

        const oldFinalAccuracy = PULSE_LASER_BASE_ACCURACY + (effect - ENERGY_RESEARCH_BASE_VALUE);
        const factor = effect / ENERGY_RESEARCH_BASE_VALUE;
        const newFinalAccuracy = PULSE_LASER_BASE_ACCURACY * factor;

        expect(newFinalAccuracy).toBeLessThan(oldFinalAccuracy);
      });
    }
  });

  describe('calculateWeaponDamage accuracy integration', () => {
    const defaultTechCounts = {
      pulse_laser: 2, auto_turret: 10, plasma_lance: 1, gauss_rifle: 2,
      photon_torpedo: 1, rocket_launcher: 1, kinetic_armor: 5, energy_shield: 5,
      missile_jammer: 0, ship_hull: 1,
    };

    test('accuracyFactor1_level1_sameFinalAccuracyAsOldZeroBonus', () => {
      // Old: baseAccuracy + 0 = 50%. New: 50 * 1.0 = 50%. Same result.
      const result = TechFactory.calculateWeaponDamage(
        'auto_turret', defaultTechCounts.auto_turret, 100, 100,
        1.0, 0, 1.0, 0, 1.0
      );
      // 10 weapons at 50% accuracy * 1.0 spread = 5 hit
      expect(result.weaponsHit).toBe(5);
    });

    test('accuracyFactor2_doubles_final_accuracy', () => {
      // 50 * 2.0 = 100% accuracy → all 10 weapons hit
      const result = TechFactory.calculateWeaponDamage(
        'auto_turret', defaultTechCounts.auto_turret, 100, 100,
        2.0, 0, 1.0, 0, 1.0
      );
      expect(result.weaponsHit).toBe(10);
    });

    test('accuracyFactor_unknownWeapon_returnsFactorOf1', () => {
      const tree = createInitialTechTree();
      const factor = getWeaponAccuracyModifierFromTree(tree, 'unknown_weapon');
      expect(factor).toBe(1.0);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 1.2 — Reload modifier: new API returns speed factor = effect / baseValue
// ---------------------------------------------------------------------------

describe('Task 1.2 – Reload modifier multiplicative refactor', () => {
  describe('projectile reload speed factor at levels 1–10', () => {
    const projectileReloadBaseValue = AllResearches[ResearchType.ProjectileReloadRate].baseValue; // 100

    for (let level = 1; level <= 10; level++) {
      test(`projectileReloadRate_level${level}_speedFactorEqualsEffectDividedByBase`, () => {
        const tree = createInitialTechTree();
        tree.projectileReloadRate = level;

        const speedFactor = getWeaponReloadTimeModifierFromTree(tree, 'auto_turret');
        const effect = getResearchEffect(AllResearches[ResearchType.ProjectileReloadRate], level);
        const expectedSpeedFactor = effect / projectileReloadBaseValue;

        expect(speedFactor).toBeCloseTo(expectedSpeedFactor, 5);
        // Speed factor is always ≥ 1.0 for levels ≥ 1 (100% baseline)
        expect(speedFactor).toBeGreaterThanOrEqual(1.0);
      });
    }
  });

  describe('energy reload speed factor at levels 1–10', () => {
    const energyRechargeBaseValue = AllResearches[ResearchType.EnergyRechargeRate].baseValue; // 100

    for (let level = 1; level <= 10; level++) {
      test(`energyRechargeRate_level${level}_speedFactorEqualsEffectDividedByBase`, () => {
        const tree = createInitialTechTree();
        tree.energyRechargeRate = level;

        const speedFactor = getWeaponReloadTimeModifierFromTree(tree, 'pulse_laser');
        const effect = getResearchEffect(AllResearches[ResearchType.EnergyRechargeRate], level);
        const expectedSpeedFactor = effect / energyRechargeBaseValue;

        expect(speedFactor).toBeCloseTo(expectedSpeedFactor, 5);
        expect(speedFactor).toBeGreaterThanOrEqual(1.0);
      });
    }
  });

  describe('calculateWeaponReloadTime numeric formula at levels 1–10', () => {
    // For each level, verify: baseCooldown / speedFactor === baseCooldown / (effect / 100)

    const AUTO_TURRET_BASE_COOLDOWN = 720; // reloadTimeMinutes=12 → 12*60=720s
    const PULSE_LASER_BASE_COOLDOWN = 720; // same

    for (let level = 1; level <= 10; level++) {
      test(`projectileReload_level${level}_reloadTimeMatchesNewFormula`, () => {
        const tree = createInitialTechTree();
        tree.projectileReloadRate = level;

        const effect = getResearchEffect(AllResearches[ResearchType.ProjectileReloadRate], level);
        const expectedReloadTime = AUTO_TURRET_BASE_COOLDOWN / (effect / 100);

        const newReloadTime = TechFactory.calculateWeaponReloadTime('auto_turret', tree);

        expect(newReloadTime).toBeCloseTo(expectedReloadTime, 5);
      });
    }

    for (let level = 1; level <= 10; level++) {
      test(`energyRecharge_level${level}_reloadTimeMatchesNewFormula`, () => {
        const tree = createInitialTechTree();
        tree.energyRechargeRate = level;

        const effect = getResearchEffect(AllResearches[ResearchType.EnergyRechargeRate], level);
        const expectedReloadTime = PULSE_LASER_BASE_COOLDOWN / (effect / 100);

        const newReloadTime = TechFactory.calculateWeaponReloadTime('pulse_laser', tree);

        expect(newReloadTime).toBeCloseTo(expectedReloadTime, 5);
      });
    }

    test('reloadTime_level0Research_noEffect', () => {
      const tree = createInitialTechTree();
      tree.projectileReloadRate = 0;
      const reloadTime = TechFactory.calculateWeaponReloadTime('auto_turret', tree);
      // Level 0: effect=0, speedFactor=1.0 (guard), baseCooldown/1.0 = baseCooldown
      expect(reloadTime).toBe(AUTO_TURRET_BASE_COOLDOWN);
    });

    test('reloadSpeedFactor_unknownWeapon_returns1', () => {
      const tree = createInitialTechTree();
      const factor = getWeaponReloadTimeModifierFromTree(tree, 'unknown_weapon');
      expect(factor).toBe(1.0);
    });

    test('reloadSpeedFactor_increasingLevels_factorMonotonicallyIncreases', () => {
      let prevFactor = 0;
      for (let level = 1; level <= 10; level++) {
        const tree = createInitialTechTree();
        tree.projectileReloadRate = level;
        const factor = getWeaponReloadTimeModifierFromTree(tree, 'auto_turret');
        expect(factor).toBeGreaterThanOrEqual(prevFactor);
        prevFactor = factor;
      }
    });
  });
});
