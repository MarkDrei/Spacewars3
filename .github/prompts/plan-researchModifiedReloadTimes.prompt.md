# Plan: Integrate Research-Modified Reload Times into Battle System

Das Battle-System wird von sekundenbasierten Cooldowns (2-10s) auf minutenbasierte Reload-Zeiten (720-1200s) umgestellt, die durch Research (ProjectileReloadRate, EnergyRechargeRate) dynamisch verkürzt werden können. Die Berechnung erfolgt bei jedem Waffeneinsatz mit Minimum-Cooldown von 1 Sekunde.

**Entscheidungen**:

- `cooldown` (Sekunden) wird durch `reloadTimeMinutes * 60` (Sekunden) ersetzt
- Forschung reduziert via `modified = base × (1 - researchEffect/100)` mit 1s Minimum
- Berechnung bei jedem Schuss ermöglicht Research-Abschlüsse während Battles
- ProjectileReloadRate: 10% + 10% pro Level → bei Level 5 = 50% schneller
- EnergyRechargeRate: 15% + 15% pro Level → bei Level 5 = 75% schneller

**Steps**

1. Fix weapon categorization in [techtree.ts](src/lib/server/techs/techtree.ts#L424-L425): Replace non-existent weapons (`machine_gun`, `flak_cannon`, `plasma_cannon`) with actual weapons (`auto_turret`, `plasma_lance`, `gauss_rifle`) based on their subtype from [TechFactory.ts](src/lib/server/techs/TechFactory.ts#L60-L152)

2. Add `getWeaponCooldownModifierFromTree()` in [techtree.ts](src/lib/server/techs/techtree.ts) after line 671: Similar to `getWeaponDamageModifierFromTree`, check weapon category and return research effect as percentage (10%, 20%, etc.)

3. Add `calculateModifiedReloadTime()` static method in [TechFactory.ts](src/lib/server/techs/TechFactory.ts): Takes `weaponKey` and `techTree`, converts `reloadTimeMinutes * 60` to seconds, applies research reduction via formula `base × (1 - modifier/100)`, enforces 1-second minimum

4. Remove `cooldown` property from `WeaponSpec` interface in [TechFactory.ts](src/lib/server/techs/TechFactory.ts#L30): Delete the property and all values in weapon catalog (lines 72, 88, 104, 120, 136, 152)

5. Remove `cooldown` from `BattleStats.weapons` in [battleTypes.ts](src/lib/server/battle/battleTypes.ts#L62-L68): This field stored static cooldowns per weapon, no longer needed since calculation is dynamic

6. Modify `fireWeapon()` in [battleScheduler.ts](src/lib/server/battle/battleScheduler.ts#L266-L398): After line 296 where `attackerUser` is retrieved, call `TechFactory.calculateModifiedReloadTime(weaponType, attackerUser.techTree)` and use result for `nextReadyTime` calculation (replace lines 340 and 396)

7. Remove cooldown initialization from `createBattleStats()` in [battleService.ts](src/lib/server/battle/battleService.ts#L69-L91): Delete the `cooldown: spec.cooldown` assignment since weapons object no longer stores cooldowns

8. Update tests in [techtree.test.ts](src/__tests__/lib/techtree.test.ts): Add test suite for `getWeaponCooldownModifierFromTree()` with projectile weapons (Level 1→10%, Level 2→20%) and energy weapons (Level 1→15%, Level 2→30%)

9. Update tests in [TechFactory.test.ts](src/__tests__/lib/TechFactory.test.ts): Add tests for `calculateModifiedReloadTime()` covering: base conversion (12 min → 720s), research reduction (10% → 648s), minimum enforcement (99% reduction → 1s not 7.2s)

10. Update integration tests in [battle-flow-e2e.test.ts](src/__tests__/integration/battle-flow-e2e.test.ts), [battleScheduler.test.ts](src/__tests__/lib/battle/battleScheduler.test.ts), [battlecache-simple.test.ts](src/__tests__/integration/battlecache-simple.test.ts): Remove hardcoded cooldown expectations, add research level variations, verify weapons fire at correct intervals (720s base → 360s at 50% research)

11. Mark `ProjectileReloadRate` and `EnergyRechargeRate` as implemented in [techtree.ts](src/lib/server/techs/techtree.ts#L41-L47): Add both to `IMPLEMENTED_RESEARCHES` set

**Verification**

- Run `npm test` - all tests pass with new reload time calculations
- Start battle with Level 1 research: pulse_laser fires every 720s (12 min)
- Trigger research to Level 2 during battle: next shot fires earlier (648s = 10.8 min)
- Verify Level 10 ProjectileReloadRate (100% reduction): cooldown floors at 1 second
- Check Factory Page still displays original reloadTimeMinutes values
- Verify mixed weapon battles: projectile weapons use ProjectileReloadRate, energy weapons use EnergyRechargeRate

**Decisions**

- Chose dynamic calculation over snapshot: Allows strategic research timing during battles
- Chose 1s minimum over percentage: Simple absolute floor prevents instant-fire exploits
- Chose modification at fireWeapon level: Centralized logic, respects latest research state
