# TODO - UI Implementation

## 🎯 Goal: Display Messages System UI

### ✅ Phase 1: Home Page with Notifications Table
- [x] Create new home page (`/home` route)
- [x] Add home icon to navbar (first item, left of Game)
- [x] Implement notifications table layout
  - [x] Header row spanning full width: "Notifications"
  - [x] Message rows: Time/Date cell + Message cell
  - [x] Table styling consistent with research page
- [x] Add dummy messages (short, medium, long)
- [x] Update navigation to include home page
- [x] Update root route to redirect to home instead of game

### ✅ Phase 2: Message Integration - COMPLETED!
- [x] **Backend**: Create notifications for object collection
  - [x] Import sendMessageToUserCached in collect API
  - [x] Generate notification messages with iron values in **bold**
  - [x] Handle both iron-rewarding and non-rewarding collections
  - [x] Async message sending (non-blocking)
- [x] **Frontend**: Connect home page to real message API endpoints
  - [x] Created messagesService for API communication
  - [x] Fetch unread messages on page load
  - [x] Mark messages as read automatically via API
  - [x] Replace dummy data with real messages
  - [x] Add loading, error, and empty states
  - [x] Format timestamps properly (HH:MM:SS and Mon DD)
- [ ] Add message actions (mark as read, delete)
- [ ] Real-time message updates

### 🔄 Phase 3: Enhanced Features (Future)
- [ ] Message pagination
- [ ] Message filtering/search
- [ ] Message categories/types
- [ ] Desktop notifications
- [ ] Message archiving

---

## ✅ Current Status: Phase 2 Complete! Cache Deadlock Fixed!

**Completed Implementation:**
1. ✅ Created home page component with notifications table
2. ✅ Added home icon (🏠) to navbar as first item (later removed per user request)
3. ✅ Implemented table layout matching research page style
4. ✅ Added three dummy messages (short, medium, long)
5. ✅ Updated navigation routing and active states
6. ✅ Root route now redirects to /home instead of /game
7. ✅ **Backend**: Collection notifications implemented
   - **Automatic notifications** when objects are collected
   - **Iron rewards displayed in bold** (e.g., "received **150** iron")
   - **Object type formatting** (underscore to space conversion)
   - **Non-blocking async** message sending
   - **Error handling** for notification failures
8. ✅ **Frontend**: Real message integration complete
   - **MessagesService** for API communication with error handling
   - **Automatic fetch** of unread messages on home page load
   - **Mark as read** functionality via existing API
   - **Real-time formatting** of timestamps (HH:MM:SS and Mon DD)
   - **Loading states** with proper UX feedback
   - **Error handling** with user-friendly messages
   - **Empty state** when no new messages exist
9. ✅ **Cache Deadlock Resolution**
   - **Identified root cause**: Nested lock acquisition in `getAndMarkUnreadMessages`
   - **Fixed deadlock**: Created `getMessagesForUserUnsafe` to avoid nested locks
   - **Optimized performance**: Messages API now responds in ~15ms instead of 10+ seconds
   - **Fully cached operations**: Both message retrieval and creation use optimized cache
   - **Background persistence**: Automatic dirty message persistence working correctly
2. ✅ Added home icon (🏠) to navbar as first item
3. ✅ Implemented table layout matching research page style
4. ✅ Added three dummy messages (short, medium, long)
5. ✅ Updated navigation routing and active states
6. ✅ Root route now redirects to /home instead of /game

**Key Features:**
- **Responsive table design** with dark theme consistency
- **Two-column layout**: Time/Date cell + Message cell  
- **Proper styling**: Hover effects, borders, spacing
- **Navigation integration**: Home icon and active state handling
- **Dummy data**: Three realistic message examples

**Next Steps for Phase 3:**
- Add message actions (manual mark as read, delete)
- Implement real-time message updates (polling or websockets)
- Add message pagination for large message lists
- Enhanced message filtering and search capabilities