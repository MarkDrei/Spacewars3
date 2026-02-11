/**
 * World Size Constants
 * 
 * Centralized world dimensions used across client and server.
 * Updated to 5000×5000 as part of world size expansion.
 */

import type { WorldBounds } from './physics';

/**
 * Default world width (horizontal dimension)
 */
export const DEFAULT_WORLD_WIDTH = 5000;

/**
 * Default world height (vertical dimension)
 */
export const DEFAULT_WORLD_HEIGHT = 5000;

/**
 * Default world bounds object
 * Can be used directly in physics calculations and world initialization
 */
export const DEFAULT_WORLD_BOUNDS: WorldBounds = {
  width: DEFAULT_WORLD_WIDTH,
  height: DEFAULT_WORLD_HEIGHT,
};
