import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WORLD_WIDTH,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_BOUNDS,
} from '../../shared/src/worldConstants';
import type { WorldBounds } from '../../shared/src/physics';

describe('worldConstants', () => {
  describe('DEFAULT_WORLD_WIDTH', () => {
    it('DEFAULT_WORLD_WIDTH_isDefined_returnsNumber', () => {
      expect(DEFAULT_WORLD_WIDTH).toBeDefined();
      expect(typeof DEFAULT_WORLD_WIDTH).toBe('number');
    });

    it('DEFAULT_WORLD_WIDTH_value_isPositive', () => {
      expect(DEFAULT_WORLD_WIDTH).toBeGreaterThan(0);
    });

    it('DEFAULT_WORLD_WIDTH_value_is5000', () => {
      // Updated to 5000 as part of world size expansion (Goal 8)
      expect(DEFAULT_WORLD_WIDTH).toBe(5000);
    });
  });

  describe('DEFAULT_WORLD_HEIGHT', () => {
    it('DEFAULT_WORLD_HEIGHT_isDefined_returnsNumber', () => {
      expect(DEFAULT_WORLD_HEIGHT).toBeDefined();
      expect(typeof DEFAULT_WORLD_HEIGHT).toBe('number');
    });

    it('DEFAULT_WORLD_HEIGHT_value_isPositive', () => {
      expect(DEFAULT_WORLD_HEIGHT).toBeGreaterThan(0);
    });

    it('DEFAULT_WORLD_HEIGHT_value_is5000', () => {
      // Updated to 5000 as part of world size expansion (Goal 8)
      expect(DEFAULT_WORLD_HEIGHT).toBe(5000);
    });
  });

  describe('DEFAULT_WORLD_BOUNDS', () => {
    it('DEFAULT_WORLD_BOUNDS_isDefined_returnsWorldBounds', () => {
      expect(DEFAULT_WORLD_BOUNDS).toBeDefined();
      expect(DEFAULT_WORLD_BOUNDS).toHaveProperty('width');
      expect(DEFAULT_WORLD_BOUNDS).toHaveProperty('height');
    });

    it('DEFAULT_WORLD_BOUNDS_width_matchesDEFAULT_WORLD_WIDTH', () => {
      expect(DEFAULT_WORLD_BOUNDS.width).toBe(DEFAULT_WORLD_WIDTH);
    });

    it('DEFAULT_WORLD_BOUNDS_height_matchesDEFAULT_WORLD_HEIGHT', () => {
      expect(DEFAULT_WORLD_BOUNDS.height).toBe(DEFAULT_WORLD_HEIGHT);
    });

    it('DEFAULT_WORLD_BOUNDS_structure_conformsToWorldBoundsType', () => {
      // Type check - this will fail at compile time if type doesn't match
      const bounds: WorldBounds = DEFAULT_WORLD_BOUNDS;
      expect(bounds).toBeDefined();
      expect(typeof bounds.width).toBe('number');
      expect(typeof bounds.height).toBe('number');
    });

    it('DEFAULT_WORLD_BOUNDS_immutability_objectIsNotFrozen', () => {
      // Object is not frozen, but consumers should not mutate it
      expect(Object.isFrozen(DEFAULT_WORLD_BOUNDS)).toBe(false);
    });

    it('DEFAULT_WORLD_BOUNDS_values_matchExpected', () => {
      // Verify the complete structure
      expect(DEFAULT_WORLD_BOUNDS).toEqual({
        width: 5000,
        height: 5000,
      });
    });
  });

  describe('consistency', () => {
    it('worldConstants_widthAndHeight_areEqual', () => {
      // World is square (5000×5000)
      expect(DEFAULT_WORLD_WIDTH).toBe(DEFAULT_WORLD_HEIGHT);
    });

    it('worldConstants_boundsObject_usesIndividualConstants', () => {
      // Ensure DEFAULT_WORLD_BOUNDS is derived from individual constants
      expect(DEFAULT_WORLD_BOUNDS.width).toBe(DEFAULT_WORLD_WIDTH);
      expect(DEFAULT_WORLD_BOUNDS.height).toBe(DEFAULT_WORLD_HEIGHT);
    });
  });
});
