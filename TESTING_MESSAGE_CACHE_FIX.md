# Testing the Message Cache Persistence Fix

## Issue Description
Previously, messages that were summarized and marked as read would reappear as unread after restarting the application, often showing "invalid date".

## Root Causes Fixed

### 1. Read Status Not Persisted
**Problem**: Messages were removed from cache before their read status was persisted to the database.

**Fix**: Modified `MessageCache.summarizeMessages()` to persist read status to database BEFORE removing messages from cache (lines 568-589 in `MessageCache.ts`).

### 2. Timestamps Not Preserved
**Problem**: When unknown messages were recreated with original timestamps during summarization, the database persistence layer would use `Date.now()` instead of the preserved timestamp.

**Fix**: Updated `messagesRepo.createMessage()` to accept optional timestamp parameter, and `MessageCache.persistMessageAsync()` to pass the message's cached timestamp.

## Manual Testing Steps

### Prerequisites
1. Start the PostgreSQL database:
   ```bash
   docker-compose up db -d
   ```

2. Start the application:
   ```bash
   npm run dev
   ```

### Test Scenario 1: Message Summarization Persistence

1. **Login** to the application as user "a" (password "a")

2. **Generate some messages** by playing the game:
   - Navigate your ship around
   - Collect some asteroids or shipwrecks
   - Engage in a battle if possible
   - You should see several messages appear in the home page

3. **Summarize the messages**:
   - On the home page, click the "📊 Summarize" button
   - Verify that messages are collapsed into a summary

4. **Restart the application**:
   ```bash
   # Stop the dev server (Ctrl+C)
   # Start it again
   npm run dev
   ```

5. **Verify the fix**:
   - Login again
   - Go to the home page
   - **Expected**: Only the summary message should appear (unread)
   - **Bug behavior (fixed)**: Old messages would reappear as unread with "invalid date"

### Test Scenario 2: Mark All as Read Persistence

1. **Login** and ensure you have some unread messages

2. **Mark all as read**:
   - Click the "Mark All as Read" button
   - Verify messages disappear

3. **Restart the application** and login again

4. **Verify the fix**:
   - **Expected**: No messages appear (all stayed read)
   - **Bug behavior (fixed)**: Messages would reappear as unread

### Test Scenario 3: Timestamp Preservation

1. **Login** and generate messages with different activities at different times

2. **Note the timestamps** of the messages before summarizing

3. **Summarize** and then **refresh** the page

4. **Verify**:
   - Unknown messages (that couldn't be summarized) should preserve their original timestamps
   - They should not all show the same recent timestamp

## Automated Test Suite

Run the full test suite (requires PostgreSQL database):

```bash
# Ensure database is running
docker-compose up db -d

# Run all tests
npm test

# Run only the new persistence tests
npm test -- MessageCache-persistence-after-summarization
```

## Expected Test Results

The following new tests should pass:
1. `messageSummarization_afterRestart_summarizedMessagesStayRead`
2. `messageSummarization_withUnknownMessages_persistsReadStatusCorrectly`
3. `markAllAsRead_afterRestart_messagesStayRead`
4. `messageSummarization_preservesOriginalTimestamps`

## Files Changed

1. **src/lib/server/messages/MessageCache.ts**
   - Added immediate DB persistence before cache removal (lines 568-589)
   - Updated `createMessageInDb()` to accept timestamp parameter
   - Updated `persistMessageAsync()` to use message's timestamp

2. **src/lib/server/messages/messagesRepo.ts**
   - Updated `createMessage()` to accept optional `createdAt` parameter

3. **src/__tests__/lib/MessageCache-persistence-after-summarization.test.ts**
   - New comprehensive test suite for persistence behavior

## Code Review Checklist

- ✅ Read status is persisted BEFORE messages are removed from cache
- ✅ Timestamps are preserved when messages are recreated
- ✅ All database operations use proper locking
- ✅ Tests cover restart scenarios
- ✅ TypeScript compilation passes
- ✅ ESLint passes with no new warnings
- ✅ Backward compatible (optional timestamp parameter)
