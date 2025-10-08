# lib/client/game Package

## Overview
Client-side game engine classes implementing Model layer. Server-authoritative design - client visualizes server state, no client-side physics.

## Files (10 files)

**Core:**
- **Game.ts** - Main game coordinator, handles clicks, manages renderers
- **World.ts** - World state container, manages objects, singleton pattern
- **Player.ts** - Player entity, owns ship

**Objects:**
- **SpaceObject.ts** - Abstract base class wrapping server data
- **Ship.ts** - Ship entity
- **Collectible.ts** - Base for collectibles with value
- **Asteroid.ts** - Asteroid collectible
- **Shipwreck.ts** - Shipwreck collectible  
- **EscapePod.ts** - Escape pod collectible

**Utilities:**
- **InterceptCalculator.ts** - Calculate interception trajectories for moving targets

## Key Concepts

**Server-Authoritative:**
- Client-side physics removed
- All position updates from server via WorldData
- Client only handles visualization and input

**Game Loop:**
1. User clicks canvas
2. Game.handleClick() processes input
3. navigationService/collectionService API call
4. useWorldData polls server
5. World.updateFromWorldData() syncs
6. GameRenderer renders to canvas

**Interception:**
- Calculate angle to intercept moving target
- Handles toroidal world wrapping (9 wrap positions)
- Used when clicking on objects beyond collection range
