# shared/src/types Package

## Overview
TypeScript interfaces shared between client and server.

## Files

**gameTypes.ts** - Game object types
- SpaceObject (base): id, type, x, y, speed, angle, last_position_update_ms
- PlayerShip, Asteroid, Shipwreck, EscapePod (extend SpaceObject)
- WorldData: worldSize, spaceObjects, currentTime
- TargetingLine, InterceptionLines (UI state)

**index.ts** - Additional types
- User: id, username, iron, lastUpdated
- GameState: score, shipStats, inventory

Provides type safety across client-server boundary.
