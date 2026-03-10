/**
 * Reference side length (in world units) used to derive the constant visible-world area.
 *
 * The area-based scaling formula keeps the product
 *   (visible world width) × (visible world height) = BASE_VIEWPORT_WORLD_H²
 * constant at every zoom=1 canvas size, so larger canvases show the same world
 * region at higher pixel density, and non-square canvases adapt their aspect ratio
 * while preserving total world area.
 *
 * A value of 1000 means a 1000x1000 CSS-pixel canvas at zoom=1 maps 1:1
 * (one CSS pixel per world unit), and shows 1,000,000 world-unit^2 of the
 * 5000x5000 world.
 */
export const BASE_VIEWPORT_WORLD_H = 1000;

/** Default zoom level. Values > 1 show more world; values < 1 show less. */
export const DEFAULT_ZOOM = 1.0;

export const MIN_ZOOM = 0.25;  // see 4× more world height (zoom out limit)
export const MAX_ZOOM = 4.0;   // see 4× less world height (zoom in limit)
