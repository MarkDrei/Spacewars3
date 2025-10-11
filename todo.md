# Afterburner Implementation Plan

## Overview
Implement the afterburner feature that allows ships to temporarily boost their speed based on research levels.

## Requirements Analysis
Based on the problem statement:
1. Default level 1 duration shall be 60 seconds (currently shows 5 seconds in research display)
2. Add columns to space_objects table:
   - `afterburner_boosted_speed` (nullable REAL): New max speed when afterburner is active
   - `afterburner_cooldown_end_ms` (nullable INTEGER): Timestamp when cooldown ends
   - `afterburner_old_max_speed` (nullable REAL): Original max speed before afterburner
3. When afterburner is triggered:
   - Set the new boosted speed in both backend and frontend
   - Store old max speed
   - Set cooldown end timestamp
4. World update loop needs to:
   - Check if cooldown is reached
   - If cooldown reached, this is a condition to calculate world update only to this point
   - Set cooldown to null
   - Restore old max speed to current speed (unless current speed is lower, then keep current)
5. Add afterburner trigger button to Game page (src/app/game/page.tsx)

## Open Questions & Assumptions

### Questions:
1. **Duration Value Mismatch**: Problem states "level 1 duration shall default to 60 seconds" but research config shows "baseValue: 5". 
   - **Assumption**: Change baseValue from 5 to 60 in AfterburnerDuration research config
   
2. **Speed Calculation**: How is the boosted speed calculated?
   - **Assumption**: Based on existing code in ship-stats/route.ts:
     - Base speed = ShipSpeed research effect
     - Afterburner bonus = AfterburnerSpeedIncrease research effect (percentage)
     - Boosted speed = base_speed * (1 + afterburner_speed_increase/100)
   
3. **Cooldown Behavior**: What happens during cooldown? Can user trigger again?
   - **Assumption**: Afterburner cannot be triggered while on cooldown or already active
   
4. **Speed Restoration**: "restore old max speed to current speed" - what does this mean exactly?
   - **Assumption**: When cooldown ends, set ship's current speed to the old max speed, BUT if the current speed is already lower than the old max speed, leave it as is. This prevents forcing the ship to speed up.

5. **Multiple Ships**: Do we need to handle multiple player ships?
   - **Assumption**: Based on existing code, each user has one ship (user.ship_id), so we handle per-ship afterburner state

6. **Afterburner API**: Should there be a separate API endpoint?
   - **Assumption**: Yes, create `/api/afterburner` endpoint following existing patterns

7. **Frontend Updates**: How does frontend know about cooldown status?
   - **Assumption**: Ship stats should include afterburner status (active, cooldown_remaining_ms, can_activate)

8. **World Update Partial Calculation**: "calculate world update only to this point" - what does this mean?
   - **Assumption**: When updating physics, if an afterburner cooldown ends during the elapsed time, we need to:
     - Calculate physics up to the cooldown end time
     - Restore speed at that point
     - Continue physics calculation from cooldown end to current time

## Implementation Steps

### Step 1: Update Database Schema
- [ ] Add migration to add afterburner columns to space_objects table
- [ ] Update CREATE_SPACE_OBJECTS_TABLE with new columns
- [ ] Update SpaceObject interface in world.ts
- [ ] Test: Verify schema changes apply correctly

### Step 2: Fix AfterburnerDuration Base Value
- [ ] Change baseValue from 5 to 60 in techtree.ts for AfterburnerDuration
- [ ] Update any tests that depend on this value
- [ ] Test: Run existing tests to ensure no breakage

### Step 3: Create Afterburner API Endpoint
- [ ] Create /api/afterburner/route.ts
- [ ] Implement POST handler with proper locking (worldWrite + userLock)
- [ ] Validate afterburner can be triggered (not on cooldown, not already active)
- [ ] Calculate boosted speed based on research levels
- [ ] Update space_object with afterburner state
- [ ] Return success with new ship state
- [ ] Test: Create afterburner-api.test.ts with test cases

### Step 4: Update World Physics for Afterburner Cooldown
- [ ] Modify world.updatePhysics() to handle afterburner cooldown
- [ ] Implement partial physics updates when cooldown ends mid-update
- [ ] Restore speed when cooldown ends (respecting lower current speeds)
- [ ] Clear afterburner state fields
- [ ] Test: Create world physics tests for afterburner scenarios

### Step 5: Update Ship Stats API
- [ ] Modify /api/ship-stats to include afterburner status
- [ ] Add fields: isAfterburnerActive, afterburnerCooldownRemainingMs, canActivateAfterburner
- [ ] Test: Update ship-stats tests

### Step 6: Create Frontend Service
- [ ] Create afterburner service in lib/client/services/
- [ ] Add triggerAfterburner() function
- [ ] Add getAfterburnerStatus() function
- [ ] Test: Create service tests if applicable

### Step 7: Update Game Page UI
- [ ] Add afterburner button to GamePageClient.tsx
- [ ] Show button state (available, active, cooldown)
- [ ] Handle button click to trigger afterburner
- [ ] Display cooldown timer if active
- [ ] Test: Manual UI testing

### Step 8: Integration Testing
- [ ] Test complete flow: trigger → active → cooldown → restore
- [ ] Test edge cases (trigger while moving, trigger at rest, etc.)
- [ ] Test multiple sequential triggers
- [ ] Run full test suite: npm run ci

### Step 9: Documentation
- [ ] Update any relevant documentation
- [ ] Add comments to complex logic

## Test Cases to Add

### Database Schema Tests
- Migration applies correctly
- Columns are nullable
- Default values are correct

### Afterburner API Tests
- triggerAfterburner_validRequest_activatesAfterburner
- triggerAfterburner_alreadyActive_returns400
- triggerAfterburner_onCooldown_returns400
- triggerAfterburner_notAuthenticated_returns401
- triggerAfterburner_afterburnerNotResearched_returns400

### World Physics Tests
- updatePhysics_afterburnerCooldownEnds_restoresSpeed
- updatePhysics_afterburnerCooldownEnds_keepsLowerSpeed
- updatePhysics_cooldownEndsMidUpdate_splitsCalculation
- updatePhysics_noAfterburnerActive_normalPhysics

### Ship Stats Tests
- shipStats_afterburnerActive_returnsCorrectStatus
- shipStats_afterburnerOnCooldown_returnsRemainingTime
- shipStats_canActivate_returnsTrue

## Technical Decisions

1. **Storage**: Afterburner state stored on space_objects table (per ship)
2. **Time Units**: Cooldown stored as milliseconds (consistent with other timestamps)
3. **Speed Values**: All speed values stored as REAL (floating point)
4. **Lock Pattern**: Follow existing pattern (worldWrite + userLock for modifications)
5. **Cooldown Duration**: Equals AfterburnerDuration research value (in seconds)

## Dependencies
- Existing research system (AfterburnerSpeedIncrease, AfterburnerDuration)
- World physics system
- Lock management system
- Space objects table

## Notes
- Afterburner must be researched (level > 0) before it can be used
- AfterburnerSpeedIncrease determines the speed boost percentage
- AfterburnerDuration determines how long the boost lasts
- The cooldown equals the duration (boost lasts for duration seconds)
