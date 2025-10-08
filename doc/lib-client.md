# lib/client Package

## Overview
Client-side application logic: game engine, rendering, state management, and API integration. Server-authoritative architecture - client visualizes and interacts, server maintains truth.

## Sub-Packages

- **[game/](lib-client-game.md)** - Game engine (10 files)
- **[renderers/](lib-client-renderers.md)** - Canvas rendering (12 files)
- **[hooks/](lib-client-hooks.md)** - React hooks (8 hooks)
- **[services/](lib-client-services.md)** - API services (11 services)
- **debug/** - Debug utilities (debugState singleton)
- **data/worlds/** - JSON world configurations

## Architecture

**MVC Pattern:**
- Model: game/, hooks/
- View: renderers/
- Controller: services/, game input handlers

**Key Decisions:**
- Server-authoritative (no client-side physics)
- Polling-based sync (1-5s intervals)
- Canvas rendering (60fps target)
- Hook-based state management
