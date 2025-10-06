# Architecture Documentation

Welcome to the Spacewars: Ironcore architecture documentation. This directory contains comprehensive documentation of the entire codebase, organized hierarchically to help developers understand, maintain, and extend the project.

## 🚀 Quick Start

**New to the project?** Start with the [Overview](overview.md) for a complete architectural understanding.

**Looking for something specific?** Use the package index below to jump to relevant documentation.

## 📚 Documentation Index

### Core Documentation

- **[overview.md](overview.md)** - 📖 **START HERE** - Complete project architecture overview
  - Executive summary
  - System architecture diagrams
  - Technology stack
  - Key architectural decisions
  - Data flow patterns
  - Security model
  - Testing strategy
  - Deployment architecture

### Package Documentation

#### Top-Level Packages

- **[shared.md](shared.md)** - Shared code between client and server
  - Types, physics, utilities
  - Used by both frontend and backend
  
- **[lib.md](lib.md)** - Business logic layer
  - Client-side and server-side separation
  - Core application functionality
  
- **[app.md](app.md)** - Application layer (Next.js)
  - Pages, layouts, API routes
  - User interface

- **[components.md](components.md)** - Reusable UI components
  - Navigation, StatusHeader, Layout

---

#### Client-Side (lib/client)

The client package contains all browser-side logic:

- **[lib-client.md](lib-client.md)** - Client package overview
  - Architecture patterns
  - Data flow
  - Integration points

**Sub-packages:**

- **[lib-client-game.md](lib-client-game.md)** - Game engine ⚙️
  - Game, World, Player
  - SpaceObject hierarchy (Ship, Asteroid, Shipwreck, EscapePod)
  - InterceptCalculator
  - **10 files detailed**

- **[lib-client-renderers.md](lib-client-renderers.md)** - Canvas rendering 🎨
  - GameRenderer coordinator
  - Specialized object renderers
  - UI overlays (radar, tooltips, targeting)
  - **12 files detailed**

- **[lib-client-hooks.md](lib-client-hooks.md)** - React hooks 🪝
  - useAuth, useIron, useResearchStatus
  - useBuildQueue, useTechCounts, useDefenseValues
  - useFactoryDataCache, useWorldData
  - **8 hooks detailed**

- **[lib-client-services.md](lib-client-services.md)** - API services 📡
  - Authentication, navigation, collection
  - World data, user stats, ship stats
  - Research, factory, messages
  - Event bus (eventService)
  - **11 services detailed**

- **[lib-client-debug.md](lib-client-debug.md)** - Debug utilities 🐛
  - Debug state singleton

- **[lib-client-data-worlds.md](lib-client-data-worlds.md)** - World configurations 🌍
  - JSON world data files

---

#### Server-Side (lib/server)

The server package contains all Node.js backend logic:

- **[lib-server.md](lib-server.md)** - Server package 🖥️
  - **Database Layer:** database, schema, migrations, seedData
  - **Repository Layer:** userRepo, worldRepo, techRepo, messagesRepo
  - **Domain Layer:** user, world, techtree, TechFactory
  - **Infrastructure:** typedLocks, typedCacheManager, session, errors
  - **17 files detailed**

- **[lib-server-types.md](lib-server-types.md)** - Server types
  - Server-specific type definitions

---

#### Shared Code (shared)

- **[shared-src-types.md](shared-src-types.md)** - Type definitions 📝
  - Game objects (SpaceObject, WorldData)
  - User types, game state
  
- **[shared-src-utils.md](shared-src-utils.md)** - Utility functions 🔧
  - Angle conversion (radians ↔ degrees)

---

#### Application Layer (app)

- **[app-api.md](app-api.md)** - API routes 🌐
  - **19 endpoints:**
    - Authentication: login, logout, register, session
    - Game state: world, user-stats, ship-stats
    - Game actions: navigate, collect (+ typed versions)
    - Research: techtree, trigger-research
    - Factory: tech-catalog, build-status, build-item, complete-build
    - Other: messages, admin/database

- **[app-pages.md](app-pages.md)** - User pages 📄
  - **8 pages:**
    - home, game, research, factory
    - profile, about, login, admin
  - Server/client component split
  - Authentication flow

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────┐
│           Client (Browser)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   UI     │  │  Game    │  │ Renderers│ │
│  │Components│  │  Engine  │  │          │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────────────────────┐│
│  │  Hooks   │  │      Services           ││
│  └──────────┘  └──────────────────────────┘│
└─────────────────────────────────────────────┘
                    ↓ HTTP/JSON
