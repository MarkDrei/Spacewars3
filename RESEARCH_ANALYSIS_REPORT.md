# Research System Analysis Report

**Date:** 2026-02-04  
**Analyzed Files:**
- `src/lib/server/techs/techtree.ts` - Backend research definitions
- `src/app/research/ResearchPageClient.tsx` - Frontend UI
- `src/lib/client/services/researchService.ts` - Client service
- `src/lib/server/techs/TechService.ts` - Backend tech service
- `src/lib/server/user/user.ts` - User domain logic

---

## Executive Summary

The game has **26 researches defined** in the tech tree, but only **7 are fully implemented** in the game logic. There is **significant code duplication** between the UI and backend for research definitions and statistics. Most researches exist in the database and UI but have no functional effect on gameplay.

---

## Complete Research Inventory

### ✅ FULLY IMPLEMENTED (7 researches)

These researches have complete backend logic and affect gameplay:

1. **IronHarvesting** - Determines iron collection rate per second
   - Implementation: `user.ts` lines 75, 130, 136, 141, 146
   - Used in: Iron accumulation calculations, research progress tracking

2. **ShipSpeed** - Determines base ship travel speed
   - Implementation: `user.ts` line 79, `ship-stats/route.ts` line 56, `navigate/route.ts` line 90
   - Used in: Ship movement, navigation calculations

3. **Afterburner** - Provides speed boost percentage
   - Implementation: `ship-stats/route.ts` line 57
   - Used in: Max speed calculation: `baseSpeed * (1 + afterburnerBonus / 100)`

4. **InventoryCapacity** - Increases iron storage capacity
   - Implementation: `user.ts` line 90
   - Used in: Maximum iron storage limit

5. **HullStrength** - Increases hull effectiveness per hull plate
   - Implementation: `TechService.ts` line 280
   - Used in: Defense value calculations

6. **ArmorEffectiveness** - Increases armor value per armor plate
   - Implementation: `TechService.ts` line 281
   - Used in: Defense value calculations

7. **ShieldEffectiveness** - Increases shield value per shield installed
   - Implementation: `TechService.ts` line 282
   - Used in: Defense value calculations

8. **ProjectileDamage** & **EnergyDamage** - Weapon damage modifiers
   - Implementation: `techtree.ts` lines 639-659 (`getWeaponDamageModifierFromTree`)
   - Used in: Weapon damage calculations for both projectile and energy weapons

---

### ⚠️ PARTIALLY IMPLEMENTED (0 researches)

No researches are in a partially implemented state.

---

### ❌ NOT IMPLEMENTED (17 researches)

These researches are defined in the tech tree and UI but have **NO backend logic**:

**Projectile Weapons (3):**
9. ProjectileReloadRate - Should reduce reload time
10. ProjectileAccuracy - Should improve accuracy
11. ProjectileWeaponTier - Should unlock higher tier weapons

**Energy Weapons (3):**
12. EnergyRechargeRate - Should increase recharge rate
13. EnergyAccuracy - Should improve accuracy
14. EnergyWeaponTier - Should unlock higher tier weapons

**Defense (2):**
15. RepairSpeed - Should increase repair rate for hull/armor/engine
16. ShieldRechargeRate - Should increase shield regeneration rate

**Ship (5):**
17. AfterburnerSpeedIncrease - Should increase afterburner speed boost
18. AfterburnerDuration - Should increase afterburner duration
19. Teleport - Should unlock/improve teleport range
20. ConstructionSpeed - Should reduce construction time

**Spies (5):**
21. SpyChance - Should increase spy mission success rate
22. SpySpeed - Should reduce spy mission time
23. SpySabotageDamage - Should increase sabotage damage
24. Counterintelligence - Should reduce enemy spy success
25. StealIron - Should increase iron stolen by spies

---

## Code Duplication Analysis

### 1. Research Type Definitions - DUPLICATED ✗

