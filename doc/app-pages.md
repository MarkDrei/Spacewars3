# app Pages Package

## Overview
Next.js App Router pages with server-side rendering and client-side interactivity. Each page has server component for auth checks and client component for UI.

## Structure
Pages follow pattern: **page.tsx** (server auth check) → **PageClient.tsx** (UI + state)

## Pages

**Root:**
- **page.tsx** - Redirects to /home or /login based on auth
- **layout.tsx** - Root layout with navigation

**Pages:**
- **login/** - Authentication page
- **home/** - Dashboard with iron and defense stats
- **game/** - Canvas game view with world rendering
- **research/** - Tech tree and research UI
- **factory/** - Build queue and tech catalog
- **profile/** - User stats and inventory
- **about/** - Game information
- **admin/** - Admin tools (restricted)

## Authentication Pattern
```typescript
// page.tsx (server component)
const auth = await getServerAuthState();
if (!auth.isLoggedIn) redirect('/login');
return <PageClient auth={auth} />;
```

## Integration
- Uses **AuthenticatedLayout** for consistent navigation/status
- Hooks: useAuth, useIron, useResearchStatus, useBuildQueue, useTechCounts
- Services: authService, worldDataService, researchService, factoryService
