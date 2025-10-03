# Implementation Plan: Defense Values Display on Home Page

## Overview
Add hull, armor, and shield display to the home page with current/max values and client-side regeneration.

## Requirements Summary
- **Display Format**: `Name | Current | Max` (e.g., "Kinetic Armor | 500 | 500")
- **Defense Types**: 
  - Ship Hull (`ship_hull`)
  - Kinetic Armor (`kinetic_armor`)
  - Energy Shield (`energy_shield`)
- **Value Calculations**:
  - Max Value = `100 × tech_count` (where tech_count is the number of that defense type)
  - Current Value = `max / 2` (hardcoded for now, not persisted)
  - Regen Rate = `1 per second` (hardcoded for now)
- **Update Frequency**: Frontend updates every second (client-side calculation)
- **Endpoint**: Extend existing `/api/ship-stats` endpoint (best fit since it's ship-related data)

## Phase 1: Backend Implementation (5 Tasks)

### Task 1: Type Definitions ✅
**File**: `src/shared/defenseValues.ts` (NEW)
**Description**: Create shared type definitions for defense values
**Implementation**:
```typescript
export interface DefenseValues {
  hull: DefenseValue;
  armor: DefenseValue;
  shield: DefenseValue;
}

export interface DefenseValue {
  name: string;
  current: number;
  max: number;
  regenRate: number; // per second
}
```
**Testing**: Type checking via TypeScript compilation

---

### Task 2: Business Logic for Defense Calculations ✅
**File**: `src/lib/server/TechFactory.ts`
**Description**: Add method to calculate defense values based on tech counts
**Implementation**:
```typescript
static calculateDefenseValues(techCounts: TechCounts): DefenseValues {
  return {
    hull: {
      name: 'Ship Hull',
      current: (techCounts.ship_hull * 100) / 2,
      max: techCounts.ship_hull * 100,
      regenRate: 1
    },
    armor: {
      name: 'Kinetic Armor',
      current: (techCounts.kinetic_armor * 100) / 2,
      max: techCounts.kinetic_armor * 100,
      regenRate: 1
    },
    shield: {
      name: 'Energy Shield',
      current: (techCounts.energy_shield * 100) / 2,
      max: techCounts.energy_shield * 100,
      regenRate: 1
    }
  };
}
```
**Testing**: Unit tests in `TechFactory.test.ts`

---

### Task 3: Endpoint Extension ✅
**File**: `src/app/api/ship-stats/route.ts`
**Description**: Extend `/api/ship-stats` endpoint to include defense values
**Changes**:
- Import `TechFactory.calculateDefenseValues`
- Import tech counts from user's tech repository
- Add `defenseValues` to response data
**Response Format**:
```typescript
{
  x: number,
  y: number,
  speed: number,
  angle: number,
  maxSpeed: number,
  last_position_update_ms: number,
  defenseValues: DefenseValues  // NEW
}
```
**Testing**: API integration test

---

### Task 4: Backend Tests ✅
**File**: `src/__tests__/lib/TechFactory.test.ts`
**Description**: Add comprehensive tests for defense value calculations
**Test Cases**:
- `calculateDefenseValues_withZeroTechs_returnsZeroValues`
- `calculateDefenseValues_withSingleTech_returnsCorrectValues`
- `calculateDefenseValues_withMultipleTechs_calculatesIndependently`
- `calculateDefenseValues_allDefensesPresent_returnsCorrectCalculations`
**Expected**: All tests pass

---

### Task 5: Update API Documentation ✅
**File**: `doc/hookArchitecture.md`
**Description**: Update ship-stats endpoint documentation
**Changes**:
- Add defense values to endpoint response description
- Document calculation formulas

---

## Phase 2: Frontend Implementation (5 Tasks)

### Task 6: Defense Values Service ✅
**File**: `src/lib/client/services/shipStatsService.ts`
**Description**: Update service to handle new defense values from API
**Changes**:
- Update `ShipStatsResponse` interface to include `defenseValues`
- Service already exists, just update types
**Testing**: Integration with hook

---

### Task 7: Custom Hook - useDefenseValues ✅
**File**: `src/lib/client/hooks/useDefenseValues.ts` (NEW)
**Description**: Create hook for defense values with client-side regeneration
**Features**:
- Fetch defense values from `/api/ship-stats`
- Client-side regeneration every second
- Clamp current values at max (no overflow)
- Poll server every 5 seconds for updates
- Listen to build completion events to refresh
**Implementation Pattern**: Similar to `useIron.ts`
**Return Type**:
```typescript
interface UseDefenseValuesReturn {
  defenseValues: DefenseValues | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
```
**Testing**: Hook unit tests

---

### Task 8: Update Home Page UI ✅
**File**: `src/app/home/HomePageClient.tsx`
**Description**: Add defense values section to home page
**Changes**:
- Import and use `useDefenseValues` hook
- Add new table section "Defense Values" between Notifications and Tech Inventory
- Display each defense type with: `Name | Current | Max`
- Handle loading and error states
**UI Structure**:
```tsx
<table className="data-table">
  <thead>
    <tr>
      <th colSpan={3}>Defense Values</th>
    </tr>
  </thead>
  <tbody>
    <tr className="data-row">
      <td className="data-cell">Ship Hull</td>
      <td className="data-cell">{hull.current}</td>
      <td className="data-cell">{hull.max}</td>
    </tr>
    {/* Similar for armor and shield */}
  </tbody>
</table>
```
**Testing**: Manual browser testing

---

### Task 9: CSS Styling ✅
**File**: `src/app/home/HomePage.css`
**Description**: Add styling for defense values section
**Changes**:
- Ensure consistent table styling with existing sections
- Add special styling for defense value cells if needed
- Ensure responsive design
**Testing**: Visual inspection in browser

---

### Task 10: Frontend Tests ✅
**File**: `src/__tests__/lib/hooks/useDefenseValues.test.ts` (NEW)
**Description**: Add tests for useDefenseValues hook
**Test Cases**:
- `useDefenseValues_initialLoad_fetchesFromAPI`
- `useDefenseValues_clientSideRegen_incrementsCurrentValues`
- `useDefenseValues_regenClamping_stopsAtMaxValue`
- `useDefenseValues_buildCompleteEvent_triggersRefetch`
- `useDefenseValues_apiError_setsErrorState`
**Expected**: All tests pass

---

## Phase 3: Integration & Testing (3 Tasks)

### Task 11: Manual End-to-End Testing ✅
**Description**: Test complete feature in browser
**Test Steps**:
1. Start dev server (`npm run dev`)
2. Login to application
3. Navigate to home page
4. Verify defense values display correctly
5. Verify values regenerate every second
6. Build a defense item in factory
7. Verify defense values update after build completion
8. Check that current values don't exceed max values
9. Take screenshot of home page with defense values displayed
**Expected**: All functionality works as designed

---

### Task 12: Linting & Compilation ✅
**Description**: Ensure code quality
**Commands**:
```bash
npm run lint        # Should pass with no new errors
npm run build       # Should compile successfully
npm test -- --run   # All tests should pass
```
**Expected**: No errors, all checks pass

---

### Task 13: Documentation Updates ✅
**Files**: 
- `.github/copilot-instructions.md`
- `doc/hookArchitecture.md`
**Changes**:
- Add defense values feature to project description
- Document new endpoint response format
- Add `useDefenseValues` hook to hook architecture docs
- Update API endpoint reference
**Testing**: Documentation review

---

## Open Questions & Future Enhancements

### Open Questions (Not Blocking Implementation)
1. **Current Value Persistence**: Should current defense values be persisted in the database?
   - *Current*: Hardcoded at max/2, resets on page refresh
   - *Future*: Store in user table and update on damage/regen

2. **Dynamic Regen Rate**: Should regeneration rate vary based on other techs?
   - *Current*: Hardcoded at 1/second
   - *Future*: Influenced by shield recharge tech, repair systems, etc.

3. **Damage System**: How will defense values decrease?
   - *Current*: No damage system implemented
   - *Future*: Combat system that reduces current values

4. **Other Pages**: Should defense values appear on other pages?
   - *Current*: Only on home page
   - *Future*: Maybe on game page, profile page, etc.

### Future Enhancements
- Add visual progress bars for current/max values
- Add color coding (green = healthy, yellow = damaged, red = critical)
- Add shield recharge animation
- Add notifications when defense values are low
- Integrate with combat system (when implemented)
- Add defense upgrade tech that affects regen rates

---

## Implementation Strategy

### Order of Implementation
1. **Backend First**: Complete all backend tasks (1-5) before frontend
2. **Frontend Second**: Complete all frontend tasks (6-10) after backend is solid
3. **Integration Last**: Test everything together (11-13)

### Testing Strategy
- **Unit Tests**: Test business logic and hooks in isolation
- **Integration Tests**: Test API endpoints with real requests
- **Manual Tests**: Verify UI and UX in browser
- **Regression Tests**: Ensure existing features still work

### Rollback Plan
- All changes are additive (no breaking changes)
- If issues arise, can disable feature by:
  - Commenting out defense values section in HomePageClient
  - Removing defenseValues from ship-stats response
  - No database changes means easy rollback

---

## Success Criteria

✅ **Backend**:
- [ ] Defense values calculated correctly from tech counts
- [ ] Ship-stats endpoint returns defense values
- [ ] All backend tests pass

✅ **Frontend**:
- [ ] Defense values display on home page
- [ ] Values regenerate every second client-side
- [ ] Current values clamp at max values
- [ ] All frontend tests pass

✅ **Integration**:
- [ ] Manual testing confirms correct behavior
- [ ] No lint errors introduced
- [ ] Build compiles successfully
- [ ] No regression in existing features

✅ **Documentation**:
- [ ] API documentation updated
- [ ] Hook architecture documented
- [ ] Copilot instructions updated

---

## Estimated Effort
- **Backend**: ~2-3 hours
- **Frontend**: ~2-3 hours
- **Testing & Integration**: ~1-2 hours
- **Total**: ~5-8 hours

---

## Notes & Decisions

### Decision: Endpoint Choice
**Options Considered**:
1. Extend `/api/user-stats` (already returns iron and user data)
2. Extend `/api/ship-stats` (returns ship position and speed)
3. Create new `/api/defense-values` endpoint

**Decision**: Extend `/api/ship-stats` ✅
**Rationale**: 
- Defense values are ship-related properties (like speed, position)
- Keeps user-stats focused on resources (iron, generation rates)
- Avoids creating another endpoint for related data
- Ship-stats already loads user data to calculate max speed from tech tree

### Decision: Client-Side Regeneration
**Approach**: Calculate regeneration on client, resync with server every 5 seconds
**Rationale**:
- Smooth UI updates without constant server requests
- Same pattern as `useIron` hook (proven to work well)
- Server provides authoritative values, client interpolates
- Reduces server load significantly

### Decision: Hardcoded Values (Current Implementation)
**Current Values**: max/2 (not persisted)
**Regen Rate**: 1/second (not configurable)
**Rationale**:
- Requirements specify hardcoded for now
- Allows quick implementation and UI testing
- Easy to extend later with database persistence
- No premature optimization

---

**Status**: Ready for Implementation
**Created**: 2025-09-29
**Author**: AI Assistant
**Reviewed**: Pending
