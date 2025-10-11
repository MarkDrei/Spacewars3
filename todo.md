# Teleportation Feature Implementation Plan

## Overview
Implement a teleportation feature that allows players to teleport their ship to a clicked location on the canvas, with range validation based on the teleport research level.

## Open Questions and Assumptions

### Open Questions
1. **Cooldown mechanism**: Should there be a cooldown period between teleports?
   - **Assumption**: No cooldown for now; can be added later if needed.

2. **Resource cost**: Should teleportation cost iron or other resources?
   - **Assumption**: No resource cost for now; teleport availability is gated by research level only.

3. **Visual feedback**: What visual effects should accompany a teleport?
   - **Assumption**: Minimum viable implementation: show range indicator and change cursor. Advanced effects (particles, animation) can be added later.

4. **Teleport mode activation**: How should users enter teleport mode?
   - **Assumption**: Add a "Teleport" button in the game controls. Clicking it toggles teleport mode on/off. When in teleport mode, the cursor changes, and clicking on the canvas attempts a teleport instead of navigation.

5. **Range calculation**: How is teleport range calculated?
   - **Assumption**: Use the teleport research effect from the tech tree. At level 0, teleport is unavailable. At level 1+, range = baseValue * scaling factor from research.

6. **Toroidal world**: Should teleportation work across world boundaries?
   - **Assumption**: Yes, teleport should work with toroidal distance calculations to allow teleporting "around" world edges.

7. **Failed teleport feedback**: What happens when a teleport is out of range?
   - **Assumption**: Show an error message/visual feedback and don't execute the teleport.

8. **Physics/collision**: What happens if a player teleports into an object?
   - **Assumption**: For MVP, allow teleporting to any location. Collision checking can be added later if needed.

### Assumptions Summary
- Teleport is gated by research level (level 0 = unavailable, level 1+ = available with calculated range)
- No cooldown or resource cost in MVP
- Button-based mode toggle with visual cursor feedback
- Range validation based on toroidal distance
- Minimal visual effects (cursor change, range indicator)
- No collision checking in MVP

## Implementation Steps

### Phase 1: Backend - API Endpoint
- [ ] Create `/api/teleport/route.ts` endpoint
  - [ ] Accept POST request with target coordinates (x, y)
  - [ ] Validate user authentication
  - [ ] Check teleport research level (must be > 0)
  - [ ] Calculate teleport range from research level
  - [ ] Validate target is within range using toroidal distance
  - [ ] Update ship position if valid
  - [ ] Return success/error response with updated ship data
- [ ] Run `npm run ci` to verify backend changes

### Phase 2: Frontend - Service Layer
- [ ] Create `src/lib/client/services/teleportService.ts`
  - [ ] Add `getTeleportStats()` function to fetch teleport level and range
  - [ ] Add `teleportShip(targetX, targetY)` function to call the API
  - [ ] Export interfaces for type safety
- [ ] Run `npm run ci` to verify service layer

### Phase 3: Frontend - Game Logic
- [ ] Update `src/lib/client/game/Game.ts`
  - [ ] Add teleport mode state variable
  - [ ] Add method to enable/disable teleport mode
  - [ ] Add getter for teleport mode state
  - [ ] Modify click handler to check teleport mode
  - [ ] Add `handleTeleport()` method to process teleport clicks
  - [ ] Add visual range indicator when in teleport mode
- [ ] Run `npm run ci` to verify game logic changes

### Phase 4: Frontend - UI Controls
- [ ] Update `src/app/game/GamePageClient.tsx`
  - [ ] Add teleport mode state
  - [ ] Add "Teleport Mode" button to game controls
  - [ ] Add teleport stats display (level, range)
  - [ ] Handle button click to toggle teleport mode
  - [ ] Apply cursor styling when in teleport mode
  - [ ] Show/hide button based on teleport research level
- [ ] Update `src/app/game/GamePage.css` (if exists) or inline styles
  - [ ] Add cursor styling for teleport mode
  - [ ] Style teleport button
  - [ ] Style teleport stats display
- [ ] Run `npm run ci` to verify UI changes

### Phase 5: Testing
- [ ] Add unit tests for teleport API endpoint
  - [ ] Test with valid teleport level and range
  - [ ] Test with teleport level 0 (should fail)
  - [ ] Test with out-of-range target
  - [ ] Test with invalid coordinates
- [ ] Add tests for teleport service
  - [ ] Test getTeleportStats()
  - [ ] Test teleportShip() success case
  - [ ] Test teleportShip() failure case
- [ ] Run `npm run ci` to verify all tests pass

### Phase 6: Manual Testing & Screenshots
- [ ] Test in development environment
  - [ ] Research teleport to level 1
  - [ ] Enable teleport mode
  - [ ] Teleport within range (should succeed)
  - [ ] Try to teleport out of range (should fail with feedback)
  - [ ] Disable teleport mode and verify normal navigation works
  - [ ] Take screenshots of UI changes
- [ ] Document any issues found

### Phase 7: Documentation & Cleanup
- [ ] Update this TODO with findings from testing
- [ ] Add comments to code where needed
- [ ] Remove any temporary/debug code
- [ ] Final `npm run ci` check

## Progress Tracking
Current Status: Planning phase complete, ready to begin implementation.

## Notes
- The teleport research is already defined in `src/lib/server/techtree.ts`:
  - Type: `ResearchType.Teleport`
  - Base cost: 10000 iron
  - Base duration: 300 seconds
  - Base value: 100 units
  - Scaling: Factor 1.3 per level
  - Unit: 'units' (range)
- Follow existing patterns from `/api/navigate` and `/api/harvest` for API implementation
- Use existing `calculateToroidalDistance` from `@shared/physics` for range validation
- Follow existing patterns from GamePageClient for UI integration