┌─────────────────────────────────────────────┐
│        Server (Next.js/Node.js)             │
│  ┌──────────────────────────────────────┐  │
│  │         API Routes                   │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Domain  │  │   Repos  │  │  Typed   │ │
│  │  Models  │  │          │  │  Locks   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│              SQLite Database                │
└─────────────────────────────────────────────┘
```

## 🎯 Key Features Documented

### 1. **Typed Lock System** 🔒
Compile-time deadlock prevention using TypeScript's type system.
- Lock ordering enforced at compile time
- Mathematical proof of deadlock-freedom
- See: [lib-server.md](lib-server.md#typedlocksts)

### 2. **Server-Authoritative Architecture** 🎮
Server maintains canonical game state, client visualizes.
- No client-server desync
- Prevents cheating
- See: [lib-client-game.md](lib-client-game.md#rationale)

### 3. **Real-Time Updates** ⚡
Polling-based synchronization with client-side interpolation.
- Iron generation calculated client-side
- World state polled from server
- See: [lib-client-hooks.md](lib-client-hooks.md#useironte)

### 4. **Canvas Rendering** 🎨
High-performance 2D rendering with specialized renderers.
- 60fps target
- Composition pattern
- See: [lib-client-renderers.md](lib-client-renderers.md)

## 📖 Reading Guide

### For New Developers
1. Read [overview.md](overview.md) - Get the big picture
2. Read [app.md](app.md) - Understand the application structure
3. Read [lib.md](lib.md) - Learn the business logic layer
4. Dive into specific packages as needed

### For Frontend Developers
1. [lib-client.md](lib-client.md) - Client architecture
2. [lib-client-hooks.md](lib-client-hooks.md) - State management
3. [lib-client-services.md](lib-client-services.md) - API integration
4. [components.md](components.md) - Reusable components

### For Backend Developers
1. [lib-server.md](lib-server.md) - Server architecture
2. [app-api.md](app-api.md) - API endpoints
3. [lib-server.md#typedlocksts](lib-server.md) - Concurrency control

### For Game Developers
1. [lib-client-game.md](lib-client-game.md) - Game engine
2. [lib-client-renderers.md](lib-client-renderers.md) - Rendering
3. [shared.md](shared.md) - Physics calculations

## 🔍 Finding Information

### By Feature
- **Authentication:** [app-api.md#authentication-routes](app-api.md), [lib-client-hooks.md#useauthts](lib-client-hooks.md)
- **Game Engine:** [lib-client-game.md](lib-client-game.md)
- **Rendering:** [lib-client-renderers.md](lib-client-renderers.md)
- **Research System:** [lib-server.md#techtreets](lib-server.md), [app-api.md#research-system-routes](app-api.md)
- **Factory System:** [lib-server.md#techfactoryts](lib-server.md), [app-api.md#factory-system-routes](app-api.md)
- **Concurrency:** [lib-server.md#typedlocksts](lib-server.md)

### By Technology
- **React Hooks:** [lib-client-hooks.md](lib-client-hooks.md)
- **Canvas API:** [lib-client-renderers.md](lib-client-renderers.md)
- **SQLite:** [lib-server.md#databasets](lib-server.md)
- **Next.js API Routes:** [app-api.md](app-api.md)
- **TypeScript Types:** [shared-src-types.md](shared-src-types.md)

## 📊 Documentation Statistics

- **Total Files:** 18 documentation files
- **Total Size:** ~110KB of documentation
- **Source Files Covered:** 111+ TypeScript/TSX files
- **Diagrams:** PlantUML diagrams in every major document
- **Cross-References:** Extensive linking between related docs

## 🎓 Learning Path

### Beginner Path
Day 1-2: Overview and high-level architecture  
Day 3-4: Application layer (pages and API routes)  
Day 5-6: Client-side packages  
Day 7: Server-side packages

### Intermediate Path
Day 1: Architecture overview  
Day 2: Game engine and rendering  
Day 3: State management (hooks and services)  
Day 4: Server logic and database

### Expert Path
Read as needed based on feature work:
- Working on UI → Components + Hooks
- Working on API → API routes + Server packages
- Working on game logic → Game + Renderers
- Working on database → Server + Repositories

## 🤝 Contributing

When adding new features or making changes:

1. **Update relevant documentation** - Keep docs in sync with code
2. **Add new docs for new packages** - Follow existing structure
3. **Update cross-references** - Link related documentation
4. **Keep diagrams current** - Update PlantUML diagrams as needed

## 📝 Documentation Conventions

Each document follows this structure:
1. **Overview** - High-level description
2. **Responsibilities** - What it does
3. **Decomposition** - Structure and sub-components (with diagrams)
4. **Rationale** - Why it's designed this way
5. **Constraints & Issues** - Limitations and known issues
6. **Details** - File-by-file analysis

## 🔗 External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Testing Strategy](testing.md)
- [Hook Architecture](hookArchitecture.md)

## 📞 Need Help?

- Check the [overview.md](overview.md) first
- Search within documentation files
- Review PlantUML diagrams for visual understanding
- Check source code comments for implementation details
- Refer to existing tests for usage examples

---

**Documentation Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** Project maintainers  

Happy coding! 🚀
