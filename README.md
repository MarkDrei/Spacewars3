# Spacewars: Ironcore

Venture into the unending stars of Spacewars: Ironcore, where every journey is a test of exploration and ingenuity. As you pilot your craft through an infinite, wraparound cosmos, the hunt for iron becomes your primary quest—salvaging wrecks and chasing elusive escape pods to gather this precious resource. Each grain of iron fuels your technological ambitions, powering advanced research, unlocking new abilities, and giving you the edge to innovate and thrive in the far reaches of space.

But this universe is not yours alone. Rival explorers chart their own destinies across the same boundless sectors, driven by the same hunger for iron and progress. Engage in tactical combat, outmaneuver your opponents, and construct technologies that set you apart. With every upgrade, your ship evolves—a testament to your mastery of research and relentless pursuit of dominance. In Spacewars: Ironcore, exploration blends seamlessly with competition, forging a living world where visionaries rise, and only the boldest adventurers shape the future.

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

**Or use Docker** (recommended for consistent environment):
- Docker (v20+)
- Docker Compose (v2+)

### Docker Development

The project includes full Docker support for both local development and production deployment.

#### Quick Start with Docker

```bash
# Development mode with hot reload
docker-compose up dev

# Production mode (test production build locally)
docker-compose up prod
```

The application will be available at `http://localhost:3000`.

#### Docker Commands

| Command | Description |
|---------|-------------|
| `docker-compose up dev` | Start development server with hot reload |
| `docker-compose up prod` | Start production server |
| `docker-compose down` | Stop and remove containers |
| `docker-compose build` | Rebuild containers after dependency changes |

#### Docker Features

- **Hot Reload**: Changes to source code automatically reflect in the running container
- **Volume Mounts**: Database persists between container restarts
- **Isolated Environment**: Consistent development environment across all platforms
- **Multi-stage Builds**: Optimized production images with minimal size

### GitHub Codespaces

This project is fully configured for GitHub Codespaces development:

1. Click "Code" → "Codespaces" → "Create codespace on main"
2. Wait for the container to build (automatically installs dependencies)
3. Run `npm run dev` in the terminal
4. Access the application through the forwarded port (3000)

The Codespace includes:
- Node.js 20 LTS
- Git and Bash
- Pre-configured VSCode extensions (ESLint, Prettier, Tailwind CSS)
- Automatic dependency installation
- Port forwarding for the application

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

📚 **[Complete Testing Strategy Documentation](doc/testing.md)** - Comprehensive guide to database isolation, test categories, and execution patterns.

## Deployment

The application is production-ready with multiple deployment options, featuring enterprise-grade reliability with deadlock-free architecture.

### 🚀 Production Features

- **Zero Deadlock Potential**: Compile-time guaranteed deadlock prevention
- **High Performance**: In-memory caching with optimized lock patterns
- **Type Safety**: Complete TypeScript coverage with lock context validation
- **Comprehensive Testing**: 196 automated tests covering all scenarios
- **Clean Architecture**: Zero technical debt, production-ready codebase

### Deployment Options

- **Docker**: Use included `Dockerfile` for containerized deployment
- **Docker Compose**: Use `docker-compose.yml` for orchestrated deployment
- **Render**: Use included `render.yaml`
- **Vercel**: Use included `vercel.json` 
- **Any Node.js host**: Standard Next.js build output

#### Docker Production Deployment

```bash
# Build production image
docker build -t spacewars3:latest .

# Run production container
docker run -p 3000:3000 \
  -v $(pwd)/database:/app/database \
  -e SESSION_SECRET=your-secret-here \
  -e NODE_ENV=production \
  spacewars3:latest
```

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

## Troubleshooting

### Docker Issues

**Port already in use:**
```bash
# Stop any running containers
docker-compose down

# Or use a different port
docker-compose run -p 3001:3000 dev
```

**Container not updating after code changes:**
```bash
# Rebuild the container
docker-compose build dev
docker-compose up dev
```

**Database permission issues:**
```bash
# Ensure database directory has correct permissions
mkdir -p database
chmod 755 database
```

### GitHub Codespaces Issues

**Dependencies not installed:**
```bash
# Manually install dependencies
npm install
```

**Port not forwarding:**
- Check the "Ports" tab in VSCode
- Ensure port 3000 is listed and public
- Click the globe icon to make it accessible

**Build fails with font loading error:**
This is expected in restricted network environments. The application still works; the build process needs internet access to fetch Google Fonts.

### General Issues

**SQLite database locked:**
- Stop all running instances of the application
- Delete `database/*.db-wal` and `database/*.db-shm` files
- Restart the application

**Tests failing:**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install
npm test
```

