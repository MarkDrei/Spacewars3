# Plan: Canvas Viewport Fix

## Problem Statement

The game canvas is currently hardcoded to 800×800 pixels via HTML attributes (`width="800" height="800"`). On large screens this leaves unused space, while on small screens the CSS `max-height: calc(100vh - 160px)` causes the canvas to be scaled down by the browser, making the game feel cramped.

## Goal

Make the game canvas dynamically size to fill the available viewport, so that:
- On large screens, the canvas is as large as possible within the visible area.
- On small screens, the canvas shrinks to fit without overflow.
- The canvas stays square to match the square game world.
- All existing click / hover / coordinate mechanics continue to work correctly.

## Approach

### Why dynamic sizing works

All rendering code uses `canvas.width` and `canvas.height` (the attribute dimensions, not the CSS display size), so making these attributes reflect the actual available size means the game automatically renders a larger or smaller window into the world — no renderer changes are required.

Click and mouse-move handlers already compensate for CSS scaling via:
```ts
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
```
Once the canvas attribute size equals the CSS display size (which is the goal), `scaleX` and `scaleY` will both equal 1 and this code remains correct.

### Implementation Plan

#### Task 1: Update CSS

**File**: `src/app/game/GamePage.css`

- Remove the `width: auto; height: auto; max-width: 100%; max-height: ...` rules from `#gameCanvas`.
- Instead, let the canvas fill its `.canvas-inner` container: `display: block; width: 100%; height: 100%`.
- Make `.canvas-inner` fill its container: use `width: 100%; height: 100%`.
- Make `.canvas-container` use a square size based on the viewport: `min(100vw, calc(100vh - 200px))` or use a `ResizeObserver` approach in JS.

#### Task 2: Dynamic canvas sizing via ResizeObserver

**File**: `src/app/game/GamePageClient.tsx`

- Add a `containerRef` pointing to `.canvas-inner` (the element that wraps the canvas).
- Add a `ResizeObserver` in a `useEffect` that watches `containerRef`.
- On resize: set `canvas.width` and `canvas.height` to the observed container size (keep square: use `Math.min(width, height)`).
- Remove the hardcoded `width="800"` and `height="800"` attributes from the `<canvas>` element (or set them dynamically).

#### Task 3: Update game-page-requirements.md

Update the requirements doc to reflect that the canvas is responsive, not fixed at 800×800.

## Quality Requirements

- TypeScript strict-mode compilation passes.
- All existing tests pass.
- No changes to the rendering or game logic code.
- Click and hover coordinates remain correct.
