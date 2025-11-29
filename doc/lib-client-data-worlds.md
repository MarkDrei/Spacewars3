# lib/client/data/worlds Package

## Overview
JSON world configuration files.

## Files
- **default.json** - Default world config (world size, initial objects)
- **test_world.json** - Test world config (smaller, predictable for testing)

## Structure
```json
{
  "worldSize": { "width": number, "height": number },
  "spaceObjects": [
    { "id": number, "type": string, "x": number, "y": number, ... }
  ]
}
```

Used by World class for initialization. Server-side world management via `/api/world` may supersede.
