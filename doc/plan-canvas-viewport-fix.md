# Plan: Canvas Viewport Fix (Fullscreen Scale Bug + Zoom Level)

## Problem

After the immersive fullscreen PR (#159), the canvas was resized to fill the entire screen instead of being a fixed 800×800 pixel buffer. The renderers now draw everything "zoomed in" — objects and distances appear larger than intended.

Additionally the design should support:

- A **zoom level** so the amount of world shown can be controlled.
- A **device-independent default view**: at zoom=1, every device shows the same number of world coordinate units along the shorter screen axis, regardless of physical screen size. Wider/taller screens show proportionally more world on the longer axis. Squares always appear square.

## Root Cause Analysis

### Before the PR

- The canvas had fixed HTML attributes `width="800" height="800"`.
- The CSS scaled it down via `max-height: calc(100vh - 160px)`.
- All renderers assumed **1 world unit = 1 canvas pixel**, so they used `canvas.width/2` and `canvas.height/2` directly as the center and added world offsets without any scale factor.

### After the PR

- The canvas buffer is dynamically resized: `canvas.width = container.clientWidth`, `canvas.height = container.clientHeight`.
- The renderers still assume 1 world unit = 1 canvas pixel.
- On a 1920-wide canvas the center is at x=960 and a world object 100 units away renders 100 px away — which is correct for "show more world". **But** the ship, asteroids, etc. are drawn at fixed pixel sizes (`SHIP_LENGTH = 70 px`), so they appear tiny relative to the new viewport. The effect reads as "very zoomed in" because the grid cells and object sizes did not scale.

### Actual broken case: devicePixelRatio > 1

On HiDPI displays (Retina, `devicePixelRatio = 2`):

- `container.clientWidth` = CSS pixels, e.g. 960.
- Canvas buffer is set to 960 — but the browser needs to upscale it 2× to fill the physical screen.
- **Result**: everything is blurry / visually doubled in size.

### The resize-vs-init race condition

The canvas starts at the browser default (300×150) before the ResizeObserver fires. If `Game` initialises in the first `requestAnimationFrame`, the viewport center is (150, 75) until the next resize event — causing a flash of misplaced geometry and broken hover hitboxes.

---

## Coordinate System Design

### Key insight: separate "physical pixels", "CSS pixels", and "world units"

| Space           | Definition                                                                             |
| --------------- | -------------------------------------------------------------------------------------- |
| Physical pixels | `canvas.width` / `canvas.height` — the actual buffer size                              |
| CSS pixels      | `container.clientWidth` / `container.clientHeight` — layout size; physical = CSS × DPR |
| World units     | Game coordinate system (ship at x=250, asteroid at x=500, etc.)                        |

The original codebase conflated CSS pixels and world units (1 CSS px = 1 world unit). That worked only for the fixed 800×800 buffer displayed 1:1. We need to make the relationship explicit via a **scale factor**.

### Scale factor

```
scale  =  (shortAxisCSS / BASE_WORLD_VIEW) * zoom
```

where:

- `shortAxisCSS = Math.min(cssWidth, cssHeight)` — the shorter CSS dimension
- `BASE_WORLD_VIEW = 800` — world units visible along the shorter axis at `zoom = 1`
- `zoom = 1.0` — adjustable multiplier (>1 zooms in, <1 zooms out)

**World → screen (CSS px):**

```ts
screenX = centerX_css + (worldObj.x - ship.x) * scale;
screenY = centerY_css + (worldObj.y - ship.y) * scale;
```

**Screen (CSS px) → world (for input):**

```ts
worldDx = (clickX_css - centerX_css) / scale;
worldDy = (clickY_css - centerY_css) / scale;
```

**Object sizes:**  
All constants like `SHIP_LENGTH = 70` are redefined as **world units**. On screen they appear as `70 * scale` CSS pixels.

### Device-independence guarantee

At `zoom = 1`:

- A 600-tall phone: `scale = 600/800 = 0.75` → sees 800 world units vertically, 800 \* (cssWidth/600) horizontally.
- A 1080-tall desktop: `scale = 1080/800 = 1.35` → sees 800 world units vertically, 800 \* (1920/1080) ≈ 1422 horizontally.

The short axis always shows exactly `BASE_WORLD_VIEW` world units. The long axis shows proportionally more. A 70-unit ship is `70 * 0.75 = 52.5 px` tall on the phone and `70 * 1.35 = 94.5 px` tall on the desktop — physically similar apparent size because the desktop is also a larger physical screen. Squares stay square because X and Y use the same `scale`.

### DPR handling (sharpness)

Buffer at physical resolution, drawing in CSS-pixel space:

```ts
// Canvas resize:
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(cssWidth * dpr);
canvas.height = Math.round(cssHeight * dpr);

// Frame start in GameRenderer:
ctx.save();
ctx.scale(dpr, dpr); // all subsequent draws are in CSS-pixel space
// ...draw everything using CSS-pixel coordinates...
ctx.restore();
```

---

## Viewport Object

A `Viewport` interface is introduced and computed once per frame in `GameRenderer`, then passed to every sub-renderer. This avoids scattering DPR/scale calculations across files.

```ts
// src/shared/types/viewport.ts  (new file — shared type, zero logic)
export interface Viewport {
  /** CSS pixels from left edge to viewport center */
  centerX: number;
  /** CSS pixels from top edge to viewport center */
  centerY: number;
  /** CSS pixels per world unit (accounts for zoom and screen size) */
  scale: number;
  /** Full CSS width of the canvas */
  cssWidth: number;
  /** Full CSS height of the canvas */
  cssHeight: number;
}
```

```ts
// Computed in GameRenderer at the start of each frame:
function buildViewport(canvas: HTMLCanvasElement, zoom: number): Viewport {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.width / dpr;
  const cssHeight = canvas.height / dpr;
  const shortAxis = Math.min(cssWidth, cssHeight);
  const scale = (shortAxis / BASE_WORLD_VIEW) * zoom;
  return {
    centerX: cssWidth / 2,
    centerY: cssHeight / 2,
    scale,
    cssWidth,
    cssHeight,
  };
}
```

---

## Changes Needed Per File

### 1. `src/shared/worldConstants.ts` (or a new `src/shared/viewportConstants.ts`)

Add:

```ts
export const BASE_WORLD_VIEW = 800; // world units on short axis at zoom=1
export const DEFAULT_ZOOM = 1.0;
```

### 2. `src/shared/types/viewport.ts` — **new file**

The `Viewport` interface (see above). Lives in `src/shared/` so renderers and Game.ts can both import it.

### 3. `src/app/game/GamePageClient.tsx`

Canvas resize effect:

```ts
const resize = () => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(container.clientWidth * dpr);
  canvas.height = Math.round(container.clientHeight * dpr);
  // CSS size is 100%/100% from stylesheet — no inline style needed
};
```

Optionally expose a `zoom` state variable and pass it into `Game` via a setter for future zoom UI.

### 4. `src/lib/client/renderers/GameRenderer.ts`

- Import `Viewport`, `BASE_WORLD_VIEW`, `DEFAULT_ZOOM`.
- Store `zoom: number` (default = `DEFAULT_ZOOM`); expose `setZoom(z: number)`.
- Add private `buildViewport(): Viewport`.
- In `drawWorld()`:
  ```ts
  const vp = this.buildViewport();
  const dpr = window.devicePixelRatio || 1;
  this.ctx.save();
  this.ctx.scale(dpr, dpr);
  this.drawBackground(vp); // ← passes vp
  this.drawBackgroundElements(vp); // ← passes vp
  // ... pass vp to all sub-renderers
  this.ctx.restore();
  ```
- All internal `canvas.width/2` references → `vp.centerX`.
- Grid `gridSize` stays 50 world units; screen gap = `gridSize * vp.scale`.
- World boundary rect: position = `vp.centerX - ship.x * vp.scale`, size = `worldWidth * vp.scale`.

### 5. `src/lib/client/renderers/SpaceObjectRendererBase.ts`

`drawSpaceObject()` signature gains `vp: Viewport`:

```ts
drawSpaceObject(ctx, vp: Viewport, viewportX, viewportY, spaceObject): void {
  const screenX = vp.centerX + (spaceObject.x - viewportX) * vp.scale;
  const screenY = vp.centerY + (spaceObject.y - viewportY) * vp.scale;
  ...
}
```

`drawObjectAtPosition()` uses `vp.scale` for the object's drawn size:

```ts
const baseSize = this.getObjectSize() * vp.scale;
// hover circle: ctx.arc(0, 0, 25 * vp.scale, ...)
```

Wrapping visibility check uses world-unit distances (divide margin by scale, or keep margin in world units).

### 6. `src/lib/client/renderers/SpaceObjectsRenderer.ts`

Pass `vp` through from `drawSpaceObjects()` down to `renderObject()` and `drawWrappedObjects()`. Wrapped visibility window: `±(vp.cssWidth / vp.scale / 2)` and `±(vp.cssHeight / vp.scale / 2)` world units from ship.

### 7. `src/lib/client/renderers/PlayerShipRenderer.ts`

```ts
const height = SpaceObjectRendererBase.SHIP_LENGTH * vp.scale;
```

Fallback triangle vertices scale by `vp.scale`. Hover circle radius scales.

### 8. `src/lib/client/renderers/OtherShipRenderer.ts`

`getObjectSize()` stays as world units; scaling is handled by `SpaceObjectRendererBase`.

### 9. `src/lib/client/renderers/RadarRenderer.ts`

Receives `vp: Viewport`.

- Inner circle: `ctx.arc(vp.centerX, vp.centerY, 125 * vp.scale, ...)`.
- Coordinate labels: spacing in world units × scale, keep font size fixed (labels are UI, not world objects).

### 10. `src/lib/client/renderers/TargetingLineRenderer.ts`

World → screen: multiply offsets by `vp.scale`.

### 11. `src/lib/client/renderers/InterceptionLineRenderer.ts`

Same: multiply world offsets by `vp.scale`.

### 12. `src/lib/client/renderers/TooltipRenderer.ts`

Tooltip position: `centerX + (obj.x - ship.x) * scale`.

### 13. `src/lib/client/game/Game.ts`

**Mouse input** — use CSS pixels throughout:

```ts
// In click / mousemove handlers:
const cssMouseX = mouseX; // rect-relative coords are already CSS px
const cssMouseY = mouseY;
// (remove the scaleX = canvas.width / rect.width multiplication)
this.mouseX = cssMouseX;
this.mouseY = cssMouseY;
```

**Hover world-coordinate calc** (`updateHoverStates`):

```ts
const vp = this.renderer.getViewport();  // expose current viewport from GameRenderer
const worldMouseX = vp.centerX + (this.mouseX - vp.centerX) / vp.scale + ship.getX() - ...
// simplified:
const worldMouseX = ship.getX() + (this.mouseX - vp.centerX) / vp.scale;
const worldMouseY = ship.getY() + (this.mouseY - vp.centerY) / vp.scale;
```

**Click-to-teleport world coordinates:**

```ts
const vp = this.renderer.getViewport();
const worldX = ship.getX() + (logicalX - vp.centerX) / vp.scale;
const worldY = ship.getY() + (logicalY - vp.centerY) / vp.scale;
```

**World-unit distances** in click handling (collect threshold 125, attack range 100) stay unchanged — they are already in world units.

---

## Implementation Steps (ordered)

1. **`src/shared/viewportConstants.ts`** — add `BASE_WORLD_VIEW`, `DEFAULT_ZOOM`.
2. **`src/shared/types/viewport.ts`** — add `Viewport` interface.
3. **`GamePageClient.tsx`** — update resize effect to multiply by DPR.
4. **`GameRenderer.ts`** — implement `buildViewport()`, apply `ctx.scale(dpr,dpr)`, pass `vp` to all sub-renderers, expose `getViewport()` and `setZoom()`.
5. **`SpaceObjectRendererBase.ts`** — add `vp` to `drawSpaceObject()`, scale positions and sizes.
6. **All subclass renderers** (`Asteroid`, `OtherShip`, `Shipwreck`, `EscapePod`) — update call signatures to pass `vp`.
7. **`PlayerShipRenderer.ts`** — scale ship height by `vp.scale`.
8. **`SpaceObjectsRenderer.ts`** — pass `vp`, fix visibility window to world units.
9. **`RadarRenderer.ts`** — scale circle and label positions.
10. **`TargetingLineRenderer.ts`**, **`InterceptionLineRenderer.ts`**, **`TooltipRenderer.ts`** — scale world→screen offsets.
11. **`Game.ts`** — fix mouse input to CSS pixels, fix `updateHoverStates` and teleport to use `/vp.scale`.
12. Lint + type-check.
13. (Optional) Wire zoom state in `GamePageClient.tsx` → `game.setZoom(zoom)` so a UI slider can control it.

---

## Testing

- At `zoom=1`: ship, asteroids, and wrecks appear identical in size across different browser window sizes.
- Resizing the window changes how much world is visible but not the apparent sizes.
- Clicking objects fires hit detection at the correct world position.
- At `zoom=2`: everything appears twice as large (half as many world units visible).
- At `zoom=0.5`: everything appears half as large (twice as many world units visible).
- Wrapping at world edges still functions correctly.
- Coordinate labels on the radar correspond to actual world positions.
- No blurry rendering on HiDPI/Retina screens.
