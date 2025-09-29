# Hook Architecture Migration Strategy

## Current Problems

### Authentication Issues
- ❌ **Loading flash on every page** - "Checking authentication..." appears on navigation
- ❌ **Redundant API calls** - `/api/session` called on every page mount
- ❌ **Client-side auth validation** - Users see UI before auth check completes
- ❌ **Unnecessary auth UI states** - "Not authenticated" messages on protected pages

### Iron/Data Issues  
- ❌ **Iron resets to 0** on page navigation
- ❌ **Multiple polling instances** - Each page creates new useIron hook
- ❌ **Lost optimistic updates** - Real-time iron calculations reset on navigation
- ❌ **Redundant data fetching** - Same user stats fetched on every page

## Migration Strategy

### Phase 1: Server-Side Authentication Hydration

**Goal**: Eliminate client-side auth loading states entirely

#### Implementation Steps:
1. **Create server session utility**
   - `src/lib/server/serverSession.ts`
   - Function to read and validate session cookies server-side
   - Return auth state or null for unauthenticated users

2. **Update root layout to server component**
   - `src/app/layout.tsx` → Server Component
   - Check authentication server-side before rendering
   - Redirect unauthenticated users to `/login` server-side
   - Pass auth data to client via props or data attributes

3. **Remove client-side auth loading states**
   - Remove `authLoading` checks from all components
   - Remove "Checking authentication..." UI elements
   - Remove "Not authenticated" UI elements  
   - Remove conditional rendering based on `isLoggedIn`

4. **Update useAuth hook**
   - Remove initial loading state (always starts as authenticated)
   - Remove session check on mount (server already validated)
   - Keep login/logout/register functions for client actions
   - Add session invalidation handling

#### Files to Modify:
- `src/app/layout.tsx` - Convert to server component with auth check
- `src/lib/server/serverSession.ts` - New file for server auth utils
- `src/lib/client/hooks/useAuth.ts` - Simplify, remove loading states
- `src/app/home/page.tsx` - Remove auth loading UI
- `src/app/factory/page.tsx` - Remove auth loading UI  
- `src/app/research/page.tsx` - Remove auth loading UI
- `src/app/profile/page.tsx` - Remove auth loading UI
- `src/app/admin/page.tsx` - Remove auth loading UI
- `src/app/game/page.tsx` - Remove auth loading UI

#### Code to Remove:
```typescript
// Remove these patterns from ALL pages:
{authLoading ? (
  <div>Checking authentication...</div>
) : !isLoggedIn ? (
  <div>Not authenticated</div>
) : (
  // actual content
)}

// Simplify to just:
// actual content (user is guaranteed to be authenticated)
```

#### Tests to Remove:
- Tests for "unauthenticated user sees X message"
- Tests for auth loading states in components
- Tests for conditional rendering based on auth state

### Phase 2: Global Iron Context

**Goal**: Persistent, real-time iron state across all pages

#### Implementation Steps:
1. **Create IronProvider context**
   - `src/lib/client/context/IronContext.tsx`
   - Global state with real-time updates (100ms intervals)
   - Server sync every 5 seconds
   - SessionStorage persistence for navigation
   - Automatic drift correction

2. **Wrap app with IronProvider**
   - Add to `src/app/layout.tsx` (client-side wrapper)
   - Initialize with server-hydrated data if possible
   - Handle mount/unmount cleanup

3. **Replace useIron hook**
   - `src/lib/client/hooks/useIron.ts` → Simple context consumer
   - Remove polling logic (handled by context)
   - Remove state management (handled by context)
   - Keep refetch functionality for manual updates

4. **Update all iron consumers**
   - `src/components/StatusHeader/StatusHeader.tsx`
   - `src/components/Layout/AuthenticatedLayout.tsx`
   - Any other components using iron data

#### Files to Modify:
- `src/lib/client/context/IronContext.tsx` - New context provider
- `src/app/layout.tsx` - Wrap with IronProvider
- `src/lib/client/hooks/useIron.ts` - Simplify to context consumer
- `src/components/StatusHeader/StatusHeader.tsx` - Use new hook
- All pages using iron data

#### Benefits:
- ✅ No more iron resets on navigation
- ✅ Continuous real-time updates across pages
- ✅ Single polling instance for entire app
- ✅ Persistent state during navigation
- ✅ Automatic server synchronization

### Phase 3: Cleanup and Optimization

#### Code Removal:
1. **Remove redundant auth checks**
   - All `{isLoggedIn && ...}` conditional rendering
   - All `{authLoading ? ... : ...}` loading states
   - All "Not authenticated" UI components

2. **Remove individual polling hooks**
   - Consolidate data fetching into global contexts
   - Remove duplicate API calls
   - Clean up component lifecycle management

3. **Remove auth-related tests**
   - Tests for unauthenticated states in protected components
   - Tests for auth loading states
   - Tests for conditional auth rendering

#### File Structure After Migration:
```
src/
├── lib/
│   ├── client/
│   │   ├── context/
│   │   │   ├── IronContext.tsx     ← New global iron state
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts          ← Simplified (no loading states)
│   │   │   ├── useIron.ts          ← Simplified (context consumer)
│   │   │   └── ...
│   │   └── services/
│   ├── server/
│   │   ├── serverSession.ts        ← New server auth utilities
│   │   └── ...
│   └── ...
├── app/
│   ├── layout.tsx                  ← Server component with auth
│   ├── login/                      ← Only non-authenticated page
│   └── [all other pages]           ← Guaranteed authenticated users
└── ...
```

## Implementation Order

1. **Phase 1 First** - Server auth eliminates most loading flashes
2. **Phase 2 Second** - Global iron state for seamless navigation  
3. **Phase 3 Last** - Cleanup and optimization

## Testing Strategy

### New Tests Needed:
- Server-side session validation tests
- Iron context persistence tests  
- Real-time update accuracy tests

### Tests to Remove:
- Client-side auth loading tests
- Unauthenticated user UI tests
- Individual hook polling tests

## Migration Benefits

### Performance:
- 🚀 **Faster initial page loads** - No client-side auth delay
- 🚀 **Fewer API calls** - Eliminated redundant session checks
- 🚀 **Smoother navigation** - No data resets between pages

### User Experience:  
- ✨ **No loading flashes** - Immediate page renders
- ✨ **Continuous data updates** - Real-time iron across navigation
- ✨ **Better security** - Server-side auth validation

### Developer Experience:
- 🛠️ **Simpler components** - No auth loading states to handle
- 🛠️ **Less boilerplate** - No conditional auth rendering
- 🛠️ **Easier testing** - No auth edge cases in protected components

## Risk Mitigation

### Fallback Handling:
- Server session validation errors → Redirect to login
- Iron context failures → Graceful degradation to loading state
- Real-time update failures → Fall back to periodic polling
