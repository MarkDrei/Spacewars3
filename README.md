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

### End-to-End (E2E) Testing with Cypress

Cypress is used for automated browser-based E2E tests. These tests interact with the real frontend and backend, simulating user actions like registration, login, and navigation.

#### Setup
```powershell
npm install cypress --save-dev
```

#### Running Cypress
```powershell
npx cypress open
```
- This opens the Cypress Test Runner UI. Select a test file (e.g., `auth.cy.js`) to run it in the browser.

#### Writing Tests
- Test files are located in `cypress/e2e/`.
- Example test: `auth.cy.js` covers registration and login flows.
- Cypress tests use real backend and database by default, but you can mock API responses with `cy.intercept()`.

#### Best Practices
- Use stable selectors (e.g., `data-testid`) for robust tests.
- Focus on critical user flows (authentication, navigation).
- Modularize tests for maintainability.

## Deployment

### Render Deployment

This project is configured for deployment on Render using their free tier.

#### Backend Deployment

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:
   - **Build Command**: `cd packages/server && npm install && npm run build`
   - **Start Command**: `cd packages/server && npm start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `SESSION_SECRET`: (generate a random secret)

The backend uses an in-memory SQLite database on the free tier (data will be lost on service restarts).

#### Frontend Configuration

Update the backend URLs in the client services to match your deployed backend:

Replace `spacewars3.onrender.com` with your actual backend service URL in:
- `packages/client/src/services/authService.ts`
- `packages/client/src/services/userStatsService.ts`
- `packages/client/src/services/researchService.ts`

**Frontend URL**: https://spacewars-ironcore-q7n3.onrender.com
**Backend URL**: https://spacewars3.onrender.com
