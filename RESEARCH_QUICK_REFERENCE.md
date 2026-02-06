# Research System Quick Reference

## Implementation Status at a Glance

### ✅ IMPLEMENTED (9/26 = 35%)

| Research | Category | Effect | Implementation |
|----------|----------|--------|----------------|
| IronHarvesting | Economy | Iron per second | user.ts (iron accumulation) |
| ShipSpeed | Ship | Base travel speed | user.ts, navigate/route.ts, ship-stats/route.ts |
| Afterburner | Ship | Speed boost % | ship-stats/route.ts (max speed calc) |
| InventoryCapacity | Economy | Iron storage | user.ts (max capacity) |
| HullStrength | Defense | Hull effectiveness | TechService.ts (defense calc) |
| ArmorEffectiveness | Defense | Armor effectiveness | TechService.ts (defense calc) |
| ShieldEffectiveness | Defense | Shield effectiveness | TechService.ts (defense calc) |
| ProjectileDamage | Weapons | Projectile damage | techtree.ts (damage modifier) |
| EnergyDamage | Weapons | Energy damage | techtree.ts (damage modifier) |

### ❌ NOT IMPLEMENTED (17/26 = 65%)

| Research | Category | Intended Effect | Status |
|----------|----------|-----------------|--------|
| ProjectileReloadRate | Weapons | Reduce reload time | No backend logic |
| ProjectileAccuracy | Weapons | Improve accuracy | No backend logic |
| ProjectileWeaponTier | Weapons | Unlock higher tiers | No backend logic |
| EnergyRechargeRate | Weapons | Increase recharge | No backend logic |
| EnergyAccuracy | Weapons | Improve accuracy | No backend logic |
| EnergyWeaponTier | Weapons | Unlock higher tiers | No backend logic |
| RepairSpeed | Defense | Repair rate | No backend logic |
| ShieldRechargeRate | Defense | Shield regen | No backend logic |
| AfterburnerSpeedIncrease | Ship | Afterburner boost | No backend logic |
| AfterburnerDuration | Ship | Afterburner time | No backend logic |
| Teleport | Ship | Teleport range | No backend logic |
| ConstructionSpeed | Economy | Build time | No backend logic |
| SpyChance | Spy | Mission success | No backend logic |
| SpySpeed | Spy | Mission time | No backend logic |
| SpySabotageDamage | Spy | Sabotage damage | No backend logic |
| Counterintelligence | Spy | Defend against spies | No backend logic |
| StealIron | Spy | Iron stolen | No backend logic |

## Code Duplication Matrix

| Component | Backend | Frontend | Duplicated? |
|-----------|---------|----------|-------------|
| ResearchType | techtree.ts | researchService.ts | ❌ YES |
| TechTree interface | techtree.ts | researchService.ts | ❌ YES |
| Type→Key mapping | AllResearches.treeKey | researchTypeToKey | ❌ YES |
| Research metadata | techtree.ts | API response | ✅ NO (single source) |
| Effect calculations | techtree.ts | API response | ✅ NO (single source) |
| UI hierarchy | - | ResearchPageClient.tsx | ✅ NO (UI only) |

## Quick Implementation Guide

### To Hide Unimplemented Researches (Recommended)

**File:** `src/lib/server/techs/techtree.ts`

```typescript
// Add near top of file
export const IMPLEMENTED_RESEARCHES: ReadonlySet<ResearchType> = new Set([
  ResearchType.IronHarvesting,
  ResearchType.ShipSpeed,
  ResearchType.Afterburner,
  ResearchType.InventoryCapacity,
  ResearchType.HullStrength,
  ResearchType.ArmorEffectiveness,
  ResearchType.ShieldEffectiveness,
  ResearchType.ProjectileDamage,
  ResearchType.EnergyDamage,
]);
```

**File:** `src/app/api/techtree/route.ts`

```typescript
// In processTechTree function, replace line 48-61 with:
(Object.values(ResearchType) as ResearchType[])
  .filter(type => IMPLEMENTED_RESEARCHES.has(type)) // ADD THIS LINE
  .forEach(type => {
    // ... rest of code
  });
```

### To Implement a New Research

1. **Add backend logic** in appropriate service file
2. **Use `getResearchEffectFromTree()`** to get the research value
3. **Add tests** to verify the research has an effect
4. **Add to IMPLEMENTED_RESEARCHES** set
5. **Update this reference document**

## Priority Implementation Order

Based on game impact:

1. **High Priority (Combat):**
   - ProjectileReloadRate, ProjectileAccuracy
   - EnergyRechargeRate, EnergyAccuracy
   - RepairSpeed, ShieldRechargeRate

2. **Medium Priority (Quality of Life):**
   - AfterburnerSpeedIncrease, AfterburnerDuration
   - ConstructionSpeed
   - ProjectileWeaponTier, EnergyWeaponTier

3. **Low Priority (Advanced Features):**
   - Teleport
   - All Spy researches (requires spy system)

## Files to Review

**Backend Core:**
- `src/lib/server/techs/techtree.ts` - Research definitions
- `src/lib/server/user/user.ts` - User domain logic
- `src/lib/server/techs/TechService.ts` - Tech/defense calculations

**Backend API:**
- `src/app/api/techtree/route.ts` - Get tech tree
- `src/app/api/trigger-research/route.ts` - Start research

**Frontend:**
- `src/app/research/ResearchPageClient.tsx` - Research UI
- `src/lib/client/services/researchService.ts` - Client service

**Tests:**
- `src/__tests__/lib/techtree.test.ts` - Research calculations
- `src/__tests__/lib/user-domain.test.ts` - User stats with research
- `src/__tests__/api/trigger-research-api.test.ts` - API integration

---

**Full details in:** [RESEARCH_ANALYSIS_REPORT.md](./RESEARCH_ANALYSIS_REPORT.md)