**Backend:** `src/lib/server/techs/techtree.ts` lines 9-41
```typescript
export enum ResearchType {
  IronHarvesting = 'IronHarvesting',
  ShipSpeed = 'shipSpeed',
  // ... 26 entries
}
```

**Frontend:** `src/lib/client/services/researchService.ts` lines 56-87
```typescript
type ResearchType = 
  | 'IronHarvesting' 
  | 'ShipSpeed' 
  // ... 26 entries
```

**Issue:** Type definitions are maintained separately, requiring manual synchronization.

---

### 2. Research Metadata (AllResearches) - SINGLE SOURCE ✓

**Good:** Research metadata is defined **only once** in the backend at `techtree.ts` lines 63-407.

The backend API endpoint `/api/techtree` sends this data to the frontend, avoiding duplication.

---

### 3. Tech Tree Structure - DUPLICATED ✗

**Backend:** `src/lib/server/techs/techtree.ts` lines 420-460
```typescript
export interface TechTree {
  ironHarvesting: number;
  shipSpeed: number;
  afterburner: number;
  // ... all 26 fields
}
```

**Frontend:** `src/lib/client/services/researchService.ts` lines 1-37
```typescript
interface TechTree {
  ironHarvesting: number;
  shipSpeed: number;
  afterburner: number;
  // ... all 26 fields
}
```

**Issue:** Structure is maintained in two places and must be kept in sync.

---

### 4. Research Hierarchy for UI - FRONTEND ONLY ✓

**Location:** `src/app/research/ResearchPageClient.tsx` lines 46-136

**Good:** This is UI-specific grouping and doesn't duplicate game logic.

---

### 5. Research Type to Tree Key Mapping - DUPLICATED ✗

**Backend:** Each research in `AllResearches` has a `treeKey` property (lines 63-407)

**Frontend:** `ResearchPageClient.tsx` lines 12-44 defines `researchTypeToKey` mapping

**Issue:** The mapping is maintained in two places.

---

### 6. Effect Calculation Logic - SINGLE SOURCE ✓

**Good:** All effect calculations (`getResearchEffect`, `getResearchUpgradeCost`, etc.) are **only** in the backend (`techtree.ts` lines 570-612).

The frontend receives calculated values via API, avoiding logic duplication.

---

## Summary of Duplication Issues

| Item | Backend Location | Frontend Location | Status |
|------|-----------------|-------------------|--------|
| ResearchType enum/type | techtree.ts | researchService.ts | ❌ DUPLICATED |
| AllResearches metadata | techtree.ts | - | ✅ SINGLE SOURCE |
| TechTree interface | techtree.ts | researchService.ts | ❌ DUPLICATED |
| Type-to-Key mapping | AllResearches.treeKey | researchTypeToKey | ❌ DUPLICATED |
| Effect calculations | techtree.ts | - | ✅ SINGLE SOURCE |
| UI hierarchy | - | ResearchPageClient.tsx | ✅ UI-ONLY |

---

## How to Hide Unimplemented Researches

To temporarily hide unimplemented researches from the UI, there are **three approaches**:

### Option 1: Filter in Backend API (RECOMMENDED)

**Location:** Create/modify `/api/techtree` endpoint

**Method:** Return only implemented researches in the API response

**Pros:** 
- Clean separation - backend controls what's visible
- No frontend changes needed
- Easy to toggle on/off
- Type-safe

**Implementation:**
```typescript
const IMPLEMENTED_RESEARCHES = [
  ResearchType.IronHarvesting,
  ResearchType.ShipSpeed,
  ResearchType.Afterburner,
  ResearchType.InventoryCapacity,
  ResearchType.HullStrength,
  ResearchType.ArmorEffectiveness,
  ResearchType.ShieldEffectiveness,
  ResearchType.ProjectileDamage,
  ResearchType.EnergyDamage,
] as const;

// In API endpoint:
const researches = Object.entries(AllResearches)
  .filter(([type]) => IMPLEMENTED_RESEARCHES.includes(type as ResearchType))
  .reduce((acc, [type, research]) => {
    acc[type] = research;
    return acc;
  }, {});
```

