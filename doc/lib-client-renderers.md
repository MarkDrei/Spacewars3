# lib/client/renderers Package

## Overview
Canvas rendering classes for game visualization. Each renderer handles specific visual aspect.

## Renderers (12 files)

**Main:**
- **GameRenderer** - Coordinates all rendering, clears canvas, manages render order

**Object Renderers:**
- **SpaceObjectsRenderer** - Dispatcher routing to type-specific renderers
- **SpaceObjectRendererBase** - Base class with common utilities
- **PlayerShipRenderer** - Player ship (triangle)
- **OtherShipRenderer** - NPC ships
- **AsteroidRenderer** - Asteroids (irregular circles)
- **ShipwreckRenderer** - Shipwrecks (damaged ships)
- **EscapePodRenderer** - Escape pods (capsules)

**UI Overlays:**
- **RadarRenderer** - Minimap showing object positions
- **TargetingLineRenderer** - Visual feedback for clicks (fades over 4s)
- **InterceptionLineRenderer** - Intercept path visualization
- **TooltipRenderer** - Hover tooltips with object info

## Pattern

**Render Order:**
1. Clear canvas
2. Draw objects (via SpaceObjectsRenderer dispatch)
3. Draw targeting/interception lines
4. Draw radar
5. Draw tooltips

**Specialization:**
Each object type has dedicated renderer extending SpaceObjectRendererBase
