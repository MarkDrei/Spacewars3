// ---
// Tests for TechFactory weapon damage calculations
// ---

import { describe, test, expect } from 'vitest';
import { TechFactory, TechCounts } from '../src/TechFactory.js';

describe('TechFactory.calculateWeaponDamage', () => {
  const defaultTechCounts: TechCounts = {
    pulse_laser: 2,
    auto_turret: 3,
    plasma_lance: 1,
    gauss_rifle: 2,
    photon_torpedo: 1,
    rocket_launcher: 1,
    kinetic_armor: 5,
    energy_shield: 5,
    missile_jammer: 0
  };

  // Helper function for cleaner test calls
  const calculateDamage = async (
    weaponKey: string,
    opponentShield: number = 100,
    positiveAccuracy: number = 0,
    negativeAccuracy: number = 0,
    damageModifier: number = 1.0,
    ecmEffectiveness: number = 0,
    spread: number = 1.0,
    techCounts: TechCounts = defaultTechCounts
  ) => {
    return TechFactory.calculateWeaponDamage(
      weaponKey,
      techCounts,
      opponentShield,
      positiveAccuracy,
      negativeAccuracy,
      damageModifier,
      ecmEffectiveness,
      spread
    );
  };

  describe('basic weapon functionality', () => {
    test('calculateWeaponDamage_unknownWeapon_throwsError', async () => {
      await expect(calculateDamage('invalid_weapon')).rejects.toThrow('Unknown weapon: invalid_weapon');
    });

    test('calculateWeaponDamage_zeroWeapons_returnsZeroDamage', async () => {
      const zeroWeapons: TechCounts = { ...defaultTechCounts, auto_turret: 0 };
      const result = await calculateDamage('auto_turret', 100, 0, 0, 1.0, 0, 1.0, zeroWeapons);
      
      expect(result.weaponsHit).toBe(0);
      expect(result.shieldDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_perfectAccuracy_allWeaponsHit', async () => {
      // Auto turret: base 50% + 50% modifier = 100% accuracy
      const result = await calculateDamage('auto_turret', 100, 50, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(3); // Should hit with all 3 auto turrets
    });

    test('calculateWeaponDamage_zeroAccuracy_noWeaponsHit', async () => {
      // Auto turret: base 50% accuracy completely negated
      const result = await calculateDamage('auto_turret', 100, 0, 1, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(0);
      expect(result.shieldDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });
  });

  describe('accuracy calculations by weapon type', () => {
    test('calculateWeaponDamage_autoTurret_standardAccuracyCalculation', async () => {
      // Auto turret: (50 + 10) * (1 - 0.2) = 60 * 0.8 = 48%
      // 3 weapons * 48% * 1.0 spread = 1.44 → 1 weapon hits
      const result = await calculateDamage('auto_turret', 100, 10, 0.2, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_rocketLauncher_ecmAffectsAccuracy', async () => {
      // Rocket launcher: (100 + 0) * (1 - 0.3) = 100 * 0.7 = 70%
      // 1 weapon * 70% * 1.0 spread = 0.7 → 1 weapon hits (rounded)
      const result = await calculateDamage('rocket_launcher', 100, 0, 0.1, 1.0, 0.3, 1.0);
      
      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_rocketLauncher_negativeAccuracyIgnored', async () => {
      // Rocket launcher: (100 + 0) * (1 - 0.2) = 100 * 0.8 = 80% (negative accuracy ignored)
      const result = await calculateDamage('rocket_launcher', 100, 0, 0.5, 1.0, 0.2, 1.0);
      
      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_photonTorpedo_reducedEcmAndNegativeEffect', async () => {
      // Photon torpedo: (75 + 5) * (1 - 0.3/3) * (1 - 0.3/3) = 80 * 0.9 * 0.9 = 64.8%
      const result = await calculateDamage('photon_torpedo', 100, 5, 0.3, 1.0, 0.3, 1.0);
      
      expect(result.weaponsHit).toBe(1); // 0.648 rounds to 1
    });
  });

  describe('spread value effects', () => {
    test('calculateWeaponDamage_lowSpread_fewerHits', async () => {
      // Perfect accuracy but low spread: 100% * 3 weapons * 0.8 = 2.4 → 2 hits
      const result = await calculateDamage('auto_turret', 100, 50, 0, 1.0, 0, 0.8);
      
      expect(result.weaponsHit).toBe(2);
    });

    test('calculateWeaponDamage_highSpread_moreHits', async () => {
      // High spread: 50% * 3 weapons * 1.2 = 1.8 → 2 hits
      const result = await calculateDamage('auto_turret', 100, 0, 0, 1.0, 0, 1.2);
      
      expect(result.weaponsHit).toBe(2);
    });

    test('calculateWeaponDamage_spreadCannotExceedWeaponCount', async () => {
      // Even with high spread, cannot exceed weapon count
      const result = await calculateDamage('auto_turret', 100, 100, 0, 1.0, 0, 1.2);
      
      expect(result.weaponsHit).toBe(3); // Capped at 3 weapons
    });
  });

  describe('projectile weapon damage calculations', () => {
    test('calculateWeaponDamage_autoTurret_projectileShieldPenalty', async () => {
      // Auto turret: 1 hit * 10 damage * 1.0 modifier = 10 total damage
      // Shield damage: 10 * 0.8 / 2 = 4 (halved for projectile)
      // Hull damage: 10 * 0.2 = 2
      const result = await calculateDamage('auto_turret', 100, 50, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(3);
      expect(result.shieldDamage).toBe(12); // 3 * 4
      expect(result.hullDamage).toBe(6); // 3 * 2
    });

    test('calculateWeaponDamage_gaussRifle_highHullDamage', async () => {
      // Gauss rifle: 2 hits * 40 damage * 1.0 = 80 total damage
      // Shield damage: 80 * 0.1 / 2 = 4 (halved for projectile)
      // Hull damage: 80 * 0.9 = 72
      const result = await calculateDamage('gauss_rifle', 100, 30, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(2);
      expect(result.shieldDamage).toBe(4);
      expect(result.hullDamage).toBe(72);
    });

    test('calculateWeaponDamage_projectile_excessShieldDamageDoubled', async () => {
      // Auto turret vs low shields: shield damage would be 12, but only 5 shields available
      // Excess: 12 - 5 = 7, doubled back to 14 for hull damage
      // Hull damage: (30 * 0.2) + 14 = 6 + 14 = 20
      const result = await calculateDamage('auto_turret', 5, 50, 0, 1.0, 0, 1.0);
      
      expect(result.shieldDamage).toBe(5); // Limited by available shields
      expect(result.hullDamage).toBe(20); // Base hull + doubled excess
    });
  });

  describe('energy weapon damage calculations', () => {
    test('calculateWeaponDamage_pulseLaser_energyHullPenalty', async () => {
      // Pulse laser: 2 hits * 7 damage * 1.0 = 14 total damage
      // Shield damage: 14 * 0.9 = 12.6 → 13 (no penalty for energy vs shields)
      // Hull damage: (14 * 0.1) / 2 = 0.7 → 1 (halved for energy vs hull)
      const result = await calculateDamage('pulse_laser', 100, 20, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(2);
      expect(result.shieldDamage).toBe(13);
      expect(result.hullDamage).toBe(1);
    });

    test('calculateWeaponDamage_plasmaLance_balancedDamage', async () => {
      // Plasma lance: 1 hit * 30 damage * 1.0 = 30 total damage
      // Shield damage: 30 * 0.7 = 21
      // Hull damage: (30 * 0.3) / 2 = 4.5 → 5
      const result = await calculateDamage('plasma_lance', 100, 10, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(1);
      expect(result.shieldDamage).toBe(21);
      expect(result.hullDamage).toBe(5);
    });

    test('calculateWeaponDamage_photonTorpedo_highShieldDamage', async () => {
      // Photon torpedo: 1 hit * 200 damage * 1.0 = 200 total damage
      // Shield damage: 200 * 0.9 = 180
      // Hull damage: (200 * 0.1) / 2 = 10
      const result = await calculateDamage('photon_torpedo', 200, 25, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(1);
      expect(result.shieldDamage).toBe(180);
      expect(result.hullDamage).toBe(10);
    });

    test('calculateWeaponDamage_energy_excessShieldDamageNotDoubled', async () => {
      // Photon torpedo vs low shields: shield damage 180, but only 50 shields
      // Excess: 180 - 50 = 130 (not doubled for energy weapons)
      // Hull damage: (200 * 0.1 + 130) / 2 = 150 / 2 = 75
      const result = await calculateDamage('photon_torpedo', 50, 25, 0, 1.0, 0, 1.0);
      
      expect(result.shieldDamage).toBe(50);
      expect(result.hullDamage).toBe(75);
    });
  });

  describe('damage modifier effects', () => {
    test('calculateWeaponDamage_doubleDamageModifier_doublesDamage', async () => {
      // Auto turret with 2x damage modifier
      const normalResult = await calculateDamage('auto_turret', 100, 50, 0, 1.0, 0, 1.0);
      const doubledResult = await calculateDamage('auto_turret', 100, 50, 0, 2.0, 0, 1.0);
      
      expect(doubledResult.shieldDamage).toBe(normalResult.shieldDamage * 2);
      expect(doubledResult.hullDamage).toBe(normalResult.hullDamage * 2);
    });

    test('calculateWeaponDamage_halfDamageModifier_halvesDamage', async () => {
      const result = await calculateDamage('gauss_rifle', 100, 30, 0, 0.5, 0, 1.0);
      
      // Gauss rifle: 2 hits * 40 damage * 0.5 = 40 total damage
      // Shield: 40 * 0.1 / 2 = 2
      // Hull: 40 * 0.9 = 36
      expect(result.shieldDamage).toBe(2);
      expect(result.hullDamage).toBe(36);
    });
  });

  describe('edge cases', () => {
    test('calculateWeaponDamage_noShields_allDamageToHull', async () => {
      const result = await calculateDamage('auto_turret', 0, 50, 0, 1.0, 0, 1.0);
      
      // All shield damage becomes excess and goes to hull
      expect(result.shieldDamage).toBe(0);
      expect(result.hullDamage).toBe(30); // Base hull (6) + doubled excess (24)
    });

    test('calculateWeaponDamage_maxEcm_rocketLauncherMisses', async () => {
      const result = await calculateDamage('rocket_launcher', 100, 0, 0, 1.0, 1.0, 1.0);
      
      // 100% ECM completely negates rocket launcher
      expect(result.weaponsHit).toBe(0);
    });

    test('calculateWeaponDamage_maxNegativeAccuracy_conventionalWeaponMisses', async () => {
      const result = await calculateDamage('auto_turret', 100, 0, 1.0, 1.0, 0, 1.0);
      
      // 100% negative accuracy completely negates auto turret
      expect(result.weaponsHit).toBe(0);
    });

    test('calculateWeaponDamage_extremeSpread_stillCappedAtWeaponCount', async () => {
      const singleWeapon: TechCounts = { ...defaultTechCounts, auto_turret: 1 };
      const result = await calculateDamage('auto_turret', 100, 100, 0, 1.0, 0, 2.0, singleWeapon);
      
      expect(result.weaponsHit).toBe(1); // Cannot exceed 1 weapon
    });
  });

  describe('comprehensive weapon tests', () => {
    test('calculateWeaponDamage_allWeaponTypes_producesExpectedResults', async () => {
      const testCases = [
        { weapon: 'auto_turret', expectedHits: 2, minShield: 8, minHull: 4 },
        { weapon: 'pulse_laser', expectedHits: 2, minShield: 10, minHull: 1 },
        { weapon: 'gauss_rifle', expectedHits: 2, minShield: 2, minHull: 60 },
        { weapon: 'plasma_lance', expectedHits: 1, minShield: 15, minHull: 3 },
        { weapon: 'rocket_launcher', expectedHits: 1, minShield: 40, minHull: 80 },
        { weapon: 'photon_torpedo', expectedHits: 1, minShield: 150, minHull: 8 }
      ];

      for (const testCase of testCases) {
        const result = await calculateDamage(testCase.weapon, 200, 25, 0, 1.0, 0, 1.0);
        
        expect(result.weaponsHit).toBe(testCase.expectedHits);
        expect(result.shieldDamage).toBeGreaterThanOrEqual(testCase.minShield);
        expect(result.hullDamage).toBeGreaterThanOrEqual(testCase.minHull);
      }
    });
  });
});
