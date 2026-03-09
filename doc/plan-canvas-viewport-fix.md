# Plan: Canvas Viewport Fix — Coordinate System, DPR, and Zoom

## Problem

After the immersive fullscreen PR (#159), the canvas was resized to fill the entire
screen instead of a fixed 800×800 pixel buffer. The renderers now draw everything
"zoomed in" — objects and distances appear larger than intended.

The correct solution must also support:
- **Crisp rendering on HiDPI/Retina** (`devicePixelRatio > 1`)
- **Zoom levels** that control how much of the world is visible
- **Device-independent reference view**: a configurable constant (`BASE_VIEWPORT_WORLD_H`)
  ensures every device shows the same height of world at zoom=1, independent of screen
  size. Wider screens show more world horizontally. Squares always appear square.

---

## Three Coordinate Spaces

| Space | Unit | Source |
|---|---|---|
| **Physical pixels** | px | `canvas.width`, `canvas.height` — what the GPU renders |
| **CSS pixels** | px | `container.clientWidth/Height` — browser layout; physical ÷ `dpr` |
| **World units** | wu | game coordinates (`ship.x`, `ship.y`, asteroid positions…) |

Relations:
```
physical px  = CSS px × dpr
CSS px       = world units × worldScale
```
`worldScale` (CSS pixels per world unit) is what we control through zoom.

---

## Root Cause Analysis

### Before the PR
- Canvas buffer was fixed at **800×800 physical pixels**, displayed smaller via CSS
  `max-height`. `dpr` was irrelevant — the browser scaled a small buffer up.
- Renderers assumed **1 world unit = 1 canvas pixel** (both were effectively 1 physical
  pixel at 1× display scale).

### After the PR — Bug 1: `dpr` ignored
- Canvas buffer = `container.clientWidth × clientHeight` (CSS pixels).
- On a 2× Retina device (dpr=2), container might be 960 CSS px wide → buffer = 960
  physical pixels. Browser stretches those 960 px to fill 1920 physical px on-screen.
- Every object at 70 wu now occupies 140 physical pixels → visual 2× zoom-in.

### After the PR — Bug 2: no concept of `worldScale`
- Object sizes (`SHIP_LENGTH = 70`, asteroid = 50…) are in absolute pixel values —
  they stay the same absolute screen size regardless of display resolution.
- There is no mechanism to equalize the visible world area across different screen sizes.
  A 400px-tall screen sees 400 wu; a 1080px-tall screen sees 1080 wu.

### After the PR — Bug 3: culling uses pixel dimensions as world units
- `SpaceObjectsRenderer.drawWrappedObjects` computes visible bounds as
  `shipX ± canvasWidth/2`, treating canvas pixels as world units.
  Valid only when `worldScale = 1`. Breaks with different scales.
- `SpaceObjectRendererBase.drawSpaceObject` culls with
  `screenX < -100 || screenX > ctx.canvas.width + 100` where pixel values are
  compared to world-unit screen positions.

---

## Correct Solution: Unified World-Scale Transform

### The core formula

```ts
// src/shared/viewportConstants.ts  (new)
export const BASE_VIEWPORT_WORLD_H = 800;  // world units visible vertically at zoom=1

// Computed each frame in GameRenderer:
const dpr        = window.devicePixelRatio || 1;
const cssH       = canvas.height / dpr;            // CSS pixels tall
const worldScale = (cssH / BASE_VIEWPORT_WORLD_H) / zoom;
//   zoom = 1.0 → 800 wu visible vertically, on every device
//   zoom = 2.0 → 1600 wu visible vertically (zoomed out, see more world)
//   zoom = 0.5 →  400 wu visible vertically (zoomed in, see less)
```

Apply once per frame before all draw calls:

```ts
ctx.scale(dpr * worldScale,  dpr * worldScale)
```

After this, every `ctx` draw call operates in **world units**. Physical sharpness
(via dpr) and zoom are both handled automatically.

### Viewport center in world units

```ts
const cssW    = canvas.width / dpr;
const centerX = (cssW / 2) / worldScale;   // wu from left edge to canvas centre
const centerY = (cssH / 2) / worldScale;   // wu from top edge to canvas centre
```

These replace the current `canvas.width / 2` values passed to all sub-renderers.

### Why existing renderer math still works unchanged

All renderers currently compute:
```ts
screenX = centerX + (obj.x - ship.x)
```
With the transform, `screenX` is in world units (ctx coordinates). After
`ctx.scale(dpr × worldScale)`, ctx coordinate `N` maps to physical pixel
`N × dpr × worldScale`. The offset `(obj.x - ship.x)` is already in world
units. The only required change is that `centerX` must come in world units
(see §Changes below) — the formula itself is untouched.

Object sizes (`SHIP_LENGTH = 70`, asteroid = `50`) automatically become
**world-unit sizes**, proportional to the visible world area. At zoom=1
a 70-wu ship occupies `70/800 = 8.75 %` of screen height on every device. ✓

The transform is uniform (same factor on X and Y), so squares in
world coordinates always render as squares. ✓

### Visible world region

```
visibleWorldWidth  = (cssW / 2) / worldScale × 2  =  cssW × BASE_H × zoom / cssH
visibleWorldHeight =               cssH / worldScale  =  BASE_H × zoom
```

All devices see exactly `BASE_VIEWPORT_WORLD_H × zoom` world units
top-to-bottom. Wider devices see more world left-to-right proportionally.

---

## Files That Must Change

### 1. `src/shared/viewportConstants.ts` — NEW

```ts
/** World units visible vertically at zoom=1 on every device. */
export const BASE_VIEWPORT_WORLD_H = 800;

/** Default zoom level. Values > 1 show more world; values < 1 show less. */
export const DEFAULT_ZOOM = 1.0;

export const MIN_ZOOM = 0.25;   // see 4× more world height (zoom out limit)
export const MAX_ZOOM = 4.0;    // see 4× less world height (zoom in limit)
```

### 2. `src/app/game/GamePageClient.tsx`

**Resize effect** — multiply CSS dimensions by `dpr`:

```ts
// Was:
canvas.width  = container.clientWidth;
canvas.height = container.clientHeight;

// Becomes:
const dpr = window.devicePixelRatio || 1;
canvas.width  = Math.round(container.clientWidth  * dpr);
canvas.height = Math.round(container.clientHeight * dpr);
```

**Zoom state** — add zoom slider/controls and wire to game:

```ts
const [zoom, setZoom] = useState(DEFAULT_ZOOM);
// on change:
gameInstanceRef.current.setZoom(zoom);
```

### 3. `src/lib/client/renderers/GameRenderer.ts`

- Store `zoom` field; add `setZoom()` and `getWorldScale()` (public, needed by Game.ts).
- `drawWorld()`: compute `worldScale`, apply `ctx.scale(dpr × worldScale,…)`, compute  
  `centerX/Y` in world units, pass to sub-renderers.
- `drawGrid()` / `drawWorldBoundaries()`: replace `canvas.width/height` visible-bounds
  calculation with `(canvas.width/dpr) / worldScale` and `(canvas.height/dpr) / worldScale`
  (= world units visible horizontally/vertically).
- Introduce `ViewportInfo` struct passed to `collectiblesRenderer.drawSpaceObjects()`:

```ts
interface ViewportInfo {
  centerX: number;  // world units
  centerY: number;  // world units
  halfW:   number;  // half visible width in world units
  halfH:   number;  // half visible height in world units
}
```

### 4. `src/lib/client/renderers/SpaceObjectsRenderer.ts`

- `drawSpaceObjects()` accepts `ViewportInfo` instead of raw `worldWidth/worldHeight`.
- `drawMainObjects()` and `drawWrappedObjects()` use `viewportInfo.centerX/Y` and
  `viewportInfo.halfW/H` for culling visible bounds (replacing `canvasWidth/2`).

### 5. `src/lib/client/renderers/SpaceObjectRendererBase.ts`

- `drawSpaceObject()` and `drawWrappedObjects()` cull against world-unit canvas size.
  Replace `ctx.canvas.width + margin` with `canvas.width / (dpr × worldScale) + margin`.
  Cleanest option: derive from the `ViewportInfo` if passed through, or compute locally
  from `ctx.canvas.width / (dpr × globalWorldScale)`.

### 6. `src/lib/client/game/Game.ts`

**`updateHoverStates()`** — convert physical-pixel mouse coords to world units:

```ts
// Was (treats pixels as world units):
const worldMouseX = this.mouseX - this.ctx.canvas.width  / 2 + this.ship.getX();
const worldMouseY = this.mouseY - this.ctx.canvas.height / 2 + this.ship.getY();

// Becomes:
const dpr        = window.devicePixelRatio || 1;
const worldScale = this.renderer.getWorldScale();
const cssW       = this.ctx.canvas.width  / dpr;
const cssH       = this.ctx.canvas.height / dpr;
const worldMouseX = (this.mouseX / dpr - cssW / 2) / worldScale + this.ship.getX();
const worldMouseY = (this.mouseY / dpr - cssH / 2) / worldScale + this.ship.getY();
```

**`handleEmptySpaceClick()`** and canvas teleport — `dx/dy` from center are currently
in physical pixels; must divide by `dpr × worldScale` to get world units before adding
to ship position.

**Mouse event handlers** (click + mousemove): current formula
`scaleX = canvas.width / rect.width = dpr` correctly stores physical-pixel coords
in `this.mouseX/Y`. Keep as-is (the conversion to world units happens in
`updateHoverStates` above).

**Add `setZoom(z: number)`** that stores zoom and forwards to renderer.

---

## Files That Do NOT Need Changes

| File | Reason |
|---|---|
| `PlayerShipRenderer.ts` | Draws in ctx (= world unit) space; sizes in world units ✓ |
| `AsteroidRenderer.ts`, `ShipwreckRenderer.ts`, `EscapePodRenderer.ts`, `OtherShipRenderer.ts` | Same ✓ |
| `RadarRenderer.ts` | Receives `centerX/Y` from GameRenderer; inner 125wu radius stays correct ✓ |
| `TargetingLineRenderer.ts` | Receives `centerX/Y` from caller; offsets are world-unit deltas ✓ |
| `InterceptionLineRenderer.ts` | Same pattern ✓ |
| `TooltipRenderer.ts` | Drawn after `ctx.restore()` in physical space; verify it uses its own coordinate mapping ✓ |

---

## Implementation Steps

1. Create `src/shared/viewportConstants.ts`.
2. Update `GamePageClient.tsx` resize effect (DPR) + zoom state + wire to game instance.
3. Update `GameRenderer.ts`: `worldScale`, combined transform, corrected centres,
   `ViewportInfo`, `getWorldScale()` getter, fix `drawGrid`/`drawWorldBoundaries`.
4. Update `SpaceObjectsRenderer.ts`: accept `ViewportInfo`, fix culling.
5. Update `SpaceObjectRendererBase.ts`: fix culling comparisons to world-unit bounds.
6. Update `Game.ts`: fix `updateHoverStates()`, `handleEmptySpaceClick()`,
   teleport offset conversion; add `setZoom()`.
7. Verify `TooltipRenderer` and `InterceptionLineRenderer` are unaffected.
8. Run lint + type-check.

---

## Testing Checklist

- [ ] Same window size, different `devicePixelRatio` (e.g. 1× vs 2×): objects appear
      the same world-proportional size, rendering is crisp on both.
- [ ] Two different browser window sizes at zoom=1: both show exactly 800 wu vertically;
      wider window shows more world horizontally.
- [ ] Zoom=2: visible world height doubles; objects appear half as large on screen.
- [ ] Clicking on objects at various zoom levels fires correct hit detection.
- [ ] Toroidal wrapping: objects at world edges appear on both sides.
- [ ] Radar coordinate labels correspond to actual world positions.
- [ ] The debug grid: all cells are squares, not rectangles, at any viewport aspect ratio.
