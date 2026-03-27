// ---
// Tests for TechFactory weapon damage calculations
// ---

import { describe, test, expect } from 'vitest';
import { TechFactory, TechCounts } from '@/lib/server/techs/TechFactory';
import { createInitialTechTree } from '@/lib/server/techs/techtree';

describe('TechFactory.calculateWeaponDamage', () => {
  // default counts used by helper when a specific weapon count isn't supplied
  const defaultTechCounts: Record<string, number> = {
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
    weaponCount: number = defaultTechCounts[weaponKey] ?? 0,
    opponentShield: number = 100,
    opponentArmor: number = 100,
    accuracyMultiplier: number = 1.0,
    negativeAccuracy: number = 0,
    damageModifier: number = 1.0,
    ecmEffectiveness: number = 0,
    spread: number = 1.0
  ) => {
    return TechFactory.calculateWeaponDamage(
      weaponKey,
      weaponCount,
      opponentShield,
      opponentArmor,
      accuracyMultiplier,
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
      // supply 0 weapons directly instead of a TechCounts object
      const result = calculateDamage('auto_turret', 0, 100, 100, 0, 0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(0);
      expect(result.shieldDamage).toBe(0);
      expect(result.armorDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_perfectAccuracy_allWeaponsHit', async () => {
      // Auto turret: base 50% × 2.0 multiplier = 100% accuracy
      const result = calculateDamage('auto_turret', 3, 100, 100, 2.0, 0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(3); // Should hit with all 3 auto turrets
    });

    test('calculateWeaponDamage_zeroAccuracy_noWeaponsHit', async () => {
      // Auto turret: base 50% accuracy completely negated: (50 × 1.0) * (1 - 1.0) = 0%
      const result = calculateDamage('auto_turret', 3, 100, 100, 1.0, 1.0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(0);
      expect(result.shieldDamage).toBe(0);
      expect(result.armorDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });
  });

  describe('accuracy calculations by weapon type', () => {
    test('calculateWeaponDamage_autoTurret_standardAccuracyCalculation', async () => {
      // Auto turret: (50 × 1.2) * (1 - 0.2) = 60 * 0.8 = 48%
      // 3 weapons * 48% * 1.0 spread = 1.44 → 1 weapon hits
      const result = calculateDamage('auto_turret', 3, 100, 100, 1.2, 0.2, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_rocketLauncher_ecmAffectsAccuracy', async () => {
      // Rocket launcher: (100 × 1.0) * (1 - 0.3) = 100 * 0.7 = 70%
      // 1 weapon * 70% * 1.0 spread = 0.7 → 1 weapon hits (rounded)
      const result = calculateDamage('rocket_launcher', 1, 100, 100, 1.0, 0.1, 1.0, 0.3, 1.0);

      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_rocketLauncher_negativeAccuracyIgnored', async () => {
      // Rocket launcher: (100 × 1.0) * (1 - 0.2) = 100 * 0.8 = 80% (negative accuracy ignored)
      const result = calculateDamage('rocket_launcher', 1, 100, 100, 1.0, 0.5, 1.0, 0.2, 1.0);

      expect(result.weaponsHit).toBe(1);
    });

    test('calculateWeaponDamage_photonTorpedo_reducedECMAndNegativeEffects', async () => {
      // Photon torpedo: (75 × 1.0) * (1 - 0.3/3) * (1 - 0.2/3) = 75 * 0.9 * 0.933 ≈ 63%
      // 1 weapon * 63% * 1.0 spread = 0.63 → 1 weapon hits (rounded)
      const result = calculateDamage('photon_torpedo', 1, 100, 100, 1.0, 0.3, 1.0, 0.2, 1.0);

      expect(result.weaponsHit).toBe(1);
    });
  });

  describe('damage calculations', () => {
    test('calculateWeaponDamage_autoTurret_correctDamageDistribution', async () => {
      // Auto turret (Projectile): projectile deals full damage to shields, half to armor.
      // (50 × 2.0) * (1 - 0.5) = 50% accuracy, 3 weapons * 50% = 1.5 → 2 weapons hit
      // 2 weapons hit: 20 raw damage
      // Shield: projectile 1.0× → 20 effective → 20 HP removed. consumed=20. remain=0.
      // Armor: 0 remaining → 0. Hull: 0.
      const result = calculateDamage('auto_turret', 3, 100, 100, 2.0, 0.5, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(2);
      expect(result.shieldDamage).toBe(20); // Projectile deals full damage to shields
      expect(result.armorDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_pulseLaser_energyWeaponDamage', async () => {
      // Pulse laser (Energy): energy deals half damage to shields (shields resist energy).
      // 2 weapons hit (100%+ accuracy): 14 raw damage
      // Shield: energy 0.5× → effective=7 → 7 HP removed. consumed=14. remain=0.
      // Armor: 0 remaining → 0. Hull: 0.
      const result = calculateDamage('pulse_laser', 2, 100, 100, 2.0, 0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(2);
      expect(result.shieldDamage).toBe(7); // Energy deals 0.5× to shields
      expect(result.armorDamage).toBe(0);
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_shieldExcess_flowsToArmor', async () => {
      // Auto turret (Projectile) vs low shields: excess damage flows through to armor.
      // 3 weapons, all hit (100% accuracy): 30 raw damage. shield=5, armor=100.
      // Shield: 1.0× → effective=30. Shield HP=5 → 5 absorbed. consumed=5. remain=25.
      // Armor: 0.5× → effective=12.5 → 12 or 13 HP removed. consumed=25. remain=0.
      // Hull: 0 (all excess absorbed by armor)
      const result = calculateDamage('auto_turret', 3, 5, 100, 2.0, 0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(3);
      expect(result.shieldDamage).toBe(5); // All available shield absorbed
      expect(result.armorDamage).toBe(13); // Excess shield damage absorbed by armor (0.5× modifier)
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_armorPenetration_excessDamageToHull', async () => {
      // Gauss rifle (Projectile, no shield bypass at level 0) vs no shield, low armor.
      // 2 weapons hit (140% accuracy): 80 raw damage. shield=0, armor=10.
      // Shield: 1.0× → effective=80. Shield HP=0 → 0 absorbed. remain=80.
      // Armor: 0.5× → effective=40. Armor HP=10 → 10 absorbed. consumed=10/0.5=20. remain=60.
      // Hull: 60 (excess armor damage)
      const result = calculateDamage('gauss_rifle', 2, 0, 10, 2.0, 0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(2);
      expect(result.shieldDamage).toBe(0);
      expect(result.armorDamage).toBe(10); // All available armor absorbed
      expect(result.hullDamage).toBe(60); // Excess armor damage hits hull
    });
  });

  describe('special weapon mechanics', () => {
    test('calculateWeaponDamage_rocketLauncher_highDamageGuidedWeapon', async () => {
      // Rocket launcher (Projectile): full damage to shields, half to armor.
      // 1 weapon hits, 200 raw damage. shield=100, armor=100.
      // Shield: 1.0× → effective=200. Shield HP=100 → 100 absorbed. consumed=100. remain=100.
      // Armor: 0.5× → effective=50 → 50 HP removed. consumed=100. remain=0. Hull=0.
      const result = calculateDamage('rocket_launcher', 1, 100, 100, 1.0, 0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(1);
      expect(result.shieldDamage).toBe(100);
      expect(result.armorDamage).toBe(50);
      expect(result.hullDamage).toBe(0);
    });

    test('calculateWeaponDamage_photonTorpedo_heavyArmorDamage', async () => {
      // Photon torpedo (Energy): shields resist energy (0.5×), armor does not resist energy (1.0×).
      // 1 weapon hits, 200 raw damage. shield=50, armor=100.
      // Shield: 0.5× → effective=100. Shield HP=50 → 50 absorbed. consumed=100. remain=100.
      // Armor: 1.0× → effective=100. Armor HP=100 → 100 absorbed. consumed=100. remain=0. Hull=0.
      const result = calculateDamage('photon_torpedo', 1, 50, 100, 2.0, 0, 1.0, 0, 1.0);

      expect(result.weaponsHit).toBe(1);
      expect(result.shieldDamage).toBe(50); // 0.5× shield modifier
      expect(result.armorDamage).toBe(100); // Full energy damage to armor
      expect(result.hullDamage).toBe(0);
    });
  });

  describe('damage modifiers', () => {
    test('calculateWeaponDamage_damageModifier_scalesDamage', async () => {
      // Auto turret with 2x damage modifier and 2.0 accuracy multiplier → all 3 hit
      // 3 weapons * 10 damage * 2.0 = 60 total damage
      const result = calculateDamage('auto_turret', 3, 100, 100, 2.0, 0, 2.0, 0, 1.0);

      expect(result.weaponsHit).toBe(3);
      // Expected damage should be doubled
      expect(result.shieldDamage + result.armorDamage + result.hullDamage).toBeGreaterThan(12);
    });

    test('calculateWeaponDamage_spreadModifier_affectsHitCount', async () => {
      // Auto turret with 0.5 spread (half effectiveness) and 2.0 accuracy multiplier → 100% accuracy
      // 3 weapons * 100% accuracy * 0.5 spread = 1.5 → 2 weapons hit
      const result = calculateDamage('auto_turret', 3, 100, 100, 2.0, 0, 1.0, 0, 0.5);

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

describe('TechFactory.calculateWeaponReloadTime', () => {
  test('calculateWeaponReloadTime_projectileWeapon_baseLevel_returnsBaseCooldown', () => {
    const techTree = createInitialTechTree();
    
    // Auto turret: reloadTimeMinutes = 12, base cooldown = 720 seconds
    // Level 1 research = 10% faster = 0.9x multiplier
    // Expected: 720 * 0.9 = 648 seconds
    const reloadTime = TechFactory.calculateWeaponReloadTime('auto_turret', techTree);
    expect(reloadTime).toBeCloseTo(648, 1);
  });

  test('calculateWeaponReloadTime_energyWeapon_baseLevel_returnsBaseCooldown', () => {
    const techTree = createInitialTechTree();
    
    // Pulse laser: reloadTimeMinutes = 12, base cooldown = 720 seconds
    // Level 1 research = 15% faster = 0.85x multiplier
    // Expected: 720 * 0.85 = 612 seconds
    const reloadTime = TechFactory.calculateWeaponReloadTime('pulse_laser', techTree);
    expect(reloadTime).toBeCloseTo(612, 1);
  });

  test('calculateWeaponReloadTime_projectileWeapon_level3Research_appliesReduction', () => {
    const techTree = createInitialTechTree();
    techTree.projectileReloadRate = 3;
    
    // Gauss rifle: reloadTimeMinutes = 15, base cooldown = 900 seconds
    // Level 3 research = 10 + 10 + 10 = 30% faster = 0.7x multiplier
    // Expected: 900 * 0.7 = 630 seconds
    const reloadTime = TechFactory.calculateWeaponReloadTime('gauss_rifle', techTree);
    expect(reloadTime).toBeCloseTo(630, 1);
  });

  test('calculateWeaponReloadTime_energyWeapon_level4Research_appliesReduction', () => {
    const techTree = createInitialTechTree();
    techTree.energyRechargeRate = 4;
    
    // Plasma lance: reloadTimeMinutes = 15, base cooldown = 900 seconds
    // Level 4 research = 15 + 15 + 15 + 15 = 60% faster = 0.4x multiplier
    // Expected: 900 * 0.4 = 360 seconds
    const reloadTime = TechFactory.calculateWeaponReloadTime('plasma_lance', techTree);
    expect(reloadTime).toBeCloseTo(360, 1);
  });

  test('calculateWeaponReloadTime_highResearchLevel_respectsMinimumMultiplier', () => {
    const techTree = createInitialTechTree();
    techTree.energyRechargeRate = 10;
    
    // Photon torpedo: reloadTimeMinutes = 20, base cooldown = 1200 seconds
    // Level 10 research = 15 + (15*9) = 150% faster, but capped at 90% (0.1x multiplier)
    // Expected: 1200 * 0.1 = 120 seconds
    const reloadTime = TechFactory.calculateWeaponReloadTime('photon_torpedo', techTree);
    expect(reloadTime).toBeCloseTo(120, 1);
  });

  test('calculateWeaponReloadTime_level0Research_noEffect', () => {
    const techTree = createInitialTechTree();
    techTree.projectileReloadRate = 0;
    techTree.energyRechargeRate = 0;
    
    // Rocket launcher: reloadTimeMinutes = 20, base cooldown = 1200 seconds
    // Level 0 research = 0% = 1.0x multiplier
    // Expected: 1200 * 1.0 = 1200 seconds
    const reloadTime = TechFactory.calculateWeaponReloadTime('rocket_launcher', techTree);
    expect(reloadTime).toBe(1200);
  });

  test('calculateWeaponReloadTime_invalidWeapon_throwsError', () => {
    const techTree = createInitialTechTree();
    
    expect(() => TechFactory.calculateWeaponReloadTime('invalid_weapon', techTree)).toThrow('Unknown weapon: invalid_weapon');
  });
});

