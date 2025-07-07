# Spacewars: Ironcore

This project is an experimental project, mainly focusing on trying out vibe coding in a technology that I hardly know.

Goal is to create a 2D space exploration game with a toroidal world, featuring collectable objects, interception mechanics, and a radar system.

## Overview

Spacewars is a browser-based game where the player navigates a spaceship in a 2D toroidal world (the edges wrap around). The player can collect various objects such as shipwrecks and escape pods, and the game includes a sophisticated interception algorithm for targeting moving objects.

## Technical Stack

- **TypeScript**: Strongly-typed JavaScript for better development experience
- **Vite**: Modern, fast build tool and development server
- **Jest**: For unit testing
- **HTML5 Canvas**: For rendering the game

## Architecture

The game follows a component-based architecture, with clear separation of concerns:

### Core Components

- **World**: Manages the game world, including space objects, collision detection, and world boundaries.
- **Player**: Handles player state, inventory, and scoring.
- **SpaceObject**: Base class for all objects in the game world.
- **Ship**: Represents the player's ship with movement controls.
- **Collectible**: Abstract base class for all collectible items.
  - **Shipwreck**: Collectible with different salvage types (fuel, weapons, tech).
  - **EscapePod**: Collectible with survivors that can be rescued.
- **InterceptCalculator**: Handles trajectory calculations for interception.

### Rendering Components

- **GameRenderer**: Main renderer that coordinates all rendering activities.
- **ShipRenderer**: Renders the player's ship.
- **AsteroidRenderer**: Renders asteroids.
- **CollectibleRenderer**: Base renderer for collectibles.
  - **ShipwreckRenderer**: Renders shipwreck collectibles.
  - **EscapePodRenderer**: Renders escape pod collectibles.
- **RadarRenderer**: Renders the radar display.
- **TooltipRenderer**: Renders tooltips for objects.

### Game Initialization

- **WorldInitializer**: Creates and initializes the game world.
- **Game**: Main game class that ties everything together.

## Component Dependencies

The following diagram shows the dependencies between key components:

```plantuml
@startuml

package "Core Components" {
  [SpaceObject] as SO
  [Ship] as SH
  [World] as W
  [Player] as PL
  [InterceptCalculator] as IC
  [Collectible] as CO
  [Shipwreck] as SW
  [EscapePod] as EP
}

package "Rendering" {
  [GameRenderer] as GR
  [ShipRenderer] as SR
  [AsteroidRenderer] as AR
  [RadarRenderer] as RR
  [TooltipRenderer] as TR
  [CollectibleRenderer] as CR
  [ShipwreckRenderer] as SWR
  [EscapePodRenderer] as EPR
}

package "Game Control" {
  [Game] as G
  [WorldInitializer] as WI
}

' Core Dependencies
SH --|> SO : extends
CO --|> SO : extends
SW --|> CO : extends
EP --|> CO : extends
PL --> SH : contains
W --> PL : contains
W --> SO : contains
W --> IC : uses

' Renderer Dependencies
GR --> W : renders
GR --> SR : uses
GR --> AR : uses
GR --> RR : uses
GR --> TR : uses
GR --> CR : uses
GR --> SWR : uses
GR --> EPR : uses
SWR --|> CR : extends
EPR --|> CR : extends

' Game Control Dependencies
G --> W : manages
G --> GR : uses
WI --> W : initializes
WI --> SH : creates
WI --> SW : creates
WI --> EP : creates

' Collectible Dependencies
CO --> PL : interacts

@enduml
```

## Game Mechanics

### Movement

The ship can move in any direction using mouse clicks. The ship's angle determines its direction of travel.

### Interception

The game includes a sophisticated interception system that can calculate the angle needed to intercept moving objects, taking into account both the target's and the ship's velocity.

### Collectibles

- **Shipwrecks**: Provide salvage of different types:
  - Fuel: Increases ship speed
  - Weapons: (Placeholder for future functionality)
  - Tech: (Placeholder for future functionality)
  - Generic: Basic points
  
- **Escape Pods**: Contain survivors that can be rescued for points.

### World Wrapping

The game world is toroidal, meaning objects that move off one edge of the screen will reappear on the opposite edge.

### Radar System

A radar display shows the positions of objects relative to the ship, helping with navigation.

## HUD (Heads Up Display)

The game includes a HUD that displays:
- Ship status (speed, coordinates)
- Score
- Last collected item
- Inventory of collected items

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development server with `npm start`
4. Use mouse clicks to navigate the ship
5. Collect objects by moving near them

## Development

### Prerequisites

- Node.js (v14+)
- npm (v6+)

### Project Structure

The project is organized as a monorepo with the following packages:

- `packages/client`: Frontend game client built with TypeScript, Vite, and HTML5 Canvas
- `packages/server`: Backend server built with Express and SQLite
- `packages/shared`: Shared code and types used by both client and server

### Install Dependencies

First, install dependencies for all packages:

```powershell
npm install
```

### Building the Project

To build all packages:

```powershell
npm run build
```

This will:
1. Build the shared package first
2. Build the client and server packages in parallel
3. Create optimized files in their respective `dist` directories

### Running in Development Mode

To start both the client and server in development mode:

```powershell
npm run dev
```

This will:
1. Start the Vite development server for the client on port 3000
2. Start the Express server on port 5174
3. Configure the client to proxy API requests to the server

You can also run each package separately:

```powershell
# Client only
cd packages/client; npm run dev

# Server only
cd packages/server; npm run dev
```

### Running Tests

To run tests for all packages:

```powershell
npm test
```

To run tests for a specific package:

```powershell
# Client tests
cd packages/client; npm test

# Server tests
cd packages/server; npm test
```

### Type Checking

To type-check all packages:

```powershell
npm run typecheck
```

## Testing

Tests are configured in a monorepo structure with package-specific Jest configurations:

### Running Tests
- Run all tests across packages: `npm test`
- Run client tests only: `cd packages/client; npm test`
- Run server tests only: `cd packages/server; npm test`
- Run tests in watch mode: `npm test -- --watch`
- View test coverage: `npm test -- --coverage`

### Test Structure
- Client tests are in `packages/client/test/`
  - Uses jsdom environment for DOM testing
  - Tests React components and game logic
- Server tests are in `packages/server/tests/`
  - Uses node environment for backend testing
  - Tests API endpoints and business logic
- All test files use the pattern: `*.test.ts`
- Tests are written following the pattern: `whatIsTested_scenario_expectedOutcome`

### Test Configuration
Each package has its own Jest configuration optimized for its needs:
- `packages/client/jest.config.js`: Client-specific setup with jsdom
- `packages/server/jest.config.js`: Server-specific setup with node
- Root `jest.config.js`: Orchestrates running all package tests together
