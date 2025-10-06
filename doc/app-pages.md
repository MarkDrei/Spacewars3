# app Pages Package

## Overview
Contains all user-facing page components for the Spacewars application. Implements Next.js App Router pages with server-side rendering, client-side interactivity, and proper authentication checks. Each page handles a specific aspect of the game (gameplay, research, factory, profile, etc.).

## Responsibilities
- Render user-facing pages
- Handle client/server component split
- Check authentication status
- Redirect unauthorized users
- Integrate with hooks for data fetching
- Provide responsive UI layouts
- Manage page-specific state
- Coordinate with components and services

## Decomposition

```plantuml
@startuml
package "app" {
  package "Pages" {
    [login/page.tsx] as Login
    [home/page.tsx] as Home
    [game/page.tsx] as Game
    [research/page.tsx] as Research
    [factory/page.tsx] as Factory
    [profile/page.tsx] as Profile
    [about/page.tsx] as About
    [admin/page.tsx] as Admin
  }
  
  package "Client Components" {
    [home/HomePageClient.tsx] as HomeClient
    [game/GamePageClient.tsx] as GameClient
    [research/ResearchPageClient.tsx] as ResearchClient
    [factory/FactoryPageClient.tsx] as FactoryClient
    [profile/ProfilePageClient.tsx] as ProfileClient
    [about/AboutPageClient.tsx] as AboutClient
  }
  
  package "Root" {
    [page.tsx] as Root
    [layout.tsx] as Layout
    [globals.css]
  }
  
  Login --> "authService"
  Home --> HomeClient
  Game --> GameClient
  Research --> ResearchClient
  Factory --> FactoryClient
  Profile --> ProfileClient
  About --> AboutClient
  
  Layout --> "Navigation"
  Layout --> "sessionCheck"
}

note right of Root
  Root redirects to
  /home or /login
  based on auth
end note

note right of "Client Components"
  Client-side logic
  with hooks and state
end note
@enduml
```

### Page Structure
Each authenticated page follows this pattern:
- **page.tsx** - Server component (auth check, redirect)
- **PageClient.tsx** - Client component (UI, state, hooks)
- **Page.css** - Page-specific styles

### Source Files

**Root Level:**
- [page.tsx](../src/app/page.tsx) - Root page (redirects to home or login)
- [layout.tsx](../src/app/layout.tsx) - Root layout with navigation
- [globals.css](../src/app/globals.css) - Global styles

**Pages:**
- [login/page.tsx](../src/app/login/page.tsx) - Login/register page
- [home/page.tsx](../src/app/home/page.tsx) - Home/dashboard page
- [game/page.tsx](../src/app/game/page.tsx) - Game canvas page
- [research/page.tsx](../src/app/research/page.tsx) - Research page
- [factory/page.tsx](../src/app/factory/page.tsx) - Factory/build page
- [profile/page.tsx](../src/app/profile/page.tsx) - User profile page
- [about/page.tsx](../src/app/about/page.tsx) - About page
- [admin/page.tsx](../src/app/admin/page.tsx) - Admin page

**Client Components:**
- [home/HomePageClient.tsx](../src/app/home/HomePageClient.tsx)
- [game/GamePageClient.tsx](../src/app/game/GamePageClient.tsx)
- [research/ResearchPageClient.tsx](../src/app/research/ResearchPageClient.tsx)
- [factory/FactoryPageClient.tsx](../src/app/factory/FactoryPageClient.tsx)
- [profile/ProfilePageClient.tsx](../src/app/profile/ProfilePageClient.tsx)
- [about/AboutPageClient.tsx](../src/app/about/AboutPageClient.tsx)

**Styles:**
- home/HomePage.css, game/GamePage.css, research/ResearchPage.css, etc.

## Rationale

**Next.js App Router Benefits:**
- Server-side rendering for better SEO
- Automatic code splitting
- File-based routing
- Server/client component separation
- Streaming and suspense support

**Server/Client Split Pattern:**
- Server components check auth
- Server components redirect if needed
- Client components handle interactivity
- Reduced client-side bundle size

## Constraints, Assumptions, Consequences, Known Issues

**Assumptions:**
- Next.js App Router conventions
- Session cookies persist across requests
- Client-side JavaScript enabled
- Modern browser support

**Consequences:**
- Server components cannot use hooks or browser APIs
- Client components marked with 'use client' directive
- Authentication checked on each page load
- Redirects happen server-side

**Constraints:**
- Must split server/client components appropriately
- Cannot use hooks in server components
- Must handle loading states during redirects

**Known Issues:**
- Some legacy files (page_new.tsx) may exist but are unused

## Details

### Root Level

**page.tsx (Root)**
- **Type:** Server component
- **Role:** Root redirect based on authentication
- **Logic:** 
  - Check authentication via getServerAuthState
  - Redirect to /home if authenticated
  - Redirect to /login if not authenticated
- **Top collaborations:** serverSession, Next.js redirect

**layout.tsx**
- **Type:** Root layout component
- **Role:** Provides consistent layout structure across all pages
- **Features:**
  - HTML document structure
  - Metadata (title, description)
  - Navigation component
  - Session management
- **Top collaborations:** Navigation, metadata API, session management

