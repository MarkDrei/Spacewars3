/**
 * Tests for physics time multiplier integration
 * Verifies that the optional timeMultiplier parameter correctly accelerates object movement
 */

import { describe, expect, it } from 'vitest';
import {
  updateObjectPosition,
  updateAllObjectPositions,
  updateObjectPositionWithTimeCorrection,
  updateAllObjectPositionsWithTimeCorrection,
  PhysicsObject,
  WorldBounds
} from '@shared/physics';

const DEFAULT_WORLD_BOUNDS: WorldBounds = { width: 500, height: 500 };

describe('Physics Time Multiplier', () => {
  describe('updateObjectPosition', () => {
    it('updateObjectPosition_withMultiplier10_movesObjectTenTimesAsFar', () => {
      // Arrange: Object moving right at speed 600 units/minute
      const obj: PhysicsObject = {
        x: 100,
        y: 250,
        speed: 600,
        angle: 0, // Right
        last_position_update_ms: 1000
      };
      
      // Act: Update with 1 second elapsed, 10x multiplier
      const currentTime = 2000; // 1000ms elapsed
      const result = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 10);
      
      // Assert: With 10x multiplier, should move 10x farther
      // Normal: speed * elapsed / 60000 * factor = 600 * 1000 / 60000 * 50 = 500
      // With 10x: 600 * (1000 * 10) / 60000 * 50 = 5000
      // Start at x=100, move 5000 units, wrap around 500 width multiple times
      // 100 + 5000 = 5100 → 5100 % 500 = 100 (10 full loops)
      expect(result.x).toBeCloseTo(100, 1);
      expect(result.y).toBeCloseTo(250, 1); // No Y movement
    });

    it('updateObjectPosition_withMultiplier1_behavesUnchanged', () => {
      // Arrange: Object moving right at speed 600 units/minute
      const obj: PhysicsObject = {
        x: 100,
        y: 250,
        speed: 600,
        angle: 0, // Right
        last_position_update_ms: 1000
      };
      
      // Act: Update with 1 second elapsed, default multiplier (1)
      const currentTime = 2000;
      const resultWithMultiplier1 = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 1);
      const resultDefault = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50); // No multiplier arg
      
      // Assert: Both should produce identical results
      expect(resultWithMultiplier1.x).toBeCloseTo(resultDefault.x, 5);
      expect(resultWithMultiplier1.y).toBeCloseTo(resultDefault.y, 5);
      
      // Verify expected movement: 600 * 1000 / 60000 * 50 = 500 units right
      // 100 + 500 = 600 → 600 % 500 = 100 (one full loop)
      expect(resultDefault.x).toBeCloseTo(100, 1);
      expect(resultDefault.y).toBeCloseTo(250, 1);
    });

    it('updateObjectPosition_withMultiplier5_movesCorrectly', () => {
      // Arrange: Object moving up at speed 300 units/minute
      const obj: PhysicsObject = {
        x: 250,
        y: 100,
        speed: 300,
        angle: 90, // Up
        last_position_update_ms: 1000
      };
      
      // Act: Update with 2 seconds elapsed, 5x multiplier
      const currentTime = 3000; // 2000ms elapsed
      const result = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 5);
      
      // Assert: Movement should be 5x accelerated
      // Normal: 300 * 2000 / 60000 * 50 = 500 units up
      // With 5x: 300 * (2000 * 5) / 60000 * 50 = 2500 units up
      // Start at y=100, move up 2500, wrap around
      // y-axis up is positive sin(90°) = 1
      // 100 + 2500 = 2600 → 2600 % 500 = 100 (5 full loops)
      expect(result.x).toBeCloseTo(250, 1); // No X movement
      expect(result.y).toBeCloseTo(100, 1);
    });

    it('updateObjectPosition_withMultiplier100_handlesExtremeValues', () => {
      // Arrange: Object moving diagonally
      const obj: PhysicsObject = {
        x: 0,
        y: 0,
        speed: 600,
        angle: 45, // Northeast
        last_position_update_ms: 1000
      };
      
      // Act: Update with extreme 100x multiplier
      const currentTime = 1500; // 500ms elapsed
      const result = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 100);
      
      // Assert: Should still produce valid wrapped positions
      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.x).toBeLessThan(500);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeLessThan(500);
    });

    it('updateObjectPosition_withZeroElapsed_doesNotMove', () => {
      // Arrange: Object at position
      const obj: PhysicsObject = {
        x: 200,
        y: 300,
        speed: 600,
        angle: 0,
        last_position_update_ms: 1000
      };
      
      // Act: Update with same time (zero elapsed), 10x multiplier
      const currentTime = 1000;
      const result = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 10);
      
      // Assert: Position should not change regardless of multiplier
      expect(result.x).toBeCloseTo(200, 5);
      expect(result.y).toBeCloseTo(300, 5);
    });
  });

  describe('updateAllObjectPositions', () => {
    it('updateAllObjectPositions_withMultiplier10_updatesAllObjects', () => {
      // Arrange: Multiple objects
      const objects: PhysicsObject[] = [
        { x: 100, y: 100, speed: 600, angle: 0, last_position_update_ms: 1000 },
        { x: 200, y: 200, speed: 300, angle: 90, last_position_update_ms: 1000 },
        { x: 300, y: 300, speed: 900, angle: 180, last_position_update_ms: 1000 }
      ];
      
      // Act: Update all with 10x multiplier
      const currentTime = 2000; // 1000ms elapsed
      const results = updateAllObjectPositions(objects, currentTime, DEFAULT_WORLD_BOUNDS, 50, 10);
      
      // Assert: All objects should be updated with accelerated movement
      expect(results).toHaveLength(3);
      results.forEach((obj) => {
        expect(obj.last_position_update_ms).toBe(currentTime);
        expect(obj.x).toBeGreaterThanOrEqual(0);
        expect(obj.x).toBeLessThan(500);
        expect(obj.y).toBeGreaterThanOrEqual(0);
        expect(obj.y).toBeLessThan(500);
      });
    });

    it('updateAllObjectPositions_withDefaultMultiplier_behavesNormally', () => {
      // Arrange: Single object
      const objects: PhysicsObject[] = [
        { x: 100, y: 100, speed: 600, angle: 0, last_position_update_ms: 1000 }
      ];
      
      // Act: Update without multiplier argument (default 1)
      const currentTime = 2000;
      const resultsNoArg = updateAllObjectPositions(objects, currentTime, DEFAULT_WORLD_BOUNDS, 50);
      const resultsWithOne = updateAllObjectPositions(objects, currentTime, DEFAULT_WORLD_BOUNDS, 50, 1);
      
      // Assert: Should produce identical results
      expect(resultsNoArg[0].x).toBeCloseTo(resultsWithOne[0].x, 5);
      expect(resultsNoArg[0].y).toBeCloseTo(resultsWithOne[0].y, 5);
    });

    it('updateAllObjectPositions_withMultiplier1_maintainsBackwardCompatibility', () => {
      // Arrange: Object moving right
      const objects: PhysicsObject[] = [
        { x: 100, y: 250, speed: 600, angle: 0, last_position_update_ms: 1000 }
      ];
      
      // Act: Update with explicit multiplier=1
      const currentTime = 2000;
      const result = updateAllObjectPositions(objects, currentTime, DEFAULT_WORLD_BOUNDS, 50, 1);
      
      // Assert: Movement should be normal (500 units right, wraps to x=100)
      expect(result[0].x).toBeCloseTo(100, 1);
      expect(result[0].y).toBeCloseTo(250, 1);
    });
  });

  describe('updateObjectPositionWithTimeCorrection', () => {
    it('updateObjectPositionWithTimeCorrection_withMultiplier10_acceleratesMovement', () => {
      // Arrange: Object moving right
      const obj: PhysicsObject = {
        x: 100,
        y: 250,
        speed: 600,
        angle: 0,
        last_position_update_ms: 1000
      };
      
      // Act: Time correction scenario with 10x multiplier
      const clientCurrentTime = 3000;
      const responseReceivedAt = 2000;
      const roundTripTime = 200; // 100ms network delay estimate
      const result = updateObjectPositionWithTimeCorrection(
        obj,
        clientCurrentTime,
        responseReceivedAt,
        roundTripTime,
        DEFAULT_WORLD_BOUNDS,
        50,
        10
      );
      
      // Assert: correctedElapsedMs = (3000 - 2000) + (200 / 2) = 1100ms
      // With 10x multiplier: 1100 * 10 = 11000ms effective
      // Movement: 600 * 11000 / 60000 * 50 = 5500 units right
      // 100 + 5500 = 5600 → 5600 % 500 = 100 (11 full loops)
      expect(result.x).toBeCloseTo(100, 1);
      expect(result.y).toBeCloseTo(250, 1);
    });

    it('updateObjectPositionWithTimeCorrection_withMultiplier1_behavesNormally', () => {
      // Arrange: Object moving right
      const obj: PhysicsObject = {
        x: 100,
        y: 250,
        speed: 600,
        angle: 0,
        last_position_update_ms: 1000
      };
      
      // Act: Time correction with default multiplier
      const clientCurrentTime = 3000;
      const responseReceivedAt = 2000;
      const roundTripTime = 200;
      const resultDefault = updateObjectPositionWithTimeCorrection(
        obj,
        clientCurrentTime,
        responseReceivedAt,
        roundTripTime,
        DEFAULT_WORLD_BOUNDS,
        50
      );
      const resultWith1 = updateObjectPositionWithTimeCorrection(
        obj,
        clientCurrentTime,
        responseReceivedAt,
        roundTripTime,
        DEFAULT_WORLD_BOUNDS,
        50,
        1
      );
      
      // Assert: Should produce identical results
      expect(resultDefault.x).toBeCloseTo(resultWith1.x, 5);
      expect(resultDefault.y).toBeCloseTo(resultWith1.y, 5);
      
      // Verify movement: 600 * 1100 / 60000 * 50 = 550 units right
      // 100 + 550 = 650 → 650 % 500 = 150
      expect(resultDefault.x).toBeCloseTo(150, 1);
    });

    it('updateObjectPositionWithTimeCorrection_withMultiplier5_appliesCorrectly', () => {
      // Arrange: Object moving up
      const obj: PhysicsObject = {
        x: 250,
        y: 100,
        speed: 300,
        angle: 90,
        last_position_update_ms: 1000
      };
      
      // Act: Update with 5x multiplier
      const result = updateObjectPositionWithTimeCorrection(
        obj,
        2500,
        2000,
        100,
        DEFAULT_WORLD_BOUNDS,
        50,
        5
      );
      
      // Assert: correctedElapsedMs = (2500 - 2000) + (100 / 2) = 550ms
      // With 5x: 550 * 5 = 2750ms effective
      // Movement: 300 * 2750 / 60000 * 50 = 687.5 units up
      // 100 + 687.5 = 787.5 → 787.5 % 500 = 287.5
      expect(result.x).toBeCloseTo(250, 1);
      expect(result.y).toBeCloseTo(287.5, 1);
    });
  });

  describe('updateAllObjectPositionsWithTimeCorrection', () => {
    it('updateAllObjectPositionsWithTimeCorrection_withMultiplier10_updatesAllObjects', () => {
      // Arrange: Multiple objects
      const objects: PhysicsObject[] = [
        { x: 100, y: 100, speed: 600, angle: 0, last_position_update_ms: 1000 },
        { x: 200, y: 200, speed: 300, angle: 90, last_position_update_ms: 1000 }
      ];
      
      // Act: Update all with time correction and 10x multiplier
      const results = updateAllObjectPositionsWithTimeCorrection(
        objects,
        3000,
        2000,
        200,
        DEFAULT_WORLD_BOUNDS,
        50,
        10
      );
      
      // Assert: All objects should be updated with accelerated movement
      expect(results).toHaveLength(2);
      results.forEach((obj) => {
        expect(obj.x).toBeGreaterThanOrEqual(0);
        expect(obj.x).toBeLessThan(500);
        expect(obj.y).toBeGreaterThanOrEqual(0);
        expect(obj.y).toBeLessThan(500);
        // Timestamp should be corrected: 2000 + (3000-2000) + (200/2) = 3100
        expect(obj.last_position_update_ms).toBe(3100);
      });
    });

    it('updateAllObjectPositionsWithTimeCorrection_withDefaultMultiplier_behavesNormally', () => {
      // Arrange: Single object
      const objects: PhysicsObject[] = [
        { x: 100, y: 250, speed: 600, angle: 0, last_position_update_ms: 1000 }
      ];
      
      // Act: Update without multiplier (default 1)
      const resultsDefault = updateAllObjectPositionsWithTimeCorrection(
        objects,
        3000,
        2000,
        200,
        DEFAULT_WORLD_BOUNDS,
        50
      );
      const resultsWith1 = updateAllObjectPositionsWithTimeCorrection(
        objects,
        3000,
        2000,
        200,
        DEFAULT_WORLD_BOUNDS,
        50,
        1
      );
      
      // Assert: Should produce identical results
      expect(resultsDefault[0].x).toBeCloseTo(resultsWith1[0].x, 5);
      expect(resultsDefault[0].y).toBeCloseTo(resultsWith1[0].y, 5);
    });
  });

  describe('Edge Cases', () => {
    it('multiplier_withFractionalValue_worksCorrectly', () => {
      // Arrange: Fractional multiplier (slowing down time, though not typical use case)
      const obj: PhysicsObject = {
        x: 100,
        y: 250,
        speed: 600,
        angle: 0,
        last_position_update_ms: 1000
      };
      
      // Act: Update with 0.5x multiplier (half speed)
      const currentTime = 2000;
      const result = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 0.5);
      
      // Assert: Movement should be half normal
      // Normal: 600 * 1000 / 60000 * 50 = 500 units
      // With 0.5x: 600 * (1000 * 0.5) / 60000 * 50 = 250 units
      // 100 + 250 = 350
      expect(result.x).toBeCloseTo(350, 1);
      expect(result.y).toBeCloseTo(250, 1);
    });

    it('multiplier_withVerySmallElapsed_handlesCorrectly', () => {
      // Arrange: Very small elapsed time
      const obj: PhysicsObject = {
        x: 100,
        y: 100,
        speed: 600,
        angle: 0,
        last_position_update_ms: 1000
      };
      
      // Act: Update with just 1ms elapsed, 10x multiplier
      const currentTime = 1001;
      const result = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 10);
      
      // Assert: Should move slightly
      // 600 * (1 * 10) / 60000 * 50 = 5 units
      expect(result.x).toBeCloseTo(105, 1);
      expect(result.y).toBeCloseTo(100, 1);
    });

    it('multiplier_withZeroSpeed_doesNotMove', () => {
      // Arrange: Object with zero speed
      const obj: PhysicsObject = {
        x: 250,
        y: 250,
        speed: 0,
        angle: 0,
        last_position_update_ms: 1000
      };
      
      // Act: Update with 10x multiplier
      const currentTime = 2000;
      const result = updateObjectPosition(obj, currentTime, DEFAULT_WORLD_BOUNDS, 50, 10);
      
      // Assert: Should not move regardless of multiplier
      expect(result.x).toBeCloseTo(250, 5);
      expect(result.y).toBeCloseTo(250, 5);
    });
  });
});
