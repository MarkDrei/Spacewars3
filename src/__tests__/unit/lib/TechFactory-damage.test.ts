// Unit tests for TechFactory.calculateWeaponDamage — new sequential battle system.
//
// Damage flows: shield → armor → hull
//   - Shields resist energy weapons  (energy deals 0.5× effective damage to shield HP)
//   - Armor   resists projectile weapons (projectile deals 0.5× effective damage to armor HP)
//   - Hull    has no resistance
//
// Special mechanics:
//   - Gauss Rifle: bypass fraction of shields = 1 − 0.95^projectileResearchLevel
//   - Plasma Lance: armor bypass fraction = max(0, 1 − 1/accuracyMultiplier)

import { describe, it, expect } from 'vitest';
import { TechFactory } from '@/lib/server/techs/TechFactory';

// Helpers to reduce boilerplate
const calc = (
  weapon: string,
  count: number,
  shield: number,
  armor: number,
  options: {
    accuracy?: number;
    damage?: number;
    ecm?: number;
    spread?: number;
    projectileLevel?: number;
  } = {}
) =>
  TechFactory.calculateWeaponDamage(
    weapon,
    count,
    shield,
    armor,
    options.accuracy ?? 1.0,
    0,
    options.damage ?? 1.0,
    options.ecm ?? 0,
    options.spread ?? 1.0,
    options.projectileLevel ?? 0
  );

// ---------------------------------------------------------------------------
// Sequential flow — no defenses (all hits go to hull)
// ---------------------------------------------------------------------------
describe('sequential flow — no defenses', () => {
  it('projectile_noShieldNoArmor_allDamageToHull', () => {
    // auto_turret: 1 weapon, 50% accuracy × 1.0 multiplier → 0 or 1 hit
    // Use spread=2 to guarantee a hit, weapon count=10, accuracy 1.0 → 5 hits × 10 dmg = 50
    const result = calc('auto_turret', 10, 0, 0);
    expect(result.weaponsHit).toBe(5);
    expect(result.shieldDamage).toBe(0);
    expect(result.armorDamage).toBe(0);
    expect(result.hullDamage).toBe(50); // 5 hits × 10 baseDamage
  });

  it('energyWeapon_noShieldNoArmor_allDamageToHull', () => {
    // pulse_laser: 10 weapons, 80% accuracy × 1.0 → 8 hits × 7 dmg = 56
    const result = calc('pulse_laser', 10, 0, 0);
    expect(result.weaponsHit).toBe(8);
    expect(result.shieldDamage).toBe(0);
    expect(result.armorDamage).toBe(0);
    expect(result.hullDamage).toBe(56);
  });
});

