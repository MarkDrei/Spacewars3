# Spacewars Ironcore

- This project is a 2D space exploration game built with Next.js 15, TypeScript, and React.
- The game uses HTML5 Canvas for rendering within a React application.
- The project follows Next.js App Router architecture with clear separation between client, server, and shared code.
- All new code should be written in TypeScript with proper type definitions.
- The project is a Next.js fullstack application with integrated API routes.

## Instructions for AI Assistant

- If a prompt is unclear, ask for clarification before proceeding, provide assumptions.
- Do not take shortcuts when implementing features; follow best practices. If the task is too complex, break it down into smaller steps and explain your approach, document the needed and completed steps in a TODO file.
- If you encounter any technical debt, add this to TechnicalDebt.md with details.
- Do not keep old code or files that are no longer needed; clean up the project as you go.
- Add tests for all new business logic, run linting and compile.

## Module System

- This project uses [ES Modules](https://nodejs.org/api/esm.html) exclusively (`"type": "module"` in package.json).
- Use `import`/`export` syntax only. Do not use CommonJS (`require`, `module.exports`).

## Project Structure

- `src/app/`: Next.js App Router pages and API routes
  - `src/app/api/`: API routes for authentication and game logic
    - Endpoints: `/harvest`, `/login`, `/logout`, `/navigate`, `/register`, `/session`, `/ship-stats`, `/techtree`, `/trigger-research`, `/user-stats`, `/world`
  - `src/app/game/`: Game page component
  - `src/app/login/`: Login page component
  - `src/app/research/`: Research page component
  - `src/app/profile/`: Profile page component
  - `src/app/about/`: About page component
  - `src/app/layout.tsx`: Root layout with navigation and session management
  - `src/app/page.tsx`: Home page
- `src/components/`: Reusable React components
  - `src/components/Navigation/`: Navigation component with responsive design
  - `src/components/StatusHeader/`: Iron amount and status display
  - `src/components/Layout/`: Layout components for authenticated pages
- `src/lib/`: Core application logic
  - `src/lib/client/`: Client-side code (hooks, services, game engine)
    - `src/lib/client/hooks/`: React hooks for authentication, data fetching, defense values
    - `src/lib/client/services/`: API service functions
    - `src/lib/client/game/`: Game engine classes (Game, World, Ship, etc.)
    - `src/lib/client/renderers/`: Canvas rendering classes
  - `src/lib/server/`: Server-side code (database, business logic)
    - `src/lib/server/database.ts`: PostgreSQL database connection and initialization
    - `src/lib/server/schema.ts`: Database schema definitions (PostgreSQL syntax)
    - `src/lib/server/seedData.ts`: Default data seeding functions
    - `src/lib/server/session.ts`: Session management utilities
    - `src/lib/server/user.ts`: User domain logic
    - `src/lib/server/world.ts`: World physics and collision logic
    - `src/lib/server/techtree.ts`: Research system logic
    - `src/lib/server/TechFactory.ts`: Tech/defense calculations and specifications
- `src/shared/`: Shared types and utilities used by both client and server (defenseValues, etc.)
- `src/__tests__/`: Test files for all components and logic

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
- Default test user: username "a", password "a" (created during database initialization)

## Database

- PostgreSQL database with schema-first approach defined in `src/lib/server/schema.ts`
- Auto-initialization on first API call - creates tables and seeds default data
- Configuration via environment variables (POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD)
- Tables: users (authentication + game stats), space_objects (game world), battles, messages
- All database operations should go through the server-side utilities
- Seeding:
  - Production: Default user "a" and space objects (asteroids, shipwrecks, escape pods)
  - Test: Additional test users (testuser3-10) are created only in test environment
- Use `docker-compose up db -d` to start PostgreSQL locally for development
- Use `docker-compose up db-test -d` to start PostgreSQL test database (port 5433)

## Testing

- All business logic must be covered by unit tests
- Tests located in `src/__tests__/` directory
- Test environment: Vitest with jsdom for React components, node for API routes
- Test database: PostgreSQL test database (POSTGRES_TEST_DB, defaults to 'spacewars_test')
- Test naming convention: whatIsTested_scenario_expectedOutcome
  - Example: `updateStats_researchDoesNotComplete_awardsAllIronAtOldRate`
  - Use descriptive names that explain the test's purpose
- Running tests:
  - All tests: `npm test`
  - UI mode: `npm run test:ui`
  - Watch mode: `npm test -- --watch`
- Tests should focus on business logic and avoid testing implementation details
- Tests use the same PostgreSQL database engine as production for consistency

## Building and Running

- Use `npm install` to install dependencies.
- Use `docker-compose up db -d` to start PostgreSQL database.
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
- **Collectibles**: Asteroids, shipwrecks, and escape pods with different iron values
- **Research system**: Technology upgrades using iron as currency
- **Defense system**: Hull, armor, and shield values with client-side regeneration
  - Max value: 100 × tech_count
  - Current value: Hardcoded at max/2 (not yet persisted)
  - Regen rate: 1 per second (hardcoded)
  - Display: Home page shows current/max values with real-time updates
