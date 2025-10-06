# lib/client Package

## Overview
Contains all client-side application logic for the Spacewars game. Implements the Model-View-Controller pattern with game engine, rendering, state management, and API integration. This package handles everything that runs in the browser, excluding React UI components.

## Responsibilities
- Implement game engine and game loop
- Manage game entities and world state
- Handle Canvas rendering and visualization
- Provide React hooks for state management
- Abstract API communication through services
- Calculate game physics client-side (prediction)
- Handle user interactions and input
- Manage real-time data synchronization

## Decomposition

```plantuml
@startuml
package "lib/client" {
  package "game" {
    note "Game engine classes\nWorld, Ship, Collectibles\nInterceptCalculator"
  }
  
  package "renderers" {
    note "Canvas rendering\nGameRenderer\nSpecialized renderers"
  }
  
  package "hooks" {
    note "React hooks\nuseAuth, useIron\nResource management"
  }
  
  package "services" {
    note "API service layer\nHTTP communication\nEvent bus"
  }
  
  package "data" {
    package "worlds" {
      note "World configs\nJSON data files"
    }
  }
  
  package "debug" {
    note "Debug utilities\ndebugState singleton"
  }
  
  game --> renderers : rendered by
  game --> services : uses for sync
  hooks --> services : call APIs
  hooks --> game : manage state
  renderers --> game : visualizes
  game --> data : may load from
}

note bottom of "lib/client"
  Client-side MVC architecture:
  - Model: game, hooks
  - View: renderers
  - Controller: services, game input handlers
end note
@enduml
```

### Sub-Packages

**See detailed documentation:**
- [game/](lib-client-game.md) - Game engine and entities (10 files)
- [renderers/](lib-client-renderers.md) - Canvas rendering (12 files)
- [hooks/](lib-client-hooks.md) - React hooks (8 files)
- [services/](lib-client-services.md) - API services (11 files)
- [data/worlds/](lib-client-data-worlds.md) - World configurations
- [debug/](lib-client-debug.md) - Debug utilities

### Directory Structure
```
lib/client/
├── game/              # Game engine (Model)
│   ├── Game.ts
│   ├── World.ts
│   ├── SpaceObject.ts
│   ├── Ship.ts
│   ├── Collectible.ts
│   ├── Asteroid.ts
│   ├── Shipwreck.ts
│   ├── EscapePod.ts
│   ├── Player.ts
│   └── InterceptCalculator.ts
├── renderers/         # Canvas rendering (View)
│   ├── GameRenderer.ts
│   ├── SpaceObjectsRenderer.ts
│   ├── SpaceObjectRendererBase.ts
│   ├── PlayerShipRenderer.ts
│   ├── OtherShipRenderer.ts
│   ├── AsteroidRenderer.ts
│   ├── ShipwreckRenderer.ts
│   ├── EscapePodRenderer.ts
│   ├── RadarRenderer.ts
│   ├── TargetingLineRenderer.ts
│   ├── InterceptionLineRenderer.ts
│   └── TooltipRenderer.ts
├── hooks/             # State management (Controller)
│   ├── useAuth.ts
│   ├── useIron.ts
│   ├── useResearchStatus.ts
│   ├── useBuildQueue.ts
│   ├── useTechCounts.ts
│   ├── useFactoryDataCache.ts
│   ├── useDefenseValues.ts
│   └── useWorldData.ts
├── services/          # API layer (Controller)
│   ├── authService.ts
│   ├── navigationService.ts
│   ├── collectionService.ts
│   ├── worldDataService.ts
│   ├── userStatsService.ts
│   ├── shipStatsService.ts
│   ├── researchService.ts
│   ├── factoryService.ts
│   ├── messagesService.ts
│   ├── eventService.ts
│   └── index.ts
├── data/
│   └── worlds/        # Static data
│       ├── default.json
│       └── test_world.json
└── debug/             # Debug utilities
    └── debugState.ts
```

## Rationale

**Architecture Decisions:**

1. **Server-Authoritative Model**
   - Client focuses on visualization and input
   - No client-side physics simulation (removed)
   - Server maintains authoritative state
   - Simplified client, no desync issues

2. **Separation of Concerns**
   - Game logic separate from rendering
   - API communication abstracted to services
   - State management through hooks
   - Each component has single responsibility

3. **Canvas Rendering**
   - High performance for 2D graphics
   - Full control over rendering
   - Specialized renderers for each object type
   - Composition pattern for renderer organization

4. **Hook-Based State Management**
   - React Hooks for reusable state logic
   - Polling-based updates with client-side interpolation
   - Event-driven cross-component communication
   - Shared data patterns reduce redundant calls

