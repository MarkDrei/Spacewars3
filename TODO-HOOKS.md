# Server-Side Routing Redesign for Hooks Architecture

## Overview

This document outlines the migration from client-side to server-side routing authentication to eliminate loading flashes, improve security, and create a seamless user experience.

## Current Problems

### 1. Loading Flashes on Every Navigation
- Every protected page shows "Checking authentication..." loading state
- Users see brief flashes of unauthorized content before redirects
- Poor user experience with multiple loading states

### 2. Redundant API Calls
- Each page component calls `/api/session` independently 
- Multiple identical session checks on navigation
- Inefficient network usage

### 3. Security Concerns
- Client-side authentication allows content to render before auth check
- Users can potentially see unauthorized content in browser dev tools
- Authentication logic exposed in client bundle

### 4. Maintenance Overhead
- Every protected page needs auth logic
- Duplicated loading and error handling
- Inconsistent auth state management

## Target Server-Side Architecture

### Key Principles
1. **Authentication First**: Server checks auth before any page content renders
2. **Seamless Redirects**: Use Next.js `redirect()` for instant navigation
3. **Zero Loading States**: Eliminate all auth-related loading indicators
4. **Single Source of Truth**: Centralized server-side auth validation

### Implementation Strategy
- Convert protected pages to server components
- Create `getServerAuth()` and `requireAuth()` utilities
- Use Next.js App Router server-side patterns
- Maintain session management with iron-session cookies

## Migration Plan

### Phase 1: Server Session Utilities ✅
Create server-side session management utilities:

- [x] Create `src/lib/server/serverSession.ts`
- [x] Implement `getServerAuth()` function for session checking
- [x] Implement `requireAuth()` function with automatic redirects
- [x] Handle Next.js `redirect()` for unauthorized users

### Phase 2: Root Layout Server Component ✅
Convert root layout to handle authentication server-side:

- [x] Convert `src/app/layout.tsx` to server component
- [x] Remove client-side auth dependencies 
- [x] Implement server-side route protection patterns

### Phase 3: Protected Pages Server Components
Convert all protected pages to server components:

- [ ] Convert `src/app/page.tsx` to server component with auth redirect
- [ ] Convert `src/app/home/page.tsx` to server component
- [ ] Convert `src/app/game/page.tsx` to server component  
- [ ] Convert `src/app/research/page.tsx` to server component
- [ ] Convert `src/app/factory/page.tsx` to server component
- [ ] Convert `src/app/profile/page.tsx` to server component
- [ ] Convert `src/app/about/page.tsx` to server component

### Phase 4: Hook Optimization
Update remaining hooks to remove auth dependencies:

- [ ] Remove auth parameters from `useIron()` hook
- [ ] Remove auth parameters from `useResearchStatus()` hook
- [ ] Remove auth parameters from other data hooks
- [ ] Update hooks to assume authentication is already validated

### Phase 5: Client Component Refactoring
Split client/server concerns properly:

- [ ] Create client components for interactive features
- [ ] Pass server-fetched data as props to client components
- [ ] Remove authentication logic from client components
- [ ] Update AuthenticatedLayout to be a client component receiving auth state

### Phase 6: Testing and Validation
Ensure migration maintains functionality:

- [ ] Update tests to work with server components
- [ ] Test authentication flows with server-side redirects
- [ ] Validate no loading flashes occur during navigation
- [ ] Performance testing for server-side auth overhead

### Phase 7: Cleanup
Remove obsolete client-side auth code:

- [ ] Review and potentially remove `useAuth()` hook
- [ ] Clean up unused authentication service calls
- [ ] Remove client-side loading states and error handling
- [ ] Update documentation to reflect new architecture

## Implementation Guidelines

### Server Component Patterns
```typescript
// Protected page pattern
export default async function HomePage() {
  const auth = await requireAuth(); // Redirects if not authenticated
  const userData = await getUserData(auth.userId);
  
  return <HomePageClient userData={userData} auth={auth} />;
}
```

### Client Component Patterns  
```typescript
// Interactive client component receiving server data
'use client';
export default function HomePageClient({ userData, auth }: Props) {
  // No auth checking needed - server guarantees auth
  // Focus on UI interactions and state management
  return <div>...</div>;
}
```

### Session Utilities
```typescript
// Server session utilities
export async function getServerAuth(): Promise<AuthState | null> {
  // Check iron-session cookie server-side
}

export async function requireAuth(): Promise<AuthState> {
  // Check auth and redirect if not authenticated
}
```

## Benefits Expected

1. **Zero Loading Flashes**: Instant page loads with no auth loading states
2. **Better Security**: Server-side validation prevents client-side bypassing  
3. **Improved Performance**: Eliminate redundant session API calls
4. **Cleaner Code**: Remove auth logic duplication across components
5. **Better UX**: Seamless navigation without loading interruptions
6. **Next.js Best Practices**: Align with App Router recommended patterns

## Rollback Plan

If issues arise during migration:
1. Revert to previous client-side patterns
2. Maintain both approaches during transition period
3. Gradual page-by-page migration to minimize risk
4. Comprehensive testing at each phase

## Success Criteria

- [ ] No visible loading states for authentication
- [ ] Seamless redirects on unauthorized access
- [ ] All existing functionality preserved
- [ ] Performance improvement in page load times
- [ ] All tests passing with new architecture
- [ ] Zero regression in user experience

---

*This migration represents a significant architectural improvement that will enhance security, performance, and user experience while following Next.js App Router best practices.*