<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Spacewars Ironcore

- This project is a 2D space exploration game built with TypeScript and Vite.
- The game uses HTML5 Canvas for rendering.
- The project follows a component-based architecture with clear separation between game logic and rendering.
- All new code should be written in TypeScript with proper type definitions.

## Project Structure
- `src/`: Contains all source code
  - `src/__tests__/`: Contains Jest test files
  - `src/renderers/`: Contains rendering components
  - `src/worlds/`: Contains world configuration files

## Development Guidelines
- Use TypeScript features like interfaces and type definitions to ensure type safety.
- Maintain the separation between game logic and rendering components.
- All rendering logic should go in the appropriate renderer class.
- The `SpaceObject` class is the base class for all objects in the game world.
- The `World` class manages all game objects and their interactions.

## Testing
- All business logic should be covered by unit tests.
- Test files should be placed in the `src/__tests__/` directory.
- Tests names follow the pattern: whatIsTested_scenario_expectedOutcome (e.g., `updateStats_researchDoesNotComplete_awardsAllIronAtOldRate`).
- Run tests using `npm test`

## Building
- Use `npm run build` to create a production build.
- Use `npm run dev` to start the development server.
- Type checking is enforced with strict TypeScript settings.
