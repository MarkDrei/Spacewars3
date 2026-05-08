# Balancing Charts Index

This directory contains auto-generated SVG charts that visualize research progression and balance relationships in Spacewars Ironstrike.

## Individual Research Charts

Charts showing the effect curve for each research from level 1 to level 30.

- [IronHarvesting](./individual-research/techtree-progression-iron-harvesting-l1-to-l30.svg)
- [afterburnerCooldown](./individual-research/techtree-progression-afterburner-cooldown-l1-to-l30.svg)
- [afterburnerDuration](./individual-research/techtree-progression-afterburner-duration-l1-to-l30.svg)
- [afterburnerSpeedIncrease](./individual-research/techtree-progression-afterburner-speed-increase-l1-to-l30.svg)
- [armorEffectiveness](./individual-research/techtree-progression-armor-effectiveness-l1-to-l30.svg)
- [artificialIntelligence](./individual-research/techtree-progression-artificial-intelligence-l1-to-l30.svg)
- [bridgeSlots](./individual-research/techtree-progression-bridge-slots-l1-to-l30.svg)
- [constructionSpeed](./individual-research/techtree-progression-construction-speed-l1-to-l30.svg)
- [energyAccuracy](./individual-research/techtree-progression-energy-accuracy-l1-to-l30.svg)
- [energyDamage](./individual-research/techtree-progression-energy-damage-l1-to-l30.svg)
- [energyRechargeRate](./individual-research/techtree-progression-energy-recharge-rate-l1-to-l30.svg)
- [hullStrength](./individual-research/techtree-progression-hull-strength-l1-to-l30.svg)
- [inventorySlots](./individual-research/techtree-progression-inventory-slots-l1-to-l30.svg)
- [ironCapacity](./individual-research/techtree-progression-iron-capacity-l1-to-l30.svg)
- [projectileAccuracy](./individual-research/techtree-progression-projectile-accuracy-l1-to-l30.svg)
- [projectileDamage](./individual-research/techtree-progression-projectile-damage-l1-to-l30.svg)
- [projectileReloadRate](./individual-research/techtree-progression-projectile-reload-rate-l1-to-l30.svg)
- [repairSpeed](./individual-research/techtree-progression-repair-speed-l1-to-l30.svg)
- [shieldEffectiveness](./individual-research/techtree-progression-shield-effectiveness-l1-to-l30.svg)
- [shieldRechargeRate](./individual-research/techtree-progression-shield-recharge-rate-l1-to-l30.svg)
- [shipSpeed](./individual-research/techtree-progression-ship-speed-l1-to-l30.svg)
- [teleport](./individual-research/techtree-progression-teleport-l1-to-l30.svg)
- [teleportRechargeSpeed](./individual-research/techtree-progression-teleport-recharge-speed-l1-to-l30.svg)

## Comparison Charts

### Weapons Comparison
Comparing damage, reload rate, and accuracy between energy and projectile weapons.

- [Energy vs Projectile Damage](./weapons-comparison/techtree-progression-energy-damage-vs-projectile-damage-l1-to-l30.svg)
- [Energy vs Projectile Reload](./weapons-comparison/techtree-progression-energy-recharge-rate-vs-projectile-reload-rate-l1-to-l30.svg)
- [Energy vs Projectile Accuracy](./weapons-comparison/techtree-progression-energy-accuracy-vs-projectile-accuracy-l1-to-l30.svg)

### Defense Comparison
Comparing effectiveness and regeneration rates across defense types.

- [Defense Types Progression](./defense-comparison/techtree-progression-hull-strength-vs-armor-effectiveness-vs-shield-effectiveness-l1-to-l30.svg)
- [Defense Regeneration (Repair vs Shield)](./defense-comparison/techtree-progression-repair-speed-vs-shield-recharge-rate-l1-to-l30.svg)

### Weapons vs Defense
Comparing offensive and defensive progression to assess balance.

- [Weapons vs Defense - Damage Potential](./weapons-vs-defense/techtree-progression-projectile-damage-vs-energy-damage-vs-hull-strength-vs-armor-effectiveness-l1-to-l30.svg)

### Economy
Iron production and storage capacity progression.

- [Iron Economy - Production vs Capacity](./economy/techtree-progression-iron-harvesting-vs-iron-capacity-l1-to-l30.svg)

### Ship Mobility
Speed and afterburner progression.

- [Ship Mobility - Speed vs Afterburner](./ship-mobility/techtree-progression-ship-speed-vs-afterburner-speed-increase-l1-to-l30.svg)

### Teleport System
Teleport charges and recharge speed progression.

- [Teleport System](./teleport/techtree-progression-teleport-vs-teleport-recharge-speed-l1-to-l30.svg)

## How to Use These Charts

1. **Individual Research**: Use to understand how each tech scales across levels and plan your research progression.
2. **Comparisons**: Use to analyze balance between competing research options and identify dominant strategies.
3. **Dual-axis charts**: When comparing different researches, secondary lines are scaled to intersect at level 1, allowing side-by-side comparison of growth patterns.

## Regenerating Charts

To regenerate these charts, run:

```bash
npm run balancing-charts
```

Or generate individual charts:

```bash
npm run techtree-chart -- --research ShipSpeed --min 1 --max 30
```
