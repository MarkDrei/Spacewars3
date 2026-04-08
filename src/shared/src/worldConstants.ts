/**
 * World Size Constants
 * 
 * Centralized world dimensions used across client and server.
 * The size can be overridden via the WORLD_SIZE environment variable
 * (integer, applied to both width and height). Defaults to 5000.
 */

import type { WorldBounds } from './physics';

const _envSize = typeof process !== 'undefined' && process.env.WORLD_SIZE
  ? parseInt(process.env.WORLD_SIZE, 10)
  : NaN;

const _size = Number.isInteger(_envSize) && _envSize > 0 ? _envSize : 5000;

/**
 * Default world width (horizontal dimension)
 */
export const DEFAULT_WORLD_WIDTH = _size;

/**
 * Default world height (vertical dimension)
 */
export const DEFAULT_WORLD_HEIGHT = _size;

/**
 * Default world bounds object
 * Can be used directly in physics calculations and world initialization
 */
export const DEFAULT_WORLD_BOUNDS: WorldBounds = {
  width: DEFAULT_WORLD_WIDTH,
  height: DEFAULT_WORLD_HEIGHT,
};
