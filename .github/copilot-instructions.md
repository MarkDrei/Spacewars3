# Spacewars Ironcore

- This project is a 2D space exploration game built with TypeScript and Vite.
- The game uses HTML5 Canvas for rendering.
- The project follows a component-based architecture with clear separation between game logic and rendering.
- All new code should be written in TypeScript with proper type definitions.
- The project is structured as a monorepo with client, server, and shared packages.

## Project Structure
- `packages/client/`: Frontend game client
  - `packages/client/src/`: Game source code
    - `packages/client/__tests__/`: Client test files
    - `packages/client/src/renderers/`: Rendering components
    - `packages/client/src/worlds/`: World configuration files
- `packages/server/`: Backend server for user authentication and game data
  - `packages/server/src/`: Server source code
  - `packages/server/tests/`: Server test files
  - `packages/server/db/`: Database files
- `packages/shared/`: Shared code and types used by both client and server

## Development Guidelines
- Use TypeScript features like interfaces and type definitions to ensure type safety.
- Maintain the separation between game logic and rendering components.
- All rendering logic should go in the appropriate renderer class.
- The `SpaceObject` class is the base class for all objects in the game world.
- The `World` class manages all game objects and their interactions.
- Shared types and utilities should be placed in the shared package.

## Testing
- All business logic should be covered by unit tests.
- Client tests should be placed in the `packages/client/__tests__/` directory.
- Server tests should be placed in the `packages/server/tests/` directory.
- Tests names follow the pattern: whatIsTested_scenario_expectedOutcome (e.g., `updateStats_researchDoesNotComplete_awardsAllIronAtOldRate`).
- Run all tests using `npm test` or package-specific tests by running `npm test` in the package directory.

## Building and Running
- The project is designed to run on Windows using PowerShell. Commands should use PowerShell syntax (`;` instead of `&&` for chaining).
- Use `npm install` to install dependencies for all packages.
- Use `npm run build` to build all packages.
- Use `npm run dev` to start both the client and server in development mode.
- Use `npm run typecheck` to check for TypeScript errors across all packages.
- The client runs on port 3000, and the server runs on port 5174.
- API requests from the client to the server are proxied through `/api` path.