---

### Option 2: Filter in Frontend UI

**Location:** `src/app/research/ResearchPageClient.tsx`

**Method:** Add a filter to `researchHierarchy` to exclude unimplemented researches

**Pros:**
- Quick to implement
- No backend changes

**Cons:**
- Data still sent over network
- Frontend must maintain list of implemented researches
- Less secure (users can still trigger via API directly)

**Implementation:**
```typescript
const IMPLEMENTED_RESEARCHES = new Set([
  'IronHarvesting',
  'ShipSpeed',
  'Afterburner',
  // ... etc
]);

// In render:
{category.nodes
  .filter(node => IMPLEMENTED_RESEARCHES.has(node.type))
  .flatMap(node => renderResearchNode(node, 0))}
```

---

### Option 3: Add 'implemented' Flag to AllResearches

**Location:** `src/lib/server/techs/techtree.ts`

**Method:** Add `implemented: boolean` field to Research interface

**Pros:**
- Self-documenting
- Single source of truth
- Easy to track implementation status

**Cons:**
- Requires updating Research interface
- More invasive change

**Implementation:**
```typescript
export interface Research {
  // ... existing fields
  implemented: boolean; // NEW FIELD
}

export const AllResearches: Record<ResearchType, Research> = {
  [ResearchType.IronHarvesting]: {
    // ... existing fields
    implemented: true,
  },
  [ResearchType.Teleport]: {
    // ... existing fields
    implemented: false,
  },
  // ...
};
```

---

## Recommendations

### Immediate Actions (for hiding unimplemented researches):

1. **Use Option 1** (Backend API filtering) as it's the cleanest approach
2. Add a constant `IMPLEMENTED_RESEARCHES` in `techtree.ts`
3. Filter researches in the `/api/techtree` endpoint
4. The frontend will automatically hide unimplemented researches

### Long-term Improvements:

1. **Reduce Code Duplication:**
   - Move `ResearchType` enum to a shared types file
   - Move `TechTree` interface to a shared types file
   - Generate type-to-key mapping automatically from `AllResearches`
   - Consider using a code generator or build step to ensure sync

2. **Implement Missing Researches:**
   - Prioritize based on game balance and feature importance
   - Start with weapon-related researches (reload rate, accuracy)
   - Then defense-related (repair speed, shield recharge)
   - Finally advanced features (teleport, spies)

3. **Add Implementation Tracking:**
   - Add `implemented` flag to Research interface
   - Add automated tests that verify implemented researches have actual effect
   - Document implementation status in code comments

4. **Improve Type Safety:**
   - Use TypeScript's type system to ensure backend and frontend types stay in sync
   - Consider using a schema validation library (zod, yup) for API contracts

---

## Files That Need Changes (for Option 1)

To implement Option 1 (recommended approach):

1. **`src/lib/server/techs/techtree.ts`**
   - Add `IMPLEMENTED_RESEARCHES` constant near top of file

2. **`src/app/api/techtree/route.ts`** (or create if doesn't exist)
   - Add filtering logic to return only implemented researches
   - Apply filter to both the researches dictionary and tech tree levels

---

## Testing Requirements

After hiding unimplemented researches:

1. Verify unimplemented researches don't appear in UI
2. Verify implemented researches still work correctly
3. Verify direct API calls to trigger unimplemented researches are rejected
4. Verify tech tree structure remains consistent
5. Test that upgrading still works for all visible researches

---

## Conclusion

The research system has a solid foundation with 7 fully implemented researches affecting gameplay. However, 17 researches are placeholders with no backend logic. There is moderate code duplication between frontend and backend for type definitions and structure, but the critical game logic (calculations, effects) is properly centralized in the backend.

**Recommended Next Step:** Implement Option 1 to hide unimplemented researches, then systematically implement the missing researches based on game design priorities.
