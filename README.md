# Spacewars: Ironcore

This project is an experimental project, mainly focusing on trying out vibe coding in a technology that I hardly know.

Goal is to create a 2D space exploration game with a toroidal world, featuring collectable objects, interception mechanics, and a radar system.

## Overview

Spacewars is a browser-based game where the player navigates a spaceship in a 2D toroidal world (the edges wrap around). The player can collect various objects such as shipwrecks and escape pods, and the game includes a sophisticated interception algorithm for targeting moving objects.

## Technical Stack & Architecture

- **Frontend**: TypeScript, React, HTML5 Canvas, Vite
- **Backend**: Express, SQLite, bcrypt for authentication
- **Authentication**: Session-based with HTTP-only cookies
- **Testing**: Jest
- **Structure**: Monorepo with client, server, and shared packages

The game follows a component-based architecture with clear separation between game logic and rendering:

### Core Components

- **World**: Manages game objects, collision detection, and world boundaries
- **Player**: Handles player state, inventory, and scoring
- **SpaceObject**: Base class for all objects (Ship, Collectibles, etc.)
- **InterceptCalculator**: Handles trajectory calculations for interception

### Client Implementation

The client is implemented as a React application with TypeScript that integrates HTML5 Canvas for game rendering:

- **React + React Router**: For page navigation and authentication flow
- **Authentication System**: Complete user registration, login, and session management
- **Protected Routes**: Game and other pages accessible only to authenticated users
- **Navigation**: Responsive navbar with mobile hamburger menu
- **Game Logic**: Encapsulated in TypeScript classes
- **Rendering**: Handled by specialized renderer classes

For more details about the client implementation, see the [Client README](packages/client/README.md).

## Game Mechanics

- **Movement**: Click to set ship direction and accelerate
- **Interception**: Calculate trajectories to intercept moving objects
- **Collectibles**: Shipwrecks (with different salvage types) and Escape Pods
- **World Wrapping**: Objects that move off one edge reappear on the opposite side
- **Radar**: Shows positions of nearby objects

## Project Structure

```
packages/
├── client/    # Frontend game client (TypeScript, React, Canvas)
├── server/    # Backend server (Express, SQLite)
└── shared/    # Shared code and types
```

## Development

### Prerequisites

- Node.js (v14+)
- npm (v6+)

### Quick Start

```powershell
# Install dependencies
npm install

# Start development mode (client + server)
npm run dev

# Build all packages
npm run build

# Run tests
npm test
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client (port 3000) and server (port 5174) in development mode |
| `npm run build` | Build all packages |
| `npm test` | Run all tests |
| `npm run typecheck` | Check TypeScript types across all packages |

You can also run commands for specific packages:

```powershell
# Client only
cd packages/client; npm run dev

# Server only
cd packages/server; npm run dev
```

### Testing

- **Test Structure**:
  - Client tests: `packages/client/test/` (jsdom environment)
  - Server tests: `packages/server/tests/` (node environment)
  - Pattern: `whatIsTested_scenario_expectedOutcome`

- **Test Commands**:
  - All tests: `npm test`
  - Watch mode: `npm test -- --watch`
  - Coverage: `npm test -- --coverage`
