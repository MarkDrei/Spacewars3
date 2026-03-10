/**
 * Viewport State
 *
 * Manages the mapping between canvas pixels and world units.
 *
 * The viewport scale is chosen so that the visible world area (in world units²)
 * remains constant regardless of canvas size or aspect ratio.
 *
 * Formula: scale = sqrt(canvasWidth * canvasHeight / TARGET_WORLD_AREA)
 *
 * Examples with TARGET_WORLD_AREA = 2_000_000:
 *   500×1000 canvas  →  scale ≈ 0.5  →  1000×2000 world units visible
 *   1000×2000 canvas →  scale ≈ 1.0  →  1000×2000 world units visible
 *   1000×500  canvas →  scale ≈ 0.5  →  2000×1000 world units visible
 *   800×800   canvas →  scale ≈ 0.57 →  ~1414×1414 world units visible
 */

/** Amount of world (in world units²) always shown, regardless of canvas shape. */
export const TARGET_WORLD_AREA = 2_000_000;

class ViewportState {
    private _scale = 1.0;
    private _canvasWidth = 800;
    private _canvasHeight = 800;

    get scale(): number { return this._scale; }
    get canvasWidth(): number { return this._canvasWidth; }
    get canvasHeight(): number { return this._canvasHeight; }

    /** Width of the visible world in world units */
    get visibleWorldWidth(): number { return this._canvasWidth / this._scale; }
    /** Height of the visible world in world units */
    get visibleWorldHeight(): number { return this._canvasHeight / this._scale; }

    /**
     * Recompute the scale from the current canvas dimensions.
     * Must be called whenever the canvas is resized.
     */
    updateFromCanvas(canvas: HTMLCanvasElement): void {
        this._canvasWidth = canvas.width;
        this._canvasHeight = canvas.height;
        this._scale = Math.sqrt((canvas.width * canvas.height) / TARGET_WORLD_AREA);
    }

    // ── Coordinate conversion helpers ───────────────────────────────────────

    /** Convert a world-space offset to a screen-space offset (pixels). */
    worldToScreenOffset(worldDelta: number): number {
        return worldDelta * this._scale;
    }

    /** Convert a screen-space offset (pixels) to a world-space offset. */
    screenToWorldOffset(screenDelta: number): number {
        return screenDelta / this._scale;
    }
}

export const viewportState = new ViewportState();
