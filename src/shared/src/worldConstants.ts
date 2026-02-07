/**
 * Shared world size constants
 * Single source of truth for world dimensions used by both client and server
 */

import { WorldBounds } from './physics';

/**
 * Default world width in game units
 */
export const DEFAULT_WORLD_WIDTH = 500;

/**
 * Default world height in game units
 */
export const DEFAULT_WORLD_HEIGHT = 500;

/**
 * Default world bounds object
 */
export const DEFAULT_WORLD_BOUNDS: WorldBounds = {
  width: DEFAULT_WORLD_WIDTH,
  height: DEFAULT_WORLD_HEIGHT,
};
