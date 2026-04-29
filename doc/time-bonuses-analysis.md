# Time Bonuses Analysis: Calculation Methods & Consistency

## Overview
Time-based bonuses (reload time, recharge rate, cooldown reduction) are used across multiple game systems. This document analyzes how they're calculated and whether implementations are consistent.

---

## Time-Based Research Types

| Research | Type | Base Value | Effect Formula | Unit | Used For |
|----------|------|------------|-----------------|------|----------|
| **ProjectileReloadRate** | Time Reduction | 10 | constant (+10/level) | % | Projectile weapon reload speed |
| **EnergyRechargeRate** | Time Reduction | 15 | constant (+15/level) | % | Energy weapon reload speed |
| **ShieldRechargeRate** | Rate Increase | 0.1 | factor (×1.13/level) | HP/sec | Shield regeneration rate |
| **RepairSpeed** | Rate Increase | 0.1 | factor (×1.15/level) | HP/sec | Hull & armor repair rate |
| **TeleportRechargeSpeed** | Time Reduction | 86400 | factor (×0.9/level) | seconds | Teleport charge recharge duration |
| **AfterburnerCooldown** | Time Reduction | 3600 | factor (×0.9/level) | seconds | Afterburner fuel recharge cooldown |
| **IronHarvesting** | Rate Increase | 1 | factor (×1.1/level) | iron/sec | Iron gathering rate |

---

## Bonus Calculation Pattern

All time-based bonuses follow this formula:
```
Final Value = Research Effect × Level Multiplier × Commander Multiplier
              (where applicable)
```

### Level Multiplier
```
levelMultiplier = 1.15^(level - 1)
- Level 1 → 1.0
- Level 2 → 1.15
- Level 3 → 1.3225
```

### Commander Multiplier
Applied only to stats with a `CommanderStatKey`:
- `projectileWeaponReloadRate`
- `energyWeaponReloadRate`
- `projectileWeaponDamage`
- `energyWeaponDamage`
- `projectileWeaponAccuracy`
- `energyWeaponAccuracy`
- `shipSpeed`

Other bonuses (iron harvesting, repair, shield recharge) have **no commander multiplier**.

---

## Implementation Analysis

### Category 1: Rate Increase (Direct Multiplication)
These bonuses directly add or multiply the base rate by the bonus factors.

#### Shield Recharge Rate
**Formula**: `rate = baseRate × research_effect × levelMultiplier`

**Implementation**:
```typescript
// UserBonusCache.ts
const shieldRechargeEffect = getResearchEffectFromTree(tree, ResearchType.ShieldRechargeRate);
shieldRechargeRate: shieldRechargeEffect * levelMultiplier,

// User.ts
this.shieldCurrent = Math.min(
  this.shieldCurrent + shieldRechargeRate * gameElapsed,
  maxShield
);
```

**Effect at Level 1** (base 0.1):
- `0.1 × 1.0 = 0.1 HP/sec`

**Effect at Level 5** (research base 0.1, factor 1.13):
- Research effect = `0.1 × (1.13^4) ≈ 0.1626`
- Bonus = `0.1626 × 1.15 ≈ 0.187 HP/sec` (with level 2)

**Status**: ✅ Consistent pattern

---

#### Repair Speed (Hull & Armor)
**Formula**: `rate = baseRate × research_effect × levelMultiplier`

**Implementation**:
```typescript
// UserBonusCache.ts
const repairSpeedEffect = getResearchEffectFromTree(tree, ResearchType.RepairSpeed);
repairRate: repairSpeedEffect * levelMultiplier,

// User.ts
this.hullCurrent = Math.min(
  this.hullCurrent + splitRepairRate * step,
  maxHull
);
```

**Status**: ✅ Identical to Shield Recharge Rate

---

#### Iron Harvesting Rate
**Formula**: `rate = baseRate × research_effect × levelMultiplier`

**Implementation**:
```typescript
// UserBonusCache.ts
const ironHarvesting = getResearchEffectFromTree(tree, ResearchType.IronHarvesting);
ironRechargeRate: ironHarvesting * levelMultiplier,

// User.ts
const ironRateFromBonuses = bonuses?.ironRechargeRate;
ironToAdd += ironRate * gameElapsed;
```

**Status**: ✅ Identical pattern

---

### Category 2: Time Reduction via Speed Factor
These bonuses work inversely—they reduce time duration by dividing by a "speed factor" (> 1.0 means faster).

#### Weapon Reload Time (Projectile & Energy)
**Formula**: `time = baseCooldown / speedFactor`

where `speedFactor = 1 / (1 - effect/100)` (capped at inverse ≥ 0.1)

**Implementation**:
```typescript
// techtree.ts — getWeaponReloadTimeModifierFromTree()
const effect = getResearchEffectFromTree(tree, researchType);
const inverseMultiplier = Math.max(0.1, 1 - (effect / 100));
return 1 / inverseMultiplier;  // Speed factor ≥ 1.0

// UserBonusCache.ts
const projReloadMod = getWeaponReloadTimeModifierFromTree(tree, PROJECTILE_WEAPON_KEY);
projectileWeaponReloadFactor:
  projReloadMod * levelMultiplier * commanderMultipliers.projectileWeaponReloadRate,

// TechFactory.ts
const factor = totalReloadFactor ?? getWeaponReloadTimeModifierFromTree(techTree, weaponKey);
return baseCooldown / factor;
```

