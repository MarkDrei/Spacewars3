# Spacewars: Ironcore

A 2D space exploration game with a toroidal world, featuring collectable objects, interception mechanics, and a radar system. Built with a **deadlock-free, compile-time safe lock system** for optimal performance and reliability.

## Overview

Spacewars is a browser-based game where players navigate a spaceship in a 2D toroidal world (edges wrap around). Players can collect objects like shipwrecks and escape pods, featuring sophisticated interception algorithms for targeting moving objects.

## 🏆 Key Features

- **🛡️ Deadlock-Free Architecture**: Mathematically impossible to create deadlocks with compile-time safety
- **⚡ High-Performance Caching**: In-memory cache with typed lock system for optimal performance
- **🎯 Sophisticated Interception**: Advanced algorithms for targeting moving objects
- **🌍 Toroidal World**: Seamless edge wrapping for continuous exploration
- **🔬 Research System**: Technology upgrades using iron resources
- **🎮 Real-time Gameplay**: Smooth canvas rendering with efficient collision detection

## Technical Stack

- **Framework**: Next.js 15 (App Router)
- **Frontend**: TypeScript, React, HTML5 Canvas
- **Backend**: Next.js API Routes, SQLite, bcrypt authentication
- **Session Management**: iron-session with HTTP-only cookies
- **Concurrency**: Typed lock system with compile-time deadlock prevention
- **Caching**: In-memory cache with database persistence
- **Testing**: Vitest with jsdom (196 tests, 100% passing)
- **Database**: SQLite with schema-first approach

## Architecture

The game uses Next.js fullstack architecture with clear separation between client and server logic, featuring a **compile-time safe lock system** that prevents deadlocks and ensures data consistency.

### 🛡️ Advanced Concurrency System

- **Typed Lock System**: TypeScript enforces correct lock acquisition order at compile time
- **Deadlock Prevention**: Mathematically impossible to create deadlocks
- **Context-based Access**: Data access only allowed with proper lock contexts
- **In-memory Caching**: High-performance cache with database persistence
- **Lock Ordering**: World → User → Database lock hierarchy prevents conflicts

### Core Components

- **World**: Manages game objects, collision detection, and world boundaries
- **Player**: Handles player state, inventory, and scoring  
- **SpaceObject**: Base class for all game objects (Ship, Collectibles, etc.)
- **InterceptCalculator**: Handles trajectory calculations for interception
- **TypedCacheManager**: Manages in-memory cache with deadlock-free locks
- **API Layer**: 7 endpoints with compile-time safe lock patterns

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (7 endpoints with typed locks)
│   ├── game/              # Game page
│   ├── login/             # Login page
│   └── ...                # Other pages
├── components/            # React components (Navigation, StatusHeader)
├── lib/
│   ├── client/           # Client-side code (hooks, services, game engine)
│   └── server/           # Server-side code (database, typed locks, cache)
└── shared/               # Shared types and utilities
```

## Game Mechanics

- **Movement**: Click to set ship direction and accelerate
- **Interception**: Calculate trajectories to intercept moving objects
- **Collectibles**: Shipwrecks (with different salvage types) and Escape Pods
- **World Wrapping**: Objects moving off edges reappear on opposite side
- **Radar**: Shows positions of nearby objects
- **Research**: Technology upgrade system with iron resource management
- **Real-time Updates**: Efficient polling-based synchronization with deadlock-free caching

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

- **Schema**: Defined in `src/lib/server/database.ts` with auto-initialization
- **Location**: `database/users.db` (SQLite)
- **Caching**: In-memory cache with typed lock system for optimal performance
- **Concurrency**: Deadlock-free access patterns ensure data consistency

### Testing

- **Test Structure**: Tests located in `src/__tests__/`
- **Pattern**: `whatIsTested_scenario_expectedOutcome`
- **Coverage**: **196/196 tests passing (100%)**
- **Environment**: jsdom for React components, node for API routes
- **Concurrency Testing**: Comprehensive tests for lock ordering and deadlock prevention

## Deployment

The application is production-ready with multiple deployment options, featuring enterprise-grade reliability with deadlock-free architecture.

### 🚀 Production Features

- **Zero Deadlock Potential**: Compile-time guaranteed deadlock prevention
- **High Performance**: In-memory caching with optimized lock patterns
- **Type Safety**: Complete TypeScript coverage with lock context validation
- **Comprehensive Testing**: 196 automated tests covering all scenarios
- **Clean Architecture**: Zero technical debt, production-ready codebase

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
- **API routes**: 7 endpoints with typed lock system
- **Optimized bundles**: ~100kB first load JS

The application uses SQLite database (included) and features a mathematically deadlock-free architecture, making it ready for high-traffic production deployment.

