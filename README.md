# Spacewars: Ironcore

A 2D space exploration game with a toroidal world, featuring collectable objects, interception mechanics, and a radar system.

## Overview

Spacewars is a browser-based game where players navigate a spaceship in a 2D toroidal world (edges wrap around). Players can collect objects like shipwrecks and escape pods, featuring sophisticated interception algorithms for targeting moving objects.

## Technical Stack

- **Framework**: Next.js 15 (App Router)
- **Frontend**: TypeScript, React, HTML5 Canvas
- **Backend**: Next.js API Routes, SQLite, bcrypt authentication
- **Session Management**: iron-session with HTTP-only cookies
- **Testing**: Vitest with jsdom
- **Database**: SQLite with schema-first approach

## Architecture

The game uses Next.js fullstack architecture with clear separation between client and server logic:

### Core Components

- **World**: Manages game objects, collision detection, and world boundaries
- **Player**: Handles player state, inventory, and scoring  
- **SpaceObject**: Base class for all game objects (Ship, Collectibles, etc.)
- **InterceptCalculator**: Handles trajectory calculations for interception

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (authentication, game logic)
│   ├── game/              # Game page
│   ├── login/             # Login page
│   └── ...                # Other pages
├── components/            # React components (Navigation, StatusHeader)
├── lib/
│   ├── client/           # Client-side code (hooks, services, game engine)
│   └── server/           # Server-side code (database, business logic)
└── shared/               # Shared types and utilities
```

## Game Mechanics

- **Movement**: Click to set ship direction and accelerate
- **Interception**: Calculate trajectories to intercept moving objects
- **Collectibles**: Shipwrecks (with different salvage types) and Escape Pods
- **World Wrapping**: Objects moving off edges reappear on opposite side
- **Radar**: Shows positions of nearby objects
- **Research**: Technology upgrade system with iron resource management

## Development

### Prerequisites

- Node.js (v18+)
- npm (v8+)

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm run test
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server (port 3000) |
| `npm run build` | Build optimized production bundle |
| `npm start` | Start production server |
| `npm run test` | Run all tests with Vitest |
| `npm run test:ui` | Run tests with UI interface |
| `npm run lint` | Run ESLint |

### Database

- **Schema**: Defined in `src/lib/server/database.ts`
- **Location**: `database/users.db` (SQLite)
- **Auto-initialization**: Database created on first API call

### Testing

- **Test Structure**: Tests located in `src/__tests__/`
- **Pattern**: `whatIsTested_scenario_expectedOutcome`
- **Coverage**: 96.8% (120/124 tests passing)
- **Environment**: jsdom for React components, node for API routes

## Deployment

The application is production-ready with multiple deployment options:

### Deployment Options

- **Render**: Use included `render.yaml`
- **Vercel**: Use included `vercel.json` 
- **Any Node.js host**: Standard Next.js build output

### Environment Variables

Required for production:

- `NODE_ENV`: `production`
- `SESSION_SECRET`: Random secret for session encryption

### Build Output

- **Static pages**: Home, About, Login pages
- **Dynamic pages**: Game, Research, Profile (require authentication)
- **API routes**: 11 endpoints for authentication and game logic
- **Optimized bundles**: ~100kB first load JS

The application uses SQLite database (included) and is ready for production deployment.
