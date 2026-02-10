/**
 * World Size Constants
 * 
 * Centralized world dimensions used across client and server.
 * Starting with 500×500, will be increased to 5000×5000 after all refactoring is complete.
 */

import type { WorldBounds } from './physics';

/**
 * Default world width (horizontal dimension)
 */
export const DEFAULT_WORLD_WIDTH = 500;

/**
 * Default world height (vertical dimension)
 */
export const DEFAULT_WORLD_HEIGHT = 500;

/**
 * Default world bounds object
 * Can be used directly in physics calculations and world initialization
 */
export const DEFAULT_WORLD_BOUNDS: WorldBounds = {
  width: DEFAULT_WORLD_WIDTH,
  height: DEFAULT_WORLD_HEIGHT,
};
