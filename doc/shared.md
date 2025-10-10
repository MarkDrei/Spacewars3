# shared Package

## Overview
Code shared between client and server: types, physics, utilities.

## Files

**Types:**
- **src/types/gameTypes.ts** - SpaceObject, WorldData, PlayerShip, Asteroid, Shipwreck, EscapePod
- **src/types/index.ts** - User, GameState types
- **defenseValues.ts** - DefenseValues interface

**Physics:**
- **src/physics.ts** - Position updates (toroidal world), collision detection, distance calculations

**Utilities:**
- **src/utils/angleUtils.ts** - radiansToDegrees, degreesToRadians

**Entry:**
- **src/index.ts** - Main export

## Key Concepts

**Toroidal World:** Objects wrap at boundaries  
**Physics:** Shared calculations ensure client-server consistency  
**Types:** Single source of truth for data structures
