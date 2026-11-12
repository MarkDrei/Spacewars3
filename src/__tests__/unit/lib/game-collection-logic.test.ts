import { describe, expect, test } from 'vitest';
import { calculateToroidalDistance } from '@shared/physics';

// Test the Game class collection logic in isolation
describe('Game Collection Logic', () => {
  
  // Mock the collection decision logic that's used in Game.ts
  const makeCollectionDecision = (
    ship: { x: number; y: number },
    targetObject: { x: number; y: number; type: string; id: number },
    worldBounds: { width: number; height: number }
  ): 'collect' | 'intercept' | 'none' => {
    const distance = calculateToroidalDistance(ship, targetObject, worldBounds);
    
    if (distance <= 125 && targetObject.type !== 'player_ship') {
      return 'collect';
    } else if (targetObject.type !== 'player_ship') {
      return 'intercept';
    } else {
      return 'intercept'; // Ships can be intercepted but not collected
    }
  };

  const WORLD_BOUNDS = { width: 1000, height: 1000 };

  describe('Collection Decision Logic', () => {
    test('collectionDecision_closeAsteroid_returnsCollect', () => {
      // Arrange
      const ship = { x: 100, y: 100 };
      const asteroid = { x: 150, y: 150, type: 'asteroid', id: 1 };

      // Act
      const decision = makeCollectionDecision(ship, asteroid, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('collect');
    });

    test('collectionDecision_closeShipwreck_returnsCollect', () => {
      // Arrange
      const ship = { x: 200, y: 200 };
      const shipwreck = { x: 250, y: 200, type: 'shipwreck', id: 2 };

      // Act
      const decision = makeCollectionDecision(ship, shipwreck, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('collect');
    });

    test('collectionDecision_closeEscapePod_returnsCollect', () => {
      // Arrange
      const ship = { x: 300, y: 300 };
      const escapePod = { x: 320, y: 320, type: 'escape_pod', id: 3 };

      // Act
      const decision = makeCollectionDecision(ship, escapePod, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('collect');
    });

    test('collectionDecision_distantAsteroid_returnsIntercept', () => {
      // Arrange
      const ship = { x: 100, y: 100 };
      const asteroid = { x: 300, y: 300, type: 'asteroid', id: 4 }; // Distance > 125

      // Act
      const decision = makeCollectionDecision(ship, asteroid, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('intercept');
    });

    test('collectionDecision_closePlayerShip_returnsIntercept', () => {
      // Arrange
      const ship = { x: 400, y: 400 };
      const playerShip = { x: 420, y: 420, type: 'player_ship', id: 5 };

      // Act
      const decision = makeCollectionDecision(ship, playerShip, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('intercept');
    });

    test('collectionDecision_distantPlayerShip_returnsIntercept', () => {
      // Arrange
      const ship = { x: 100, y: 100 };
      const playerShip = { x: 500, y: 500, type: 'player_ship', id: 6 };

      // Act
      const decision = makeCollectionDecision(ship, playerShip, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('intercept');
    });

    test('collectionDecision_exactlyAtCollectionRange_returnsCollect', () => {
      // Arrange
      const ship = { x: 0, y: 0 };
      const asteroid = { x: 125, y: 0, type: 'asteroid', id: 7 }; // Exactly 125 units

      // Act
      const decision = makeCollectionDecision(ship, asteroid, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('collect');
    });

    test('collectionDecision_justBeyondCollectionRange_returnsIntercept', () => {
      // Arrange
      const ship = { x: 0, y: 0 };
      const asteroid = { x: 126, y: 0, type: 'asteroid', id: 8 }; // Just over 125 units

      // Act
      const decision = makeCollectionDecision(ship, asteroid, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('intercept');
    });

    test('collectionDecision_toroidalWrapping_closestDistanceUsed', () => {
      // Arrange - Object appears far but is actually close due to world wrapping
      const ship = { x: 50, y: 50 };
      const asteroid = { x: 950, y: 50, type: 'asteroid', id: 9 }; 
      // Direct distance: 900, but toroidal distance: 100

      // Act
      const decision = makeCollectionDecision(ship, asteroid, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('collect'); // Should be collectible due to wrapping
    });

    test('collectionDecision_diagonalDistance_calculatedCorrectly', () => {
      // Arrange
      const ship = { x: 100, y: 100 };
      const asteroid = { x: 190, y: 160, type: 'asteroid', id: 10 }; 
      // Distance = sqrt(90^2 + 60^2) = sqrt(8100 + 3600) = sqrt(11700) ≈ 108.2

      // Act
      const decision = makeCollectionDecision(ship, asteroid, WORLD_BOUNDS);

      // Assert
      expect(decision).toBe('collect'); // Should be collectible (< 125)
    });
  });

  describe('Distance Calculations', () => {
    test('distanceCalculation_samePosition_returnsZero', () => {
      // Arrange
      const pos1 = { x: 100, y: 100 };
      const pos2 = { x: 100, y: 100 };

      // Act
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);

      // Assert
      expect(distance).toBe(0);
    });

    test('distanceCalculation_horizontalDistance_returnsCorrectValue', () => {
      // Arrange
      const pos1 = { x: 100, y: 100 };
      const pos2 = { x: 200, y: 100 };

      // Act
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);

      // Assert
      expect(distance).toBe(100);
    });

    test('distanceCalculation_verticalDistance_returnsCorrectValue', () => {
      // Arrange
      const pos1 = { x: 100, y: 100 };
      const pos2 = { x: 100, y: 180 };

      // Act
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);

      // Assert
      expect(distance).toBe(80);
    });

    test('distanceCalculation_toroidalWrapping_usesShortestPath', () => {
      // Arrange - Test horizontal wrapping
      const pos1 = { x: 50, y: 100 };
      const pos2 = { x: 950, y: 100 };
      
      // Act
      const distance = calculateToroidalDistance(pos1, pos2, WORLD_BOUNDS);

      // Assert
      // Direct distance would be 900, but wrapped distance is 100
      expect(distance).toBe(100);
    });
  });
});