**Example Calculation**:
- ProjectileReloadRate at level 1: effect = 10% → speed factor = 1 / (1 - 0.1) ≈ 1.111
- Base cooldown: 720s (auto_turret)
- With no level bonus: `720 / 1.111 ≈ 648s` (10% faster)
- With level 2 bonus: `720 / (1.111 × 1.15) ≈ 564s` (26% faster combined)
- With commander +5%: `720 / (1.111 × 1.15 × 1.05) ≈ 538s`

**Status**: ✅ Consistent multiplicative pattern

---

#### Teleport Recharge Speed
**Formula**: `time_to_recharge = research_effect / gameElapsed`

where `effect = base × factor^(level-1)` (factor 0.9 = 10% faster per level)

**Implementation**:
```typescript
// User.ts
const rechargeTimeSec = getResearchEffectFromTree(this.techTree, ResearchType.TeleportRechargeSpeed);
const gameElapsed = elapsed * timeMultiplier;
const chargeGain = gameElapsed / rechargeTimeSec;
this.teleportCharges = Math.min(maxCharges, this.teleportCharges + chargeGain);
```

**Analysis**:
- Base value: 86400 seconds (1 day)
- Research factor: 0.9/level
- At level 1: effect = 86400 seconds
- At level 5: effect = 86400 × (0.9^4) ≈ 63721 seconds (~17.7 hours)
- Charge accumulation: `gameElapsed / rechargeTimeSec` charges/second

**⚠️ INCONSISTENCY FOUND**: 
- Teleport recharge does NOT apply level multiplier to the research effect
- Formula: `chargeGain = gameElapsed / research_effect`
- Should be: `chargeGain = gameElapsed / (research_effect / levelMultiplier)` to match other time-based bonuses
- Currently, at level 2, the bonus is NOT multiplied by the player's level multiplier (1.15)

**Status**: ⚠️ **INCONSISTENT** — missing level multiplier

---

#### Afterburner Cooldown
**Formula**: Similar to Teleport—affects fuel recharge duration

**Implementation**:
```typescript
// User.ts — AfterburnerBurner class manages this
// Currently hardcoded; no bonus integration yet
const cooldownSeconds = 3600; // 1 hour base
```

**Status**: ⚠️ **NOT IMPLEMENTED** — bonus integration incomplete

---

### Category 3: Time-Dependent State Updates
These apply time multiplier acceleration but use the bonus system differently.

#### Afterburner Duration & Speed Increase
**Formula**: 
- Duration: applied directly to fuel consumption rate
- Speed Increase: applied as multiplier to max speed

**Implementation**:
```typescript
// Battle system: applied at fire time via bonuses
const speedFactor = bonuses.projectileWeaponReloadFactor;
const effectiveCooldown = calculateEffectiveWeaponCooldown(bonusedCooldown);
```

**Status**: ✅ Consistent with weapon reload model

---

## Key Findings

### ✅ Consistent Implementations
1. **Rate increase bonuses** (shield recharge, repair speed, iron harvesting):
   - Apply: `research_effect × levelMultiplier`
   - Direct multiplication to rate value
   - Used in: `current += rate × gameElapsed`

2. **Weapon reload time**:
   - Apply: `speedFactor × levelMultiplier × commanderMultiplier`
   - Used as divisor: `baseCooldown / speedFactor`
   - Fully integrated with bonus system

---

### ⚠️ Inconsistencies & Gaps

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| **Missing level multiplier** | `TeleportRechargeSpeed` | Medium | Should apply `levelMultiplier` like other time reductions |
| **Missing bonus integration** | `AfterburnerCooldown` | Medium | Not using bonus system; hardcoded values |
| **No commander bonus** | Teleport, shield recharge, repair | Design | These stats have no `CommanderStatKey`; intentional per design doc |

---

## Recommendations

### 1. Add Level Multiplier to Teleport Recharge (CRITICAL FIX)
```typescript
// Currently:
const chargeGain = gameElapsed / rechargeTimeSec;

// Should be:
const levelMultiplier = bonuses?.levelMultiplier ?? 1.0;
const chargeGain = gameElapsed / (rechargeTimeSec / levelMultiplier);
// OR equivalently:
const chargeGain = (gameElapsed * levelMultiplier) / rechargeTimeSec;
```

### 2. Integrate Afterburner Cooldown with Bonus System
- Add `AfterburnerCooldown` to `UserBonuses` computation
- Apply bonus in `AfterburnerBurner` fuel recharge logic

### 3. Document Time Bonus Formula Clearly
Update [doc/arc42-architecture.md](../architecture/arc42-architecture.md) with:
- Uniform formula template for all time-based bonuses
- Mapping of research→stat→application point
- Time multiplier interaction (always applied to `gameElapsed`)

---

## Test Cases Needed

```typescript
// Verify level multiplier on teleport recharge
const levelMultiplier = 1.15; // level 2
const chargesPerSecond = gameElapsed / (rechargeTimeSec / levelMultiplier);
// At level 2, should recharge ~15% faster than level 1

// Verify commander bonus on weapon reload
const reloadFactor = 1.111 * 1.15 * 1.05; // research × level × commander
const reload = 720 / reloadFactor;
// Should reduce reload time by ~27% total
```

---

## References
- [UserBonusCache.ts](../../src/lib/server/bonus/UserBonusCache.ts) — Bonus computation
- [techtree.ts](../../src/lib/server/techs/techtree.ts) — Research definitions & modifiers
- [TechFactory.ts](../../src/lib/server/techs/TechFactory.ts) — Weapon time calculations
- [User.ts](../../src/lib/server/user/user.ts) — Bonus application points
- [Player Bonus System Plan](./completed-plans/2026-02-playerBonusSystem.md) — Design rationale