5. **Service Layer Pattern**
   - Abstract API communication
   - Type-safe interfaces
   - Consistent error handling
   - Easy to mock for testing

## Constraints, Assumptions, Consequences, Known Issues

**Assumptions:**
- Modern browser with Canvas support
- JavaScript enabled
- Reasonable network latency (<500ms typical)
- Polling acceptable (no WebSockets currently)

**Consequences:**
- Network latency affects responsiveness
- Periodic polling creates API load
- Must handle connection failures gracefully
- Client-side prediction not implemented

**Constraints:**
- Browser APIs only (no Node.js APIs)
- Must handle various screen sizes
- Must work with touch and mouse input
- Performance critical for 60fps rendering

**Known Issues:**
- Client-side physics removed (see game package docs)
- Some legacy code marked with TODOs
- No request cancellation in services (potential memory leaks)

## Integration Patterns

### Game Engine ↔ Renderers
```typescript
// Game creates renderer, provides world state
const game = new Game(canvas);
const world = game.getWorld();

// Renderer visualizes world state
gameRenderer.render(world);
```

### Hooks ↔ Services
```typescript
// Hook calls service, manages state
const { ironAmount, isLoading } = useIron();

// Service calls API
const result = await userStatsService.getUserStats();
```

### Components ↔ Hooks
```typescript
// Component uses hooks for state
function GamePage() {
  const { isLoggedIn } = useAuth();
  const { worldData } = useWorldData();
  
  return <GameCanvas worldData={worldData} />;
}
```

### Services ↔ API Routes
```typescript
// Service calls backend API
const response = await fetch('/api/navigate', {
  method: 'POST',
  body: JSON.stringify({ angle, speed })
});
```

## Data Flow

### User Action → Server → UI Update
```
1. User clicks canvas
2. Game.handleClick() processes input
3. navigationService.setShipDirection() calls API
4. Server updates ship in database
5. useWorldData hook polls server
6. World.updateFromWorldData() syncs state
7. GameRenderer.render() updates canvas
```

### Server Poll → State Update
```
1. useIron hook polls every 5 seconds
2. userStatsService.getUserStats() fetches data
3. Hook calculates client-side values
4. Display updates every 100ms
5. Next server poll re-syncs
```

## Performance Considerations

**Rendering:**
- Canvas rendering at 60fps
- Specialized renderers for performance
- Only render visible objects
- Debug rendering toggleable

**Polling:**
- Different intervals for different data:
  - World: 1-2 seconds
  - Iron: 5 seconds
  - Research: 10 seconds
- Client-side interpolation between polls
- Event-driven invalidation

**Memory:**
- Canvas reuse (no recreation)
- Object pooling for game entities
- Cleanup on component unmount
- Event listener cleanup

## Testing Strategy

**Unit Tests:**
- Game logic (InterceptCalculator, World)
- Hooks (with mocked services)
- Services (with mocked fetch)

**Integration Tests:**
- Game engine with renderers
- Hooks with real API calls (test environment)
- End-to-end user flows

**Visual Tests:**
- Rendering output validation
- Responsive design checks
- Cross-browser compatibility

## Development Patterns

### Adding New Game Object Type
1. Create class in game/ extending SpaceObjectOld or Collectible
2. Create renderer in renderers/ extending SpaceObjectRendererBase
3. Register renderer in SpaceObjectsRenderer
4. Add type to shared/types/gameTypes.ts
5. Update World factory method

### Adding New Hook
1. Create hook file in hooks/
2. Use existing service for API calls
3. Implement polling if needed
4. Listen to relevant events from eventService
5. Export from hooks package
6. Document in hookArchitecture.md

### Adding New API Call
1. Create/update service in services/
2. Define TypeScript interfaces
3. Handle errors consistently
4. Emit events if state changes
5. Use in hooks for state management

## Architecture Benefits

1. **Maintainability**
   - Clear separation of concerns
   - Each class/hook has single purpose
   - Easy to locate and modify code

2. **Testability**
   - Services mockable for testing
   - Hooks testable in isolation
   - Game logic independent of rendering

3. **Performance**
   - Optimized rendering pipeline
   - Efficient polling strategies
   - Client-side calculations reduce server load

4. **Scalability**
   - Easy to add new features
   - Clear patterns to follow
   - Modular architecture

5. **Type Safety**
   - Full TypeScript coverage
   - Shared types with server
   - Compile-time error detection

## Migration Notes

**Removed Client-Side Physics:**
- Originally client had physics simulation
- Caused desync issues with server
- Now client only visualizes server state
- Simplified architecture, single source of truth

**Typed Lock Migration:**
- navigate-typed and collect-typed added
- Server uses compile-time safe locks
- Client doesn't need changes
- Backwards compatible during transition
