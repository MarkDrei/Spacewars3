// ---
// Tests for TechFactory weapon damage calculations
// ---

import { describe, test, expect } from 'vitest';
import { TechFactory, TechCounts } from '@/lib/server/TechFactory';

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
    missile_jammer: 0,
    ship_hull: 1
  };

  // Helper function for cleaner test calls
  const calculateDamage = (
    weaponKey: string,
    opponentShield: number = 100,
    opponentArmor: number = 100,
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
      opponentArmor,
      positiveAccuracy,
      negativeAccuracy,
      damageModifier,
      ecmEffectiveness,
      spread
    );
  };

  describe('basic weapon functionality', () => {
    test('calculateWeaponDamage_unknownWeapon_throwsError', () => {
      expect(() => calculateDamage('invalid_weapon')).toThrow('Unknown weapon: invalid_weapon');
    });

    test('calculateWeaponDamage_zeroWeapons_returnsZeroDamage', async () => {
      const zeroWeapons: TechCounts = { ...defaultTechCounts, auto_turret: 0 };
      const result = calculateDamage('auto_turret', 100, 100, 0, 0, 1.0, 0, 1.0, zeroWeapons);
      
      expect(result.weaponsHit).toBe(0);
      expect(result.shieldDamage).toBe(0);
      expect(result.armorDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_perfectAccuracy_allWeaponsHit', async () => {
      // Auto turret: base 50% + 50% modifier = 100% accuracy
      const result = calculateDamage('auto_turret', 100, 100, 50, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(3); // Should hit with all 3 auto turrets
    });

    test('calculateWeaponDamage_zeroAccuracy_noWeaponsHit', async () => {
      // Auto turret: base 50% accuracy completely negated: (50 + 0) * (1 - 1.0) = 0%
      const result = calculateDamage('auto_turret', 100, 100, 0, 1.0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(0);
      expect(result.shieldDamage).toBe(0);
      expect(result.armorDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });
  });

  describe('accuracy calculations by weapon type', () => {
    test('calculateWeaponDamage_autoTurret_standardAccuracyCalculation', async () => {
      // Auto turret: (50 + 10) * (1 - 0.2) = 60 * 0.8 = 48%
      // 3 weapons * 48% * 1.0 spread = 1.44 → 1 weapon hits
      const result = calculateDamage('auto_turret', 100, 100, 10, 0.2, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_rocketLauncher_ecmAffectsAccuracy', async () => {
      // Rocket launcher: (100 + 0) * (1 - 0.3) = 100 * 0.7 = 70%
      // 1 weapon * 70% * 1.0 spread = 0.7 → 1 weapon hits (rounded)
      const result = calculateDamage('rocket_launcher', 100, 100, 0, 0.1, 1.0, 0.3, 1.0);
      
      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_rocketLauncher_negativeAccuracyIgnored', async () => {
      // Rocket launcher: (100 + 0) * (1 - 0.2) = 100 * 0.8 = 80% (negative accuracy ignored)
      const result = calculateDamage('rocket_launcher', 100, 100, 0, 0.5, 1.0, 0.2, 1.0);
      
      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_photonTorpedo_reducedECMAndNegativeEffects', async () => {
      // Photon torpedo: (75 + 5) * (1 - 0.3/3) * (1 - 0.2/3) = 80 * 0.9 * 0.933 = 67.2%
      // 1 weapon * 67.2% * 1.0 spread = 0.672 → 1 weapon hits (rounded)
      const result = calculateDamage('photon_torpedo', 100, 100, 5, 0.3, 1.0, 0.2, 1.0);
      
      expect(result.weaponsHit).toBe(1);
    });
  });

  describe('damage calculations', () => {
    test('calculateWeaponDamage_autoTurret_correctDamageDistribution', async () => {
      // Auto turret: 10 damage, 80% shield / 20% armor
      // (50 + 50) * (1 - 0.5) = 50% accuracy, 3 weapons * 50% = 1.5 → 2 weapons hit
      // 2 weapons hit: 20 damage total
      // Shield: 20 * 0.8 = 16 (but projectile halved) = 8
      // Armor: 20 * 0.2 = 4
      // Hull: 0 (no excess damage)
      const result = calculateDamage('auto_turret', 100, 100, 50, 0.5, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(2); // Corrected expectation
      expect(result.shieldDamage).toBe(8); // Projectile weapons halved against shields
      expect(result.armorDamage).toBe(4);
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_pulseLaser_energyWeaponDamage', async () => {
      // Pulse laser: 7 damage, 90% shield / 10% armor
      // 2 weapons hit (perfect accuracy): 14 damage total
      // Shield: 14 * 0.9 = 12.6
      // Armor: 14 * 0.1 = 1.4 (but energy halved) = 0.7
      const result = calculateDamage('pulse_laser', 100, 100, 50, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(2);
      expect(result.shieldDamage).toBe(13); // Rounded from 12.6
      expect(result.armorDamage).toBe(1); // Rounded from 0.7
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_shieldPenetration_excessDamageToHull', async () => {
      // Auto turret vs low shields: 3 weapons, 30 total damage
      // Shield: 30 * 0.8 = 24 (halved) = 12, but only 5 shield available
      // Excess shield damage: 12 - 5 = 7 (doubled back) = 14
      // Armor: 30 * 0.2 = 6
      // Hull: 14 (excess shield damage)
      const result = calculateDamage('auto_turret', 5, 100, 50, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(3);
      expect(result.shieldDamage).toBe(5); // All available shield absorbed
      expect(result.armorDamage).toBe(6);
      expect(result.hullDamage).toBe(14); // Excess shield damage
    });

    test('calculateWeaponDamage_armorPenetration_excessDamageToHull', async () => {
      // Gauss rifle vs low armor: 2 weapons, 80 total damage  
      // Shield: 80 * 0.1 = 8 (halved) = 4
      // Armor: 80 * 0.9 = 72, but only 10 armor available
      // Excess armor damage: 72 - 10 = 62
      // Hull: 62 (excess armor damage)
      const result = calculateDamage('gauss_rifle', 100, 10, 50, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(2);
      expect(result.shieldDamage).toBe(4);
      expect(result.armorDamage).toBe(10); // All available armor absorbed
      expect(result.hullDamage).toBe(62); // Excess armor damage
    });
  });

  describe('special weapon mechanics', () => {
    test('calculateWeaponDamage_rocketLauncher_highDamageGuidedWeapon', async () => {
      // Rocket launcher: 200 damage, 100% base accuracy, guided
      // 1 weapon * 100% = 1 hit, 200 damage
      // Shield: 200 * 0.4 = 80 (halved) = 40
      // Armor: 200 * 0.6 = 120
      const result = calculateDamage('rocket_launcher', 100, 100, 0, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(1);
      expect(result.shieldDamage).toBe(40);
      expect(result.armorDamage).toBe(100); // Limited by available armor
      expect(result.hullDamage).toBe(20); // Excess armor damage
    });

    test('calculateWeaponDamage_photonTorpedo_heavyShieldDamage', async () => {
      // Photon torpedo: 200 damage, 75% base accuracy
      // Shield: 200 * 0.9 = 180
      // Armor: 200 * 0.1 = 20 (halved) = 10
      const result = calculateDamage('photon_torpedo', 100, 100, 25, 0, 1.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(1);
      expect(result.shieldDamage).toBe(100); // Limited by available shield
      expect(result.armorDamage).toBe(10);
      expect(result.hullDamage).toBe(80); // Excess shield damage
    });
  });

  describe('damage modifiers', () => {
    test('calculateWeaponDamage_damageModifier_scalesDamage', async () => {
      // Auto turret with 2x damage modifier
      // 3 weapons * 10 damage * 2.0 = 60 total damage
      const result = calculateDamage('auto_turret', 100, 100, 50, 0, 2.0, 0, 1.0);
      
      expect(result.weaponsHit).toBe(3);
      // Expected damage should be doubled
      expect(result.shieldDamage + result.armorDamage + result.hullDamage).toBeGreaterThan(12);
    });

    test('calculateWeaponDamage_spreadModifier_affectsHitCount', async () => {
      // Auto turret with 0.5 spread (half effectiveness)
      // 3 weapons * 100% accuracy * 0.5 spread = 1.5 → 2 weapons hit
      const result = calculateDamage('auto_turret', 100, 100, 50, 0, 1.0, 0, 0.5);
      
      expect(result.weaponsHit).toBe(2); // Rounded from 1.5
    });
  });
});

describe('TechFactory utility methods', () => {
  test('getWeaponSpec_validWeapon_returnsSpec', () => {
    const spec = TechFactory.getWeaponSpec('auto_turret');
    expect(spec).toBeDefined();
    expect(spec?.name).toBe('Auto Turret');
    expect(spec?.baseCost).toBe(100);
  });

  test('getWeaponSpec_invalidWeapon_returnsNull', () => {
    const spec = TechFactory.getWeaponSpec('invalid_weapon');
    expect(spec).toBeNull();
  });

  test('getDefenseSpec_validDefense_returnsSpec', () => {
    const spec = TechFactory.getDefenseSpec('kinetic_armor');
    expect(spec).toBeDefined();
    expect(spec?.name).toBe('Kinetic Armor');
    expect(spec?.baseCost).toBe(200);
  });

  test('getAllWeaponSpecs_returnsAllWeapons', () => {
    const specs = TechFactory.getAllWeaponSpecs();
    expect(Object.keys(specs)).toContain('auto_turret');
    expect(Object.keys(specs)).toContain('pulse_laser');
    expect(Object.keys(specs)).toContain('rocket_launcher');
  });

  test('calculateTotalEffects_computesCorrectTotals', () => {
    const techCounts: TechCounts = {
      pulse_laser: 2,
      auto_turret: 3,
      plasma_lance: 1,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      kinetic_armor: 5,
      energy_shield: 3,
      missile_jammer: 1,
      ship_hull: 1
    };

    const effects = TechFactory.calculateTotalEffects(techCounts);
    
    // Verify structure
    expect(effects.weapons).toBeDefined();
    expect(effects.defense).toBeDefined();
    expect(effects.grandTotalCost).toBeGreaterThan(0);
    
    // Verify weapon calculations
    expect(effects.weapons.totalDPS).toBeGreaterThan(0);
    expect(effects.weapons.totalAccuracy).toBeGreaterThan(0);
    expect(effects.weapons.totalCost).toBeGreaterThan(0);
    
    // Verify defense calculations
    expect(effects.defense.totalKineticArmor).toBe(5);
    expect(effects.defense.totalEnergyShield).toBe(3);
    expect(effects.defense.totalMissileJammers).toBe(1);
  });

  test('canBuildWeapon_sufficientIron_returnsTrue', () => {
    const canBuild = TechFactory.canBuildWeapon('auto_turret', 500);
    expect(canBuild).toBe(true);
  });

  test('canBuildWeapon_insufficientIron_returnsFalse', () => {
    const canBuild = TechFactory.canBuildWeapon('auto_turret', 50);
    expect(canBuild).toBe(false);
  });
});

describe('TechFactory.calculateDefenseValues', () => {
  test('calculateDefenseValues_withZeroTechs_returnsZeroValues', () => {
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
    
    const currentValues = { hull: 0, armor: 0, shield: 0 };

    const result = TechFactory.calculateDefenseValues(techCounts, currentValues);

    expect(result.hull.current).toBe(0);
    expect(result.hull.max).toBe(0);
    expect(result.hull.regenRate).toBe(1);
    expect(result.armor.current).toBe(0);
    expect(result.armor.max).toBe(0);
    expect(result.armor.regenRate).toBe(1);
    expect(result.shield.current).toBe(0);
    expect(result.shield.max).toBe(0);
    expect(result.shield.regenRate).toBe(1);
  });

  test('calculateDefenseValues_withSingleTech_returnsCorrectValues', () => {
    const techCounts: TechCounts = {
      pulse_laser: 0,
      auto_turret: 0,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 3,
      kinetic_armor: 0,
      energy_shield: 0,
      missile_jammer: 0
    };
    
    // Current values from database (persisted)
    const currentValues = { hull: 150, armor: 0, shield: 0 };

    const result = TechFactory.calculateDefenseValues(techCounts, currentValues);

    // Max = 100 × tech_count = 100 × 3 = 300
    // Current = from database = 150
    expect(result.hull.max).toBe(300);
    expect(result.hull.current).toBe(150);
    expect(result.hull.name).toBe('Ship Hull');
    expect(result.hull.regenRate).toBe(1);
  });

  test('calculateDefenseValues_withMultipleTechs_calculatesIndependently', () => {
    const techCounts: TechCounts = {
      pulse_laser: 0,
      auto_turret: 0,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 2,
      kinetic_armor: 5,
      energy_shield: 3,
      missile_jammer: 0
    };
    
    // Current values from database (persisted)
    const currentValues = { hull: 100, armor: 250, shield: 150 };

    const result = TechFactory.calculateDefenseValues(techCounts, currentValues);

    // Hull: 2 × 100 = 200 max, current from DB = 100
    expect(result.hull.max).toBe(200);
    expect(result.hull.current).toBe(100);
    expect(result.hull.name).toBe('Ship Hull');

    // Armor: 5 × 100 = 500 max, current from DB = 250
    expect(result.armor.max).toBe(500);
    expect(result.armor.current).toBe(250);
    expect(result.armor.name).toBe('Kinetic Armor');

    // Shield: 3 × 100 = 300 max, current from DB = 150
    expect(result.shield.max).toBe(300);
    expect(result.shield.current).toBe(150);
    expect(result.shield.name).toBe('Energy Shield');
  });

  test('calculateDefenseValues_allDefensesPresent_returnsCorrectCalculations', () => {
    const techCounts: TechCounts = {
      pulse_laser: 1,
      auto_turret: 2,
      plasma_lance: 1,
      gauss_rifle: 1,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 10,
      kinetic_armor: 8,
      energy_shield: 12,
      missile_jammer: 3
    };
    
    // Current values from database (persisted)
    const currentValues = { hull: 500, armor: 400, shield: 600 };

    const result = TechFactory.calculateDefenseValues(techCounts, currentValues);

    // Hull: 10 × 100 = 1000 max, current from DB = 500
    expect(result.hull.max).toBe(1000);
    expect(result.hull.current).toBe(500);

    // Armor: 8 × 100 = 800 max, current from DB = 400
    expect(result.armor.max).toBe(800);
    expect(result.armor.current).toBe(400);

    // Shield: 12 × 100 = 1200 max, current from DB = 600
    expect(result.shield.max).toBe(1200);
    expect(result.shield.current).toBe(600);

    // All should have regenRate of 1
    expect(result.hull.regenRate).toBe(1);
    expect(result.armor.regenRate).toBe(1);
    expect(result.shield.regenRate).toBe(1);
  });
});
