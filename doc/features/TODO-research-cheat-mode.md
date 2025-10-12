# Research Cheat Mode Implementation Plan

## Feature Overview
Add a cheat mode for research completion similar to the existing factory build cheat mode. The cheat mode allows users with usernames 'a' or 'q' to instantly complete their ongoing research.

## Reference Implementation
The implementation should follow the pattern established in `/src/app/api/complete-build/route.ts` and `/src/app/factory/FactoryPageClient.tsx`.

## Implementation Steps

### 1. Backend - Create API Endpoint
- [ ] Create new API route: `/src/app/api/complete-research/route.ts`
  - Only allow POST method
  - Verify authentication via session
  - Check if username is 'a' or 'q' (cheat mode users)
  - Check if there's an active research in progress
  - Set the active research's `remainingDuration` to 0 or negative value
  - Call the existing `updateTechTree` function or similar logic to complete the research
  - Return success response with completed research info

### 2. Backend - Add Server Logic
- [ ] Review `/src/lib/server/techtree.ts` for research completion logic
  - The `updateTechTree` function already handles research completion when `remainingDuration <= 0`
  - May need to add a helper function to instantly complete research similar to how build queue works
  - Ensure proper integration with cache manager (similar to trigger-research route)

### 3. Frontend - Service Layer
- [ ] Add `completeResearch` method to `/src/lib/client/services/researchService.ts`
  - Add new interface `CompleteResearchResponse` for type safety
  - Implement async method that POSTs to `/api/complete-research`
  - Handle success/error responses
  - Follow pattern from factory service's complete build functionality

### 4. Frontend - UI Integration
- [ ] Update `/src/app/research/ResearchPageClient.tsx`
  - Add state for `isCompletingResearch` loading indicator
  - Add handler function `handleCompleteResearch`
  - Add cheat button in the UI when research is active
  - Position button similar to factory page cheat section
  - Show loading state while completing
  - Refresh data after successful completion
  - Emit event to update iron in StatusHeader if needed

### 5. Frontend - Styling
- [ ] Update `/src/app/research/ResearchPage.css`
  - Add `.cheat-section` styling (can reuse from factory page)
  - Add `.cheat-button` styling (can reuse from factory page)
  - Ensure consistent look with factory page

### 6. Testing - API Tests
- [ ] Create `/src/__tests__/api/complete-research-api.test.ts`
  - Test: Not authenticated returns 401
  - Test: Invalid session returns 401
  - Test: Non-cheat user (not 'a' or 'q') returns 403
  - Test: No active research returns appropriate message
  - Test: Valid cheat user with active research completes successfully
  - Test: Research level increments correctly
  - Test: Active research is cleared after completion

### 7. Testing - Integration Tests
- [ ] Add integration tests for end-to-end flow
  - Test: Trigger research, then complete it via cheat
  - Test: Verify research level increases
  - Test: Verify iron is correctly managed
  - Test: Verify countdown updates properly

### 8. Documentation
- [ ] Update this document with any findings or changes during implementation

## Open Questions and Assumptions

### Questions:
1. **Q:** Should the cheat button be visible to all users or only to 'a' and 'q'?
   - **Assumption:** Show button to all users (like factory page), but the API will return 403 for non-cheat users. This makes the cheat feature discoverable but secure.

2. **Q:** Should completing research cost iron or should it be free (true cheat)?
   - **Assumption:** The research was already paid for when triggered, so no additional cost. The cheat just fast-forwards the time.

3. **Q:** Should we handle the case where multiple researches are queued?
   - **Assumption:** Based on the code review, only one research can be active at a time (activeResearch is a single object, not an array). No queue system exists for research like it does for builds.

4. **Q:** Should the cheat emit any notifications or events?
   - **Assumption:** Yes, should emit research completion events similar to normal research completion. May need to check if research completion events exist.

5. **Q:** How should the UI handle the cheat button placement?
   - **Assumption:** Place it prominently near the active research display, similar to how the factory page displays it above the build queue table.

6. **Q:** Should we log cheat mode usage for monitoring?
   - **Assumption:** Yes, add console.log statements similar to complete-build route for debugging and monitoring.

### Technical Decisions:
- Use the typed cache manager pattern from trigger-research route for consistency
- Follow the same error handling pattern as other API routes
- Reuse CSS classes from factory page for consistent styling
- Follow existing test patterns from complete-build-api tests

## Dependencies
- No new external dependencies required
- Relies on existing session management
- Uses existing techtree update logic

## Risk Assessment
- **Low Risk:** Following established patterns from factory cheat mode
- **Potential Issue:** Cache synchronization - ensure proper use of cache manager
- **Potential Issue:** Race conditions - ensure proper locking if needed

## Success Criteria
- [ ] Cheat button appears on research page when research is active
- [ ] Button works only for users 'a' and 'q'
- [ ] Research completes instantly when button is clicked
- [ ] Research level increases correctly
- [ ] UI updates properly after completion
- [ ] All tests pass
- [ ] No linting errors
- [ ] Code follows existing patterns and conventions
