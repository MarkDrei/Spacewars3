# Spacewars Ironcore

- This project is a 2D space exploration game built with TypeScript, React, and Vite.
- The game uses HTML5 Canvas for rendering within a React application.
- The project follows a component-based architecture with clear separation between game logic, rendering, and UI components.
- All new code should be written in TypeScript with proper type definitions.
- The project is structured as a monorepo with client, server, and shared packages.

## Module System

- This project uses [ES Modules](https://nodejs.org/api/esm.html) exclusively (`"type": "module"` in package.json).
- Use `import`/`export` syntax only.
- Do not use CommonJS (`require`, `module.exports`).

## Project Structure
- `packages/client/`: Frontend game client
  - `packages/client/src/`: Game source code
    - `packages/client/src/components/`: React components
    - `packages/client/src/pages/`: Page components (Login, Game)
    - `packages/client/src/hooks/`: React hooks
    - `packages/client/src/renderers/`: Canvas rendering components
    - `packages/client/src/worlds/`: World configuration files
    - `packages/client/src/Game.ts`: Main game controller
    - `packages/client/src/App.tsx`: Main React component with routing
    - `packages/client/src/main.tsx`: Application entry point
  - `packages/client/test/`: Client test files
- `packages/server/`: Backend server for user authentication and game data
  - `packages/server/src/`: Server source code
  - `packages/server/tests/`: Server test files
  - `packages/server/db/`: Database files
- `packages/shared/`: Shared code and types used by both client and server

## Development Guidelines
- Use TypeScript features like interfaces and type definitions to ensure type safety.
- Maintain the separation between game logic, rendering components, and React UI.
- All canvas rendering logic should go in the appropriate renderer class.
- All UI components should be implemented as React components.
- The `SpaceObject` class is the base class for all objects in the game world.
- The `World` class manages all game objects and their interactions.
- The `Game` class integrates with React components through canvas references.
- Use React Hooks for state management and component lifecycle.
- Shared types and utilities should be placed in the shared package.

## Testing
- All business logic must be covered by unit tests
- Tests are organized by package:
  - Client tests: `packages/client/test/` (jsdom environment)
  - Server tests: `packages/server/tests/` (node environment)
- Test naming convention: whatIsTested_scenario_expectedOutcome
  - Example: `updateStats_researchDoesNotComplete_awardsAllIronAtOldRate`
  - Use descriptive names that explain the test's purpose
- Running tests:
  - All packages: `npm test` (from root)
  - Single package: `cd packages/<package>; npm test`
  - Watch mode: `npm test -- --watch`
  - Coverage: `npm test -- --coverage`
- Each package has its own Jest config optimized for its needs
- The root Jest config orchestrates running all package tests together
- Tests should focus on business logic and avoid testing implementation details

## Building and Running
- The project is designed to run on Windows using PowerShell. Commands should use PowerShell syntax (`;` instead of `&&` for chaining).
- Use `npm install` to install dependencies for all packages.
- Use `npm run build` to build all packages.
- Use `npm run dev` to start both the client and server in development mode (run from ROOT directory).
- Use `npm run mosttest` to run linting, type checking, and most tests excluding e2e (run from ROOT directory).
- Use `npm run ci` to run all tests including e2e tests (run from ROOT directory).
- The client runs on port 3000, and the server runs on port 5174.
- API requests from the client to the server are proxied through `/api` path.
- The React application uses React Router for navigation between pages:
  - `/`: Login page
  - `/game`: Game page (protected by authentication)
  - Other routes redirect to the login page
