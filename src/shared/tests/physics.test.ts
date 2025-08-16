// ---
// Tests for shared physics calculations
// ---
import { describe, it, expect } from 'vitest';
import {
  updateObjectPosition,
  updateAllObjectPositions,
  updateObjectPositionWithTimeCorrection,
  updateAllObjectPositionsWithTimeCorrection,
  calculateToroidalDistance,
  isColliding,
  PhysicsObject,
  WorldBounds
} from '@shared/physics';

describe('Physics Calculations', () => {
  const WORLD_BOUNDS: WorldBounds = { width: 500, height: 500 };
  
  describe('updateObjectPosition', () => {
    it('updateObjectPosition_noMovement_positionUnchanged', () => {
      const obj: PhysicsObject = {
        x: 100,
        y: 200,
        speed: 0,
        angle: 0,
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 2000, WORLD_BOUNDS, 50);
      
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });
    
    it('updateObjectPosition_movingRight_xIncreases', () => {
      const obj: PhysicsObject = {
        x: 100,
        y: 200,
        speed: 10, // 10 units per minute
        angle: 0, // moving right
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 2000, WORLD_BOUNDS, 50); // 1 second elapsed
      
      expect(result.x).toBeCloseTo(108.333, 3); // 100 + (10 * 1000ms / 60000 * 50)
      expect(result.y).toBe(200); // unchanged
    });
    
    it('updateObjectPosition_movingUp_yIncreases', () => {
      const obj: PhysicsObject = {
        x: 100,
        y: 200,
        speed: 20, // 20 units per minute
        angle: 90, // moving up
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 1500, WORLD_BOUNDS, 50); // 0.5 seconds elapsed
      
      expect(result.x).toBeCloseTo(100, 5); // should be unchanged
      expect(result.y).toBeCloseTo(208.333, 3); // 200 + (20 * 500ms / 60000 * 50)
    });
    
    it('updateObjectPosition_diagonalMovement_bothCoordinatesChange', () => {
      const obj: PhysicsObject = {
        x: 100,
        y: 200,
        speed: 10, // 10 units per minute
        angle: 45, // 45 degrees
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 2000, WORLD_BOUNDS, 50); // 1 second elapsed
      
      // Total movement: (10 * 1000ms / 60000 * 50) = 8.333...
      // At 45 degrees, speed is split equally between x and y
      const totalMovement = (10 * 1000 / 60000) * 50;
      const expectedMovementX = totalMovement * Math.cos(45 * Math.PI / 180);
      const expectedMovementY = totalMovement * Math.sin(45 * Math.PI / 180);
      expect(result.x).toBeCloseTo(100 + expectedMovementX, 2);
      expect(result.y).toBeCloseTo(200 + expectedMovementY, 2);
    });
    
    it('updateObjectPosition_crossesRightBoundary_wrapsToLeft', () => {
      const obj: PhysicsObject = {
        x: 490,
        y: 200,
        speed: 20, // 20 units per minute
        angle: 0, // moving right
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 2000, WORLD_BOUNDS, 50); // 1 second elapsed
      
      // Movement: (20 * 1000ms / 60000 * 50) = 16.667
      // 490 + 16.667 = 506.667, which wraps to 6.667 (506.667 % 500)
      expect(result.x).toBeCloseTo(6.667, 3);
      expect(result.y).toBe(200);
    });
    
    it('updateObjectPosition_crossesBottomBoundary_wrapsToTop', () => {
      const obj: PhysicsObject = {
        x: 200,
        y: 490,
        speed: 20, // 20 units per minute
        angle: 90, // moving up (positive y)
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 2000, WORLD_BOUNDS, 50); // 1 second elapsed
      
      // Movement: (20 * 1000ms / 60000 * 50) = 16.667
      // 490 + 16.667 = 506.667, which wraps to 6.667
      expect(result.x).toBeCloseTo(200, 5);
      expect(result.y).toBeCloseTo(6.667, 3);
    });
    
    it('updateObjectPosition_negativeCoordinates_wrapsCorrectly', () => {
      const obj: PhysicsObject = {
        x: 10,
        y: 10,
        speed: 20, // 20 units per minute
        angle: 180, // moving left (negative x)
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 2000, WORLD_BOUNDS, 50); // 1 second elapsed
      
      // Movement: (20 * 1000ms / 60000 * 50) * cos(180°) = 16.667 * (-1) = -16.667
      // 10 + (-16.667) = -6.667, which wraps to 493.333
      expect(result.x).toBeCloseTo(493.333, 3);
      expect(result.y).toBeCloseTo(10, 5);
    });
    
    it('updateObjectPosition_millisecondPrecision_accurateMovement', () => {
      const obj: PhysicsObject = {
        x: 100,
        y: 200,
        speed: 100, // 100 units per minute
        angle: 0,
        last_position_update_ms: 1000
      };
      
      const result = updateObjectPosition(obj, 1100, WORLD_BOUNDS, 50); // 100ms elapsed
      
      // Movement: (100 * 100ms / 60000 * 50) = 8.333...
      expect(result.x).toBeCloseTo(108.333, 3);
      expect(result.y).toBe(200);
    });
  });
  
  describe('updateAllObjectPositions', () => {
    it('updateAllObjectPositions_multipleObjects_allUpdated', () => {
      const objects: PhysicsObject[] = [
        { x: 100, y: 200, speed: 10, angle: 0, last_position_update_ms: 1000 },
        { x: 300, y: 400, speed: 20, angle: 90, last_position_update_ms: 1000 }
      ];
      
      const results = updateAllObjectPositions(objects, 2000, WORLD_BOUNDS, 50);
      
      expect(results).toHaveLength(2);
      expect(results[0].x).toBeCloseTo(108.333, 3);
      expect(results[0].y).toBe(200);
      expect(results[0].last_position_update_ms).toBe(2000);
      
      expect(results[1].x).toBeCloseTo(300, 5);
      expect(results[1].y).toBeCloseTo(416.667, 3); // 400 + (20 * 1000ms / 60000 * 50)
      expect(results[1].last_position_update_ms).toBe(2000);
    });
    
    it('updateAllObjectPositions_emptyArray_returnsEmpty', () => {
      const objects: PhysicsObject[] = [];
      
      const results = updateAllObjectPositions(objects, 2000, WORLD_BOUNDS, 50);
      
      expect(results).toHaveLength(0);
    });
    
    it('updateAllObjectPositions_preservesAdditionalProperties', () => {
      interface TestObject extends PhysicsObject {
        id: number;
        type: string;
      }
      
      const objects: TestObject[] = [
        { id: 1, type: 'ship', x: 100, y: 200, speed: 10, angle: 0, last_position_update_ms: 1000 }
      ];
      
      const results = updateAllObjectPositions(objects, 2000, WORLD_BOUNDS, 50);
      
      expect(results[0].id).toBe(1);
      expect(results[0].type).toBe('ship');
      expect(results[0].x).toBeCloseTo(108.333, 3);
    });
  });
  
  describe('calculateToroidalDistance', () => {
    it('calculateToroidalDistance_samePosition_returnsZero', () => {
      const pos1 = { x: 100, y: 200 };
      const pos2 = { x: 100, y: 200 };
      
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);
      
      expect(distance).toBe(0);
    });
    
    it('calculateToroidalDistance_horizontalDistance_returnsCorrectDistance', () => {
      const pos1 = { x: 100, y: 200 };
      const pos2 = { x: 150, y: 200 };
      
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);
      
      expect(distance).toBe(50);
    });
    
    it('calculateToroidalDistance_verticalDistance_returnsCorrectDistance', () => {
      const pos1 = { x: 100, y: 200 };
      const pos2 = { x: 100, y: 250 };
      
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);
      
      expect(distance).toBe(50);
    });
    
    it('calculateToroidalDistance_diagonalDistance_returnsCorrectDistance', () => {
      const pos1 = { x: 100, y: 200 };
      const pos2 = { x: 130, y: 240 };
      
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);
      
      // Pythagorean theorem: sqrt(30^2 + 40^2) = sqrt(900 + 1600) = sqrt(2500) = 50
      expect(distance).toBe(50);
    });
    
    it('calculateToroidalDistance_wrapsAroundHorizontally_usesShortestPath', () => {
      const pos1 = { x: 10, y: 200 };
      const pos2 = { x: 490, y: 200 };
      
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);
      
      // Direct distance would be 480, but wrapping distance is 20 (10 + 10)
      expect(distance).toBe(20);
    });
    
    it('calculateToroidalDistance_wrapsAroundVertically_usesShortestPath', () => {
      const pos1 = { x: 200, y: 10 };
      const pos2 = { x: 200, y: 490 };
      
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);
      
      // Direct distance would be 480, but wrapping distance is 20
      expect(distance).toBe(20);
    });
    
    it('calculateToroidalDistance_wrapsBothDirections_usesShortestPath', () => {
      const pos1 = { x: 10, y: 10 };
      const pos2 = { x: 490, y: 490 };
      
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);
      
      // Both coordinates wrap: dx = 20, dy = 20, distance = sqrt(400 + 400) = sqrt(800) ≈ 28.28
      expect(distance).toBeCloseTo(28.28, 2);
    });
  });
  
  describe('isColliding', () => {
    it('isColliding_objectsOverlap_returnsTrue', () => {
      const obj1 = { x: 100, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      const obj2 = { x: 105, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      
      const colliding = isColliding(obj1, obj2, WORLD_BOUNDS);
      
      // Distance is 5, combined radius is 20, so they should be colliding
      expect(colliding).toBe(true);
    });
    
    it('isColliding_objectsSeparate_returnsFalse', () => {
      const obj1 = { x: 100, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      const obj2 = { x: 150, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      
      const colliding = isColliding(obj1, obj2, WORLD_BOUNDS);
      
      // Distance is 50, combined radius is 20, so they should not be colliding
      expect(colliding).toBe(false);
    });
    
    it('isColliding_objectsTouching_returnsTrue', () => {
      const obj1 = { x: 100, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      const obj2 = { x: 120, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      
      const colliding = isColliding(obj1, obj2, WORLD_BOUNDS);
      
      // Distance is 20, combined radius is 20, so they should be touching (colliding)
      expect(colliding).toBe(true);
    });
    
    it('isColliding_noRadiusSpecified_usesDefault', () => {
      const obj1 = { x: 100, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000 };
      const obj2 = { x: 115, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000 };
      
      const colliding = isColliding(obj1, obj2, WORLD_BOUNDS);
      
      // Distance is 15, default combined radius is 20 (10 + 10), so they should be colliding
      expect(colliding).toBe(true);
    });
    
    it('isColliding_acrossToroidalBoundary_detectsCollision', () => {
      const obj1 = { x: 5, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      const obj2 = { x: 495, y: 200, speed: 0, angle: 0, last_position_update_ms: 1000, radius: 10 };
      
      const colliding = isColliding(obj1, obj2, WORLD_BOUNDS);
      
      // Toroidal distance is 10, combined radius is 20, so they should be colliding
      expect(colliding).toBe(true);
    });
  });

  describe('updateObjectPositionWithTimeCorrection', () => {
    it('updateObjectPositionWithTimeCorrection_withNetworkDelay_compensatesForLatency', () => {
      const obj: PhysicsObject = {
        x: 100,
        y: 200,
        speed: 60, // 60 units per minute = 1 unit per second
        angle: 0, // Moving right
        last_position_update_ms: 1000
      };

      const clientCurrentTime = 2100; // Client thinks 1.1 seconds have passed
      const responseReceivedAt = 2000; // Response received at 2 seconds client time
      const roundTripTime = 200; // 200ms round trip
      
      // Expected: Response represents server state at responseReceivedAt - roundTripTime/2 = 1900ms
      // Time elapsed since server timestamp should be: 2100 - 1900 = 200ms = 0.2 seconds
      // Distance traveled: 1 unit/second * 0.2 seconds = 0.2 units
      
      const newPosition = updateObjectPositionWithTimeCorrection(
        obj, 
        clientCurrentTime, 
        responseReceivedAt, 
        roundTripTime, 
        WORLD_BOUNDS
      );
      
      // With factor 50 applied: 0.2 * 50 = 10 units
      expect(newPosition.x).toBeCloseTo(110, 0);
      expect(newPosition.y).toBeCloseTo(200, 0);
    });

    it('updateObjectPositionWithTimeCorrection_zeroNetworkDelay_behavesLikeStandardFunction', () => {
      const obj: PhysicsObject = {
        x: 100,
        y: 200,
        speed: 60,
        angle: 90, // Moving up
        last_position_update_ms: 1000
      };

      const clientCurrentTime = 2000;
      const responseReceivedAt = 2000;
      const roundTripTime = 0;
      
      const correctedPosition = updateObjectPositionWithTimeCorrection(
        obj, 
        clientCurrentTime, 
        responseReceivedAt, 
        roundTripTime, 
        WORLD_BOUNDS
      );
      
      // With zero network delay and response received at current time,
      // corrected elapsed time = (2000 - 2000) + (0 / 2) = 0ms
      // So the object should not move
      expect(correctedPosition.x).toBeCloseTo(100, 0);
      expect(correctedPosition.y).toBeCloseTo(200, 0);
    });
  });

  describe('updateAllObjectPositionsWithTimeCorrection', () => {
    it('updateAllObjectPositionsWithTimeCorrection_multipleObjects_allUpdatedWithTimeCorrection', () => {
      const objects: PhysicsObject[] = [
        { x: 100, y: 200, speed: 60, angle: 0, last_position_update_ms: 1000 },
        { x: 300, y: 400, speed: 120, angle: 180, last_position_update_ms: 1000 }
      ];

      const clientCurrentTime = 1500;
      const responseReceivedAt = 1400;
      const roundTripTime = 100;
      
      const updatedObjects = updateAllObjectPositionsWithTimeCorrection(
        objects,
        clientCurrentTime,
        responseReceivedAt,
        roundTripTime,
        WORLD_BOUNDS
      );
      
      expect(updatedObjects).toHaveLength(2);
      expect(updatedObjects[0].x).toBeGreaterThan(100); // First object moved right
      expect(updatedObjects[1].x).toBeLessThan(300);    // Second object moved left
      
      // Timestamps should be updated to corrected time
      const networkDelayEstimate = roundTripTime / 2;
      const timeSinceResponse = clientCurrentTime - responseReceivedAt;
      const expectedTimestamp = responseReceivedAt + timeSinceResponse + networkDelayEstimate;
      expect(updatedObjects[0].last_position_update_ms).toBeCloseTo(expectedTimestamp, 0);
      expect(updatedObjects[1].last_position_update_ms).toBeCloseTo(expectedTimestamp, 0);
    });
  });
});