**globals.css**
- **Type:** Global stylesheet
- **Role:** Application-wide styles
- **Contents:** CSS variables, resets, common classes

---

### Authentication Pages

**login/page.tsx**
- **Type:** Client component
- **Route:** /login
- **Features:**
  - Login form
  - Register form
  - Toggle between modes
  - Error handling
  - Redirect to /home after login
- **Top collaborations:** LoginPageComponent, useAuth hook, authService

---

### Game Pages

**home/page.tsx → HomePageClient.tsx**
- **Route:** /home (also root /)
- **Features:**
  - Dashboard/overview
  - Display iron amount with real-time updates
  - Display defense values (hull, armor, shields)
  - Links to other sections
  - User stats summary
- **Top collaborations:** useIron, useDefenseValues, AuthenticatedLayout, StatusHeader

**game/page.tsx → GamePageClient.tsx**
- **Route:** /game
- **Features:**
  - HTML5 Canvas game view
  - Game engine initialization
  - World rendering
  - Click handling for navigation
  - Collection mechanics
  - Real-time world updates
- **Top collaborations:** Game class, World class, useWorldData, GameRenderer

**Canvas Management:**
- Canvas ref for direct DOM access
- Game instance lifecycle management
- Cleanup on unmount
- Resize handling

---

### Research System Page

**research/page.tsx → ResearchPageClient.tsx**
- **Route:** /research
- **Features:**
  - Display tech tree
  - Show available research
  - Display research progress
  - Trigger new research
  - Show iron cost
  - Real-time progress updates
- **Top collaborations:** useResearchStatus, useIron, researchService, AuthenticatedLayout

**UI Elements:**
- Research cards with name, description, cost
- Progress bar for active research
- Estimated time remaining
- Completed research indicators

---

### Factory System Page

**factory/page.tsx → FactoryPageClient.tsx**
- **Route:** /factory
- **Features:**
  - Display tech catalog (weapons, defenses)
  - Show tech counts
  - Display build queue
  - Build new items
  - Show iron costs
  - Real-time queue updates
- **Top collaborations:** useTechCounts, useBuildQueue, useIron, factoryService, AuthenticatedLayout

**UI Elements:**
- Tech catalog grid
- Build queue list
- Tech inventory display
- Build buttons with costs

---

### Profile Page

**profile/page.tsx → ProfilePageClient.tsx**
- **Route:** /profile
- **Features:**
  - Display username
  - Show user stats
  - Display tech inventory
  - Show research history
  - Display achievements (if implemented)
- **Top collaborations:** useAuth, useIron, useTechCounts, AuthenticatedLayout

---

### Information Pages

**about/page.tsx → AboutPageClient.tsx**
- **Route:** /about
- **Features:**
  - Game overview
  - Feature descriptions
  - How to play
  - Technology stack info
  - Credits
- **Top collaborations:** AuthenticatedLayout

**Content:**
- Toroidal world explanation
- Interception mechanics
- Collectibles description
- Radar system
- Technology stack list

---

### Admin Page

**admin/page.tsx**
- **Route:** /admin
- **Auth:** Admin only (users 'a' and 'q')
- **Features:**
  - Database statistics
  - System information
  - Admin operations
  - Debug controls
- **Top collaborations:** admin API routes, useAuth

**Security:**
- Username check for admin access
- Redirect non-admin users

---

## Common Patterns

### Server Component Auth Check
```typescript
// page.tsx
export default async function Page() {
  const auth = await getServerAuthState();
  
  if (!auth.isLoggedIn) {
    redirect('/login');
  }
  
  return <PageClient auth={auth} />;
}
```

### Client Component with Hooks
```typescript
// PageClient.tsx
'use client';

export default function PageClient({ auth }: Props) {
  const { ironAmount } = useIron();
  const { data } = useCustomHook();
  
  return (
    <AuthenticatedLayout>
      {/* Page content */}
    </AuthenticatedLayout>
  );
}
```

### Canvas Lifecycle
```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);
const gameRef = useRef<Game | null>(null);

useEffect(() => {
  if (canvasRef.current) {
    gameRef.current = new Game(canvasRef.current);
    gameRef.current.start();
  }
  
  return () => {
    gameRef.current?.stop();
  };
}, []);
```

## Page Hierarchy

1. **Root (/)** → Redirects to home or login
2. **Public Pages:**
   - /login - Authentication
3. **Authenticated Pages:**
   - /home - Dashboard
   - /game - Game canvas
   - /research - Research system
   - /factory - Build system
   - /profile - User profile
   - /about - Information
   - /admin - Admin only

## Integration with Components

All authenticated pages use:
- **AuthenticatedLayout** - Consistent layout with navigation and status
- **StatusHeader** - Iron and status display
- **Navigation** - Menu and navigation links

## Styling Approach

- Global styles in globals.css
- Page-specific styles in Page.css files
- Component styles in component .css files
- CSS variables for theming
- Responsive design with media queries

## Routing

Next.js App Router handles routing automatically:
- File: `app/game/page.tsx` → Route: `/game`
- File: `app/api/world/route.ts` → API: `/api/world`
- Nested folders create nested routes
- layout.tsx applies to all child routes
