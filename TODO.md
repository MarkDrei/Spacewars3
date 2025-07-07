# Frontend Restructuring Plan
Goal: There will be a login page, where the user can login or create an account. Only if he has successfully logged in, he will come to the main game, which will feature the current page with the game canvas. Over time we will add more pages to the game, so we need a navigation. All those new pages and navigation will only be available to the logged in user.
Please first propose a plan how we can get there.

## 1. Setup Authentication Infrastructure
- [ ] Create auth-related shared types in packages/shared
  - User interface
  - Auth response types
  - API endpoints types
- [ ] Set up client-side auth state management
  - Auth context
  - useAuth hook
  - Token storage utilities
- [ ] Create protected route components
- [ ] Add auth utilities
  - Token management
  - Auth headers for API calls

## 2. Create New Directory Structure
```
packages/client/
├── src/
│   ├── components/          # Shared UI components
│   │   ├── Navigation/     # Nav bar and menu
│   │   ├── Layout/         # Page layouts
│   │   └── Auth/          # Login/register forms
│   ├── pages/             # Page components
│   │   ├── Login/         # Login page
│   │   ├── Game/          # Game canvas
│   │   └── Profile/       # User profile
│   ├── hooks/             # Custom hooks
│   │   └── useAuth.ts    
│   ├── services/          # API services
│   │   └── authService.ts
│   ├── utils/             # Utilities
│   │   └── auth.ts       
│   ├── routes/            # Routes
│   │   └── index.ts      
│   ├── types/             # Frontend types
│   └── game/              # Game logic
```

## 3. Implementation Steps

### Phase 1: Basic Setup
- [ ] Install dependencies
  - react-router-dom
  - required UI libraries
- [ ] Set up new directory structure
- [ ] Configure build tools for SPA

### Phase 2: Authentication
- [ ] Create auth components
  - Login form
  - Registration form
  - Auth context provider
- [ ] Implement auth API services
- [ ] Add protected route wrapper
- [ ] Set up auth state management

### Phase 3: Game Integration
- [ ] Move current game canvas to Game page
- [ ] Update game initialization for React
- [ ] Handle game cleanup on unmount
- [ ] Add loading states

### Phase 4: Navigation & Layout
- [ ] Create navigation component
- [ ] Implement basic layout
- [ ] Add error boundaries
- [ ] Style with consistent theme

### Phase 5: Testing
- [ ] Update test configuration
- [ ] Add tests for
  - Auth flows
  - Protected routes
  - Component rendering
  - Game canvas integration

## Order of Implementation

1. Basic routing setup
2. Authentication system
3. Move game to its own component
4. Add navigation
5. Polish and testing

## Notes
- Keep existing game logic unchanged
- Use React.StrictMode for better development
- Consider code splitting for game logic
- Add proper error handling
- Include loading states for better UX