// ---------------------------------------------------------------------------
// Shield layer — energy resistance
// ---------------------------------------------------------------------------
describe('shield layer — energy resistance', () => {
  it('energyWeapon_dealHalfEffectiveDamageToShield', () => {
    // pulse_laser: 10 weapons, 80% acc → 8 hits × 7 = 56 raw damage
    // Shield effective = 56 × 0.5 = 28 → 28 HP removed from 100 shield
    // Remaining raw damage = 56 − 28/0.5 = 56 − 56 = 0 → no armor/hull damage
    const result = calc('pulse_laser', 10, 100, 0);
    expect(result.shieldDamage).toBe(28);
    expect(result.armorDamage).toBe(0);
    expect(result.hullDamage).toBe(0);
  });

  it('projectileWeapon_fullDamageToShield', () => {
    // auto_turret: 10 weapons, 50% acc → 5 hits × 10 = 50 raw damage
    // Shield effective = 50 × 1.0 = 50 → all 50 HP removed from shield (shield had 100)
    // Real damage consumed = 50 / 1.0 = 50 → 0 remaining
    const result = calc('auto_turret', 10, 100, 0);
    expect(result.shieldDamage).toBe(50);
    expect(result.armorDamage).toBe(0);
    expect(result.hullDamage).toBe(0);
  });

  it('energyWeapon_depleteSmallShield_excessHitsArmor', () => {
    // pulse_laser: 10 weapons, 80% → 8 hits × 7 = 56 raw damage, shield=10, armor=100
    // Shield effective = 56 × 0.5 = 28. Shield has only 10 HP → 10 HP removed.
    // Real damage consumed by shield = 10 / 0.5 = 20
    // Remaining raw damage = 56 − 20 = 36
    // Armor effective = 36 × 1.0 (energy, no armor penalty) = 36 → 36 HP removed from armor
    const result = calc('pulse_laser', 10, 10, 100);
    expect(result.shieldDamage).toBe(10);
    expect(result.armorDamage).toBe(36);
    expect(result.hullDamage).toBe(0);
  });

  it('projectileWeapon_depleteSmallShield_excessHitsArmorAtHalf', () => {
    // auto_turret: 10 weapons, 50% → 5 hits × 10 = 50 raw, shield=10, armor=100
    // Shield effective = 50 × 1.0 = 50. Shield HP = 10 → 10 HP removed.
    // Real damage consumed = 10 / 1.0 = 10
    // Remaining = 50 − 10 = 40
    // Armor effective = 40 × 0.5 = 20 → 20 HP removed from armor (armor had 100)
    const result = calc('auto_turret', 10, 10, 100);
    expect(result.shieldDamage).toBe(10);
    expect(result.armorDamage).toBe(20);
    expect(result.hullDamage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Armor layer — projectile resistance
// ---------------------------------------------------------------------------
describe('armor layer — projectile resistance', () => {
  it('projectileWeapon_halfEffectiveDamageToArmor', () => {
    // auto_turret: 10 weapons, 50% → 5 hits × 10 = 50 raw. No shield.
    // Armor effective = 50 × 0.5 = 25 → 25 HP removed from 100 armor
    // Real damage consumed = 25 / 0.5 = 50 → 0 remaining
    const result = calc('auto_turret', 10, 0, 100);
    expect(result.shieldDamage).toBe(0);
    expect(result.armorDamage).toBe(25);
    expect(result.hullDamage).toBe(0);
  });

  it('energyWeapon_fullDamageToArmor', () => {
    // pulse_laser: 10 weapons, 80% → 8 hits × 7 = 56 raw. No shield.
    // Armor effective = 56 × 1.0 = 56 → 56 HP removed from 100 armor (capped at 56)
    const result = calc('pulse_laser', 10, 0, 100);
    expect(result.shieldDamage).toBe(0);
    expect(result.armorDamage).toBe(56);
    expect(result.hullDamage).toBe(0);
  });

  it('projectileWeapon_depleteSmallArmor_excessHitsHull', () => {
    // auto_turret: 5 hits × 10 = 50 raw. No shield. Armor = 10.
    // Armor effective = 50 × 0.5 = 25. Armor HP = 10 → 10 HP removed.
    // Real damage consumed = 10 / 0.5 = 20
    // Hull = 50 − 20 = 30
    const result = calc('auto_turret', 10, 0, 10);
    expect(result.shieldDamage).toBe(0);
    expect(result.armorDamage).toBe(10);
    expect(result.hullDamage).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Full sequential flow — shield → armor → hull
// ---------------------------------------------------------------------------
describe('full sequential flow', () => {
  it('energyWeapon_shieldAbsorbsHalf_armorAbsorbsRest', () => {
    // pulse_laser: 8 hits × 7 = 56. shield=10, armor=100.
    // Shield: effective = 56×0.5=28. HP=10→ consumed real = 10/0.5=20. remain=36.
    // Armor: effective = 36×1.0=36. HP=100→36 absorbed. remain=0.
    const result = calc('pulse_laser', 10, 10, 100);
    expect(result.shieldDamage).toBe(10);
    expect(result.armorDamage).toBe(36);
    expect(result.hullDamage).toBe(0);
  });

  it('projectileWeapon_shieldAbsorbsFull_armorHalf_restToHull', () => {
    // auto_turret: 5 hits × 10 = 50. shield=20, armor=5.
    // Shield: effective=50×1.0=50. HP=20→20 absorbed. consumed=20. remain=30.
    // Armor: effective=30×0.5=15. HP=5→5 absorbed. consumed=5/0.5=10. remain=20.
    // Hull = 20.
    const result = calc('auto_turret', 10, 20, 5);
    expect(result.shieldDamage).toBe(20);
    expect(result.armorDamage).toBe(5);
    expect(result.hullDamage).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Gauss Rifle — shield penetration based on projectile research level
// ---------------------------------------------------------------------------
describe('gauss_rifle shield penetration', () => {
  it('gaussRifle_level0_noBypass_normalProjectileVsShield', () => {
    // gauss_rifle: 10 weapons, 70% → 7 hits × 40 = 280 raw. shield=1000. level=0.
    // bypassFraction = 1 − 0.95^0 = 0 → no bypass.
    // Shield: 280 × 1.0 = 280 HP removed (projectile, full effect on shields).
    const result = calc('gauss_rifle', 10, 1000, 0, { projectileLevel: 0 });
    expect(result.shieldDamage).toBe(280);
    expect(result.armorDamage).toBe(0);
    expect(result.hullDamage).toBe(0);
  });

  it('gaussRifle_level10_40PercentBypass', () => {
    // bypassFraction = 1 − 0.95^10 ≈ 0.4013
    // gauss_rifle: 10 weapons, 70% → 7 hits × 40 = 280 raw. shield=1000.
    // bypass = 280 × 0.4013 ≈ 112.36 (bypasses shield)
    // shieldFacing = 280 − 112.36 ≈ 167.64
    // shieldHPRemoved = min(167.64, 1000) ≈ 167.64
    // remainingAfterShield = shieldFacing − shieldHPRemoved + bypass ≈ 112.36
    // Armor: projectile 0.5× → effective = 112.36 × 0.5 ≈ 56.18 → 56 HP armor removed.
    const result = calc('gauss_rifle', 10, 1000, 1000, { projectileLevel: 10 });
    const bypassFraction = 1 - Math.pow(0.95, 10);
    const rawDmg = 7 * 40; // 280
    const bypass = rawDmg * bypassFraction;
    const shieldFacing = rawDmg - bypass;
    const expectedShield = Math.round(shieldFacing);
    const expectedArmor = Math.round(bypass * 0.5);
    expect(result.shieldDamage).toBe(expectedShield);
    expect(result.armorDamage).toBe(expectedArmor);
  });

  it('gaussRifle_higherLevel_moreShieldBypassed', () => {
    // With level 20 vs level 1, more damage should bypass shields.
    const level1 = calc('gauss_rifle', 10, 1000, 0, { projectileLevel: 1 });
    const level20 = calc('gauss_rifle', 10, 1000, 0, { projectileLevel: 20 });
    // Higher level → less shield damage (more bypasses), more hull/armor
    expect(level20.shieldDamage).toBeLessThan(level1.shieldDamage);
  });

  it('gaussRifle_level0VsLevel20_bypassGrowsWithLevel', () => {
    const level0 = calc('gauss_rifle', 10, 0, 1000, { projectileLevel: 0 });
    const level20 = calc('gauss_rifle', 10, 0, 1000, { projectileLevel: 20 });
    // Both have no shields, so bypass doesn't matter for armor; total damage should be equal
    const total0 = level0.armorDamage + level0.hullDamage;
    const total20 = level20.armorDamage + level20.hullDamage;
    expect(total0).toBe(total20);
  });
});

// ---------------------------------------------------------------------------
// Plasma Lance — armor bypass based on accuracy multiplier
// ---------------------------------------------------------------------------
describe('plasma_lance armor bypass', () => {
  it('plasmaLance_accuracy1x_noBypass', () => {
    // bypassFraction = max(0, 1 − 1/1.0) = 0
    // plasma_lance: 10 weapons, 90% → 9 hits × 30 = 270 raw. no shield. armor=1000.
    // armor: energy, 1.0× → effective=270. HP=1000 → 270 absorbed.
    const result = calc('plasma_lance', 10, 0, 1000, { accuracy: 1.0 });
    expect(result.armorDamage).toBe(270);
    expect(result.hullDamage).toBe(0);
  });

  it('plasmaLance_accuracy2x_50PercentBypass', () => {
    // bypassFraction = max(0, 1 − 1/2.0) = 0.5
    // plasma_lance base accuracy 90%. At 2.0× accuracy: effective = 90×2=180% → all 10 hit.
    // 10 hits × 30 = 300 raw. No shield. armor=1000.
    // bypass = 300 × 0.5 = 150 (goes to hull directly)
    // armorFacing = 300 × 0.5 = 150. armor effective = 150 × 1.0 → 150 HP removed.
    const result = calc('plasma_lance', 10, 0, 1000, { accuracy: 2.0 });
    expect(result.armorDamage).toBe(150);
    expect(result.hullDamage).toBe(150);
  });

  it('plasmaLance_accuracy3x_67PercentBypass', () => {
    // bypassFraction ≈ 1 − 1/3.0 ≈ 0.667
    // At 3.0× accuracy all 10 hit. 10 × 30 = 300. bypass ≈ 200. armorFacing ≈ 100 → 100 HP removed. hull ≈ 200.
    const result = calc('plasma_lance', 10, 0, 1000, { accuracy: 3.0 });
    const bypassFrac = 1 - 1 / 3.0;
    const raw = 10 * 30;
    expect(result.armorDamage).toBeCloseTo(raw * (1 - bypassFrac), 0);
    expect(result.hullDamage).toBeCloseTo(raw * bypassFrac, 0);
  });

  it('plasmaLance_higherAccuracy_moreArmorBypassed', () => {
    const result1x = calc('plasma_lance', 10, 0, 1000, { accuracy: 1.0 });
    const result4x = calc('plasma_lance', 10, 0, 1000, { accuracy: 4.0 });
    expect(result4x.hullDamage).toBeGreaterThan(result1x.hullDamage);
    expect(result4x.armorDamage).toBeLessThan(result1x.armorDamage);
  });

  it('plasmaLance_accuracy0_5x_noNegativeBypass', () => {
    // accuracy below 1.0 → bypass = max(0, negative) = 0
    const result = calc('plasma_lance', 10, 0, 1000, { accuracy: 0.5 });
    expect(result.hullDamage).toBe(0);
    // All damage goes to armor at 1.0× (energy weapon)
    expect(result.armorDamage).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Hull layer
// ---------------------------------------------------------------------------
describe('hull layer', () => {
  it('anyWeapon_noShieldNoArmor_allHullDamage', () => {
    const projectile = calc('auto_turret', 10, 0, 0);
    const energy = calc('pulse_laser', 10, 0, 0);
    // No modifiers when both shields and armor are 0 — all goes to hull
    expect(projectile.shieldDamage).toBe(0);
    expect(projectile.armorDamage).toBe(0);
    expect(energy.shieldDamage).toBe(0);
    expect(energy.armorDamage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Accuracy and ECM mechanics preserved
// ---------------------------------------------------------------------------
describe('accuracy and ECM mechanics', () => {
  it('rocketLauncher_ecm1_allMiss', () => {
    const result = TechFactory.calculateWeaponDamage(
      'rocket_launcher', 5, 0, 0, 1.0, 0, 1.0, 1.0, 1.0
    );
    expect(result.weaponsHit).toBe(0);
  });

  it('rocketLauncher_noEcm_allHit', () => {
    // 100% base accuracy, accuracy×1.0, ECM=0 → all 5 hit
    const result = TechFactory.calculateWeaponDamage(
      'rocket_launcher', 5, 0, 0, 1.0, 0, 1.0, 0, 1.0
    );
    expect(result.weaponsHit).toBe(5);
  });

  it('zeroWeaponCount_returnsAllZero', () => {
    const result = calc('auto_turret', 0, 100, 100);
    expect(result).toEqual({ weaponsHit: 0, shieldDamage: 0, armorDamage: 0, hullDamage: 0 });
  });
});
