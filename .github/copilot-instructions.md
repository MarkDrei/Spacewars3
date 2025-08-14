# Spacewars Ironcore

- This project is a 2D space exploration game built with Next.js 15, TypeScript, and React.
- The game uses HTML5 Canvas for rendering within a React application.
- The project follows Next.js App Router architecture with clear separation between client, server, and shared code.
- All new code should be written in TypeScript with proper type definitions.
- The project is a Next.js fullstack application with integrated API routes.

## Module System

- This project uses [ES Modules](https://nodejs.org/api/esm.html) exclusively (`"type": "module"` in package.json).
- Use `import`/`export` syntax only. Do not use CommonJS (`require`, `module.exports`).

## Project Structure
- `src/app/`: Next.js App Router pages and API routes
  - `src/app/api/`: API routes for authentication and game logic
  - `src/app/game/`: Game page component
  - `src/app/login/`: Login page component
  - `src/app/layout.tsx`: Root layout with navigation and session management
  - `src/app/page.tsx`: Home page
- `src/components/`: Reusable React components
  - `src/components/Navigation/`: Navigation component with responsive design
  - `src/components/StatusHeader.tsx`: Iron amount and status display
- `src/lib/`: Core application logic
  - `src/lib/client/`: Client-side code (hooks, services, game engine)
    - `src/lib/client/hooks/`: React hooks for authentication, data fetching
    - `src/lib/client/services/`: API service functions
    - `src/lib/client/game/`: Game engine classes (Game, World, Ship, etc.)
    - `src/lib/client/renderers/`: Canvas rendering classes
  - `src/lib/server/`: Server-side code (database, business logic)
    - `src/lib/server/database.ts`: Database schema and operations
    - `src/lib/server/auth.ts`: Authentication utilities
    - `src/lib/server/techtree.ts`: Research system logic
- `src/shared/`: Shared types and utilities used by both client and server
- `src/__tests__/`: Test files for all components and logic
- `database/`: SQLite database files

## Development Guidelines
- Do not delete the DB unless asked to.
- The dev environment with Next.js is usually up and running. Don't start a new one unless necessary.
- Use TypeScript features like interfaces and type definitions to ensure type safety.
- Maintain the separation between client-side game logic, server-side business logic, and React UI.
- All canvas rendering logic should go in the appropriate renderer class in `src/lib/client/renderers/`.
- All UI components should be implemented as React components in `src/components/`.
- Use React Hooks for state management and component lifecycle.
- API routes should be placed in `src/app/api/` following Next.js App Router conventions.
- Shared types and utilities should be placed in `src/shared/`.
- Server-side logic (database operations, authentication) should be in `src/lib/server/`.

## Authentication & Session Management
- Uses iron-session for secure session management with HTTP-only cookies
- Authentication state managed via `useAuth` hook and session middleware
- Protected routes automatically redirect to login page if not authenticated
- Session data includes userId and username for authenticated users

## Database
- SQLite database with schema-first approach defined in `src/lib/server/database.ts`
- Auto-initialization on first API call
- Tables: users (authentication + game stats), space_objects (game world), research system
- All database operations should go through the server-side utilities

## Testing
- All business logic must be covered by unit tests
- Tests located in `src/__tests__/` directory
- Test environment: Vitest with jsdom for React components, node for API routes
- Test naming convention: whatIsTested_scenario_expectedOutcome
  - Example: `updateStats_researchDoesNotComplete_awardsAllIronAtOldRate`
  - Use descriptive names that explain the test's purpose
- Running tests:
  - All tests: `npm test`
  - UI mode: `npm run test:ui`
  - Watch mode: `npm test -- --watch`
- Tests should focus on business logic and avoid testing implementation details

## Building and Running
- Use `npm install` to install dependencies.
- Use `npm run dev` to start the Next.js development server (port 3000).
- Use `npm run build` to build the optimized production bundle.
- Use `npm start` to start the production server.
- Use `npm run lint` to run ESLint.
- The application includes both frontend and backend in a single Next.js application.
- API requests are handled through Next.js API routes at `/api/*` paths.
- The React application uses Next.js App Router for navigation between pages:
  - `/`: Home page (redirects to /game if authenticated, /login if not)
  - `/login`: Login/register page
  - `/game`: Game page (protected by authentication)
  - `/research`: Research page (protected by authentication)
  - `/about`: About page (protected by authentication)
  - `/profile`: Profile page (protected by authentication)

## Game Architecture
- **Client-side**: Game rendering, input handling, and UI components
- **Server-side**: Game state persistence, physics calculations, collision detection
- **Real-time updates**: Polling-based updates for game state synchronization
- **Canvas rendering**: HTML5 Canvas with specialized renderer classes for different game objects
- **Interception mechanics**: Sophisticated trajectory calculations for targeting moving objects
- **Toroidal world**: World edges wrap around for seamless space exploration