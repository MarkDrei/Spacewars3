# Frontend Restructuring Plan - COMPLETED ✅

# Server-Authoritative Architecture Migration Plan 🚀

## Current State Analysis

### 🎯 **What We Have:**
- **Client-Heavy Architecture**: Game state, inventory, score, world data all in client
- **Backend**: Authentication, user stats (iron, tech tree), sessions, research system
- **Frontend**: React UI + HTML5 Canvas game with local state management
- **Existing Backend Features**: Iron management, tech tree, research triggering (not used in UI)

### 🎯 **Target Architecture:**
- **Server-Authoritative**: Backend owns game state, world data, player progress
- **Optimistic UI**: Client shows immediate feedback, syncs periodically
- **Unified Status System**: Global status display across all pages

---

## 📋 Migration Plan

### **Phase 1: Frontend Integration of Existing Backend Features** 
*Priority: HIGH | Complexity: LOW-MEDIUM*

#### 1.1 Global Status Header
- [x] **Create StatusHeader Component** (`src/components/StatusHeader/`)
  - [x] Display current iron amount (placeholder: 0)
  - [x] Status indicator (grey bubble/light by default)
  - [x] Responsive design for all pages
  - [ ] Auto-refresh iron values

- [x] **Status Indicator System**:
  - 🔘 **Grey**: Default state (nothing to report)
  - 🟡 **Yellow**: No research in progress
  - 🟢 **Green**: New neutral messages
  - 🔴 **Red**: Error/conflict states or related messages

- [x] **Add StatusHeader to All Pages**:
  - [x] NOT to Login page
  - [x] Game page
  - [x] Profile page  
  - [x] About page
  - [x] New Research page

**NEXT: Connect to Backend API**
- [x] **Backend Integration for StatusHeader**:
  - [x] Create iron fetching service (`userStatsService.ts`)
  - [x] Update StatusHeader to use real iron amounts  
  - [x] Add polling for auto-refresh (5 second intervals)
  - [x] Handle loading and error states (red indicator on error)
  - [x] Add retry logic for server startup timing
  - [x] Only fetch iron data when user is logged in

#### 1.2 Research Management Page
- [x] **Create Research Page** (`src/pages/Research/`)
  - Display tech tree status (table format)
  - Show current research progress with countdown
  - Allow triggering new research (one at a time)
  - Show research costs and durations
  - Display iron income rate and current levels
  - Handle loading states and error feedback

- [x] **Research Service** (`src/services/researchService.ts`):
  - Get tech tree state (`GET /api/techtree`)
  - Trigger research (`POST /api/trigger-research`)
  - Check research progress
  - Handle research completion events
  - Integrate with iron amount updates

- [x] **Add Research Route & Navigation**:
  - Protected route `/research`
  - Add to navigation menu (between Game and About)
  - Integrate with existing API endpoints

#### 1.3 Enhanced StatusHeader Integration
- [x] **StatusHeader Enhancement**:
  - Yellow indicator when no research is in progress
  - Hover tooltip: "No research in progress - click to start research"
  - Click handler: Navigate to research page
  - Real-time iron updates after research triggers
  - Status changes based on research state

- [x] **Status Indicator Logic**:
  - 🔘 **Grey**: Default state (loading or no data)
  - 🟡 **Yellow**: No research in progress (clickable → research page)
  - 🟢 **Green**: Research completion notification (auto-dismiss after 5s)
  - 🔴 **Red**: Error states or API failures

- [x] **Iron Amount Synchronization**:
  - Refresh iron after research triggers
  - Update StatusHeader iron display
  - Handle research cost deduction
  - Real-time countdown integration

### **Phase 2: Enhanced Status System** 
*Priority: MEDIUM | Complexity: LOW*

#### 2.1 Real-time Status Updates
- [ ] **Status Context** (`src/contexts/StatusContext.tsx`):
  - Global status state management
  - Iron amount tracking
  - Research progress tracking
  - Status indicator state

- [ ] **Status Hooks** (`src/hooks/useStatus.ts`):
  - `useIronAmount()` - Current iron with auto-refresh
  - `useResearchStatus()` - Research completion status
  - `useStatusIndicator()` - Status light management

#### 2.2 Notification System
- [ ] **Status Notifications**:
  - Research completion alerts
  - Iron milestone notifications
  - Status indicator animations
  - Dismissible notification queue

### **Phase 3: Game State Integration (Future)**
*Priority: LOW | Complexity: TBD*

#### 3.1 Database Schema (When Needed)
- [ ] **Game state tables** - Details TBD based on requirements
- [ ] **World persistence** - Approach TBD
- [ ] **Player progress** - Schema TBD

#### 3.2 Game State API (When Needed)  
- [ ] **Game session endpoints** - Functionality TBD
- [ ] **World state management** - Implementation TBD
- [ ] **Progress synchronization** - Strategy TBD

---

## 🔄 **Implementation Priorities**

### **Immediate (Phase 1):**
1. ✅ **StatusHeader component** with iron display and status indicator
2. ✅ **Research page** with full tech tree management  
3. ✅ **Navigation integration** for research page
4. ✅ **API integration** with existing backend endpoints

### **Next (Phase 2):**
1. ✅ **Real-time status updates** with polling
2. ✅ **Enhanced status indicators** with color coding
3. ✅ **Notification system** for events

### **Future (Phase 3):**
1. 🔄 **Game state migration** - specific approach TBD
2. 🔄 **World persistence** - requirements TBD  
3. 🔄 **Advanced synchronization** - implementation TBD

---

## 🚧 **Technical Requirements**

### **StatusHeader Specification:**
```typescript
interface StatusHeaderProps {
  ironAmount: number;
  statusIndicator: 'grey' | 'yellow' | 'green' | 'red';
  isLoading?: boolean;
  onStatusClick?: () => void;
  statusTooltip?: string;
}
```

### **Status Indicator Behavior:**
- **Default**: Grey (loading or no data)
- **No Research**: Yellow (pulsing, clickable → research page, hover: "No research in progress - click to start research")
- **Research Active**: Grey (no click action, countdown visible in research page)
- **Research Complete**: Green (solid, auto-dismiss after 5s, click → research page)
- **Errors**: Red (persistent until dismissed, click shows error details)

### **Research Page Features:**
- Tech tree table visualization (matching backend data structure)
- Current research progress with real-time countdown
- Available research options with costs and descriptions
- Iron production rate display in StatusHeader
- Research history/completed items (current levels)
- One active research at a time constraint
- Upgrade cost validation against current iron
- Navigation integration between Game → Research → About

### **Existing Backend Endpoints to Use:**
- `GET /api/user-stats` - Iron amount and production rate
- `GET /api/techtree` - Tech tree status and research options  
- `POST /api/trigger-research` - Start new research

### **New Frontend Services Needed:**
- `researchService.ts` - Dedicated research API integration
- Enhanced `useIron` hook integration for research cost updates
- Navigation service for status indicator click routing

---

## 📈 **Benefits of This Approach:**

1. **Immediate Value**: Users can access existing backend features
2. **Incremental**: Build on what's already working
3. **Low Risk**: No changes to game logic or database initially  
4. **Foundation**: Status system prepares for future game state integration
5. **User Experience**: Unified interface for all game features

**Next Steps:** Start with StatusHeader component and Research page integration. Game state migration details will be defined later based on actual requirements.

Ready to begin with Phase 1.1 (StatusHeader component)?