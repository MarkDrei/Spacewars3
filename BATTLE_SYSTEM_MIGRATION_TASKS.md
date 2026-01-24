# Battle System Migration Tasks

## Overview
Migration of master branch battle system features to PostgreSQL branch.

## Critical Missing Features

### 1. DAMAGE_CALC_DEFAULTS Constants
**Location**: `src/lib/server/battle/battleTypes.ts`
**Status**: ❌ Missing
**Priority**: HIGH - Affects game balance

**Action**: Add the following constants to battleTypes.ts:
```typescript
export const DAMAGE_CALC_DEFAULTS = {
  POSITIVE_ACCURACY_MODIFIER: 0,
  NEGATIVE_ACCURACY_MODIFIER: 0,
  BASE_DAMAGE_MODIFIER: 1.0,
  ECM_EFFECTIVENESS: 0,
  SPREAD_VALUE: 1.0
};
```

### 2. Weapon Damage Modifier Function
**Location**: `src/lib/server/techs/techtree.ts`
**Status**: ❌ Missing
**Priority**: HIGH - Required for TechFactory integration

**Action**: Add the following to techtree.ts:
```typescript
const PROJECTILE_WEAPONS = ['machine_gun', 'flak_cannon', 'rocket_launcher'] as const;
const ENERGY_WEAPONS = ['pulse_laser', 'plasma_cannon', 'photon_torpedo'] as const;

export function getWeaponDamageModifierFromTree(tree: TechTree, weaponType: string): number {
  let researchType: ResearchType;
  if (PROJECTILE_WEAPONS.includes(weaponType as typeof PROJECTILE_WEAPONS[number])) {
    researchType = ResearchType.ProjectileDamage;
  } else if (ENERGY_WEAPONS.includes(weaponType as typeof ENERGY_WEAPONS[number])) {
    researchType = ResearchType.EnergyDamage;
  } else {
    return 1.0;
  }
  
  const research = AllResearches[researchType];
  if (research.baseValue === 0) {
    return 1.0;
  }
  const effect = getResearchEffectFromTree(tree, researchType);
  return effect / research.baseValue;
}
```

### 3. BattleScheduler Utils
**Location**: `src/lib/server/battle/battleSchedulerUtils.ts` (new file)
**Status**: ❌ Missing
**Priority**: MEDIUM - Required for testability

**Action**: Create battleSchedulerUtils.ts with:
- TimeProvider interface
- realTimeProvider implementation
- setupBattleScheduler function
- cancelBattleScheduler function
- BattleSchedulerConfig type

### 4. Update BattleScheduler to Use TechFactory
**Location**: `src/lib/server/battle/battleScheduler.ts`
**Status**: ❌ Needs update
**Priority**: HIGH - Critical for game balance

**Changes Needed**:
1. Import DAMAGE_CALC_DEFAULTS from battleTypes
2. Import getWeaponDamageModifierFromTree from techtree
3. Import TechCounts from TechFactory
4. Update fireWeapon() function to:
   - Acquire USER_LOCK
   - Get attacker and defender users from UserCache
   - Call TechFactory.calculateWeaponDamage() with proper parameters
   - Use calculated damage values (shieldDamage, armorDamage, hullDamage)
   - Apply damage using UserCache instead of BattleEngine

### 5. Add Dependency Injection to BattleScheduler (Optional)
**Location**: `src/lib/server/battle/battleScheduler.ts`
**Status**: ❌ Missing
**Priority**: MEDIUM - Improves testability

**Changes Needed**:
- Add initializeBattleScheduler() function
- Add resetBattleScheduler() function
- Add module-level config
- Add getTimeProvider() and getCurrentTime() helpers
- Update startBattleScheduler() to use setupBattleScheduler
- Update stopBattleScheduler() to use cancelBattleScheduler

## Implementation Order

1. ✅ Add DAMAGE_CALC_DEFAULTS to battleTypes.ts
2. ✅ Add getWeaponDamageModifierFromTree to techtree.ts
3. ✅ Update battleScheduler.ts fireWeapon() to use TechFactory
4. ⬜ Create battleSchedulerUtils.ts (optional, for testability)
5. ⬜ Add dependency injection to battleScheduler.ts (optional)
6. ⬜ Run tests and fix any issues
7. ⬜ Verify game balance is correct

## Testing Strategy

After each change:
1. Run targeted tests: `npm test -- battleScheduler`
2. Run full battle tests: `npm test -- battle`
3. Verify no regressions in other areas

## Notes

- The current PostgreSQL version already has proper cache delegation
- resolveBattle() is correctly in battleService.ts
- Damage tracking (total_damage) is already implemented
- End stats persistence is already implemented

## Success Criteria

- [ ] All master branch battle features present
- [ ] TechFactory.calculateWeaponDamage used for damage calculation
- [ ] Damage modifiers from research properly applied
- [ ] All battle tests pass
- [ ] Game balance matches master branch behavior
