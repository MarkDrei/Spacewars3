import { describe, it, expect } from 'vitest';
import type { SpaceObject } from '@/lib/server/world/world';

/**
 * Test suite for space object count summary logic
 * Tests the filtering logic for space object type counts
 */
describe('Space Object Count Summary Logic', () => {
  /**
   * Helper function to create a mock space object
   */
  function createSpaceObject(
    type: SpaceObject['type'],
    id: number = 1,
  ): SpaceObject {
    return {
      id,
      type,
      x: 100,
      y: 100,
      speed: 10,
      angle: 0,
      last_position_update_ms: Date.now(),
      picture_id: 1,
    };
  }

  /**
   * Helper function to calculate counts like in the admin page
   */
  function calculateCounts(spaceObjects: SpaceObject[]) {
    return {
      asteroids: spaceObjects.filter((obj) => obj.type === 'asteroid').length,
      shipwrecks: spaceObjects.filter((obj) => obj.type === 'shipwreck').length,
      escapePods: spaceObjects.filter((obj) => obj.type === 'escape_pod').length,
      playerShips: spaceObjects.filter((obj) => obj.type === 'player_ship').length,
    };
  }

  describe('Empty State', () => {
    it('calculateCounts_noObjects_returnsZeroForAllTypes', () => {
      // Arrange
      const spaceObjects: SpaceObject[] = [];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(0);
      expect(counts.shipwrecks).toBe(0);
      expect(counts.escapePods).toBe(0);
      expect(counts.playerShips).toBe(0);
    });
  });

  describe('Single Object Counts', () => {
    it('calculateCounts_singleAsteroid_countsOneAsteroid', () => {
      // Arrange
      const spaceObjects = [createSpaceObject('asteroid', 1)];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(1);
      expect(counts.shipwrecks).toBe(0);
      expect(counts.escapePods).toBe(0);
      expect(counts.playerShips).toBe(0);
    });

    it('calculateCounts_singleShipwreck_countsOneShipwreck', () => {
      // Arrange
      const spaceObjects = [createSpaceObject('shipwreck', 1)];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(0);
      expect(counts.shipwrecks).toBe(1);
      expect(counts.escapePods).toBe(0);
      expect(counts.playerShips).toBe(0);
    });

    it('calculateCounts_singleEscapePod_countsOneEscapePod', () => {
      // Arrange
      const spaceObjects = [createSpaceObject('escape_pod', 1)];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(0);
      expect(counts.shipwrecks).toBe(0);
      expect(counts.escapePods).toBe(1);
      expect(counts.playerShips).toBe(0);
    });

    it('calculateCounts_singlePlayerShip_countsOnePlayerShip', () => {
      // Arrange
      const spaceObjects = [createSpaceObject('player_ship', 1)];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(0);
      expect(counts.shipwrecks).toBe(0);
      expect(counts.escapePods).toBe(0);
      expect(counts.playerShips).toBe(1);
    });
  });

  describe('Multiple Object Counts', () => {
    it('calculateCounts_multipleAsteroids_countsCorrectly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('asteroid', 1),
        createSpaceObject('asteroid', 2),
        createSpaceObject('asteroid', 3),
        createSpaceObject('asteroid', 4),
        createSpaceObject('asteroid', 5),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(5);
    });

    it('calculateCounts_multipleShipwrecks_countsCorrectly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('shipwreck', 1),
        createSpaceObject('shipwreck', 2),
        createSpaceObject('shipwreck', 3),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.shipwrecks).toBe(3);
    });

    it('calculateCounts_multipleEscapePods_countsCorrectly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('escape_pod', 1),
        createSpaceObject('escape_pod', 2),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.escapePods).toBe(2);
    });

    it('calculateCounts_multiplePlayerShips_countsCorrectly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('player_ship', 1),
        createSpaceObject('player_ship', 2),
        createSpaceObject('player_ship', 3),
        createSpaceObject('player_ship', 4),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.playerShips).toBe(4);
    });
  });

  describe('Mixed Object Counts', () => {
    it('calculateCounts_mixedTypes_countsEachTypeIndependently', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('asteroid', 1),
        createSpaceObject('asteroid', 2),
        createSpaceObject('shipwreck', 3),
        createSpaceObject('shipwreck', 4),
        createSpaceObject('shipwreck', 5),
        createSpaceObject('escape_pod', 6),
        createSpaceObject('player_ship', 7),
        createSpaceObject('player_ship', 8),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(2);
      expect(counts.shipwrecks).toBe(3);
      expect(counts.escapePods).toBe(1);
      expect(counts.playerShips).toBe(2);
    });

    it('calculateCounts_allTypesPresent_countsEachCorrectly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('asteroid', 1),
        createSpaceObject('shipwreck', 2),
        createSpaceObject('escape_pod', 3),
        createSpaceObject('player_ship', 4),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert
      expect(counts.asteroids).toBe(1);
      expect(counts.shipwrecks).toBe(1);
      expect(counts.escapePods).toBe(1);
      expect(counts.playerShips).toBe(1);
    });

    it('calculateCounts_onlySpawnableTypes_playerShipCountIsZero', () => {
      // Arrange - Only spawnable types
      const spaceObjects = [
        createSpaceObject('asteroid', 1),
        createSpaceObject('shipwreck', 2),
        createSpaceObject('escape_pod', 3),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert - Verify spawnable types are counted
      expect(counts.asteroids).toBe(1);
      expect(counts.shipwrecks).toBe(1);
      expect(counts.escapePods).toBe(1);
      // And player ships are zero
      expect(counts.playerShips).toBe(0);
    });
  });

  describe('Large Datasets', () => {
    it('calculateCounts_largeNumberOfObjects_handlesEfficiently', () => {
      // Arrange - Create 100 objects of each type
      const spaceObjects: SpaceObject[] = [];
      for (let i = 0; i < 100; i++) {
        spaceObjects.push(createSpaceObject('asteroid', i));
      }
      for (let i = 100; i < 200; i++) {
        spaceObjects.push(createSpaceObject('shipwreck', i));
      }
      for (let i = 200; i < 300; i++) {
        spaceObjects.push(createSpaceObject('escape_pod', i));
      }
      for (let i = 300; i < 400; i++) {
        spaceObjects.push(createSpaceObject('player_ship', i));
      }

      // Act
      const startTime = performance.now();
      const counts = calculateCounts(spaceObjects);
      const endTime = performance.now();

      // Assert - Verify counts
      expect(counts.asteroids).toBe(100);
      expect(counts.shipwrecks).toBe(100);
      expect(counts.escapePods).toBe(100);
      expect(counts.playerShips).toBe(100);
      
      // Assert - Performance check (should be very fast, O(n) filtering)
      expect(endTime - startTime).toBeLessThan(50); // Less than 50ms for 400 objects
    });
  });

  describe('Edge Cases', () => {
    it('calculateCounts_duplicateIds_countsAllObjects', () => {
      // Arrange - Objects with same ID but different types
      const spaceObjects = [
        createSpaceObject('asteroid', 1),
        createSpaceObject('shipwreck', 1),
        createSpaceObject('escape_pod', 1),
      ];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert - Each object is counted regardless of ID
      expect(counts.asteroids).toBe(1);
      expect(counts.shipwrecks).toBe(1);
      expect(counts.escapePods).toBe(1);
    });

    it('calculateCounts_simulateSpawning_countsUpdate', () => {
      // Arrange - Initial state
      const initialSpaceObjects = [
        createSpaceObject('asteroid', 1),
      ];

      // Act - First calculation
      const initialCounts = calculateCounts(initialSpaceObjects);

      // Assert - Initial count
      expect(initialCounts.asteroids).toBe(1);

      // Act - Simulate spawning 5 more asteroids
      const updatedSpaceObjects = [
        ...initialSpaceObjects,
        createSpaceObject('asteroid', 2),
        createSpaceObject('asteroid', 3),
        createSpaceObject('asteroid', 4),
        createSpaceObject('asteroid', 5),
        createSpaceObject('asteroid', 6),
      ];

      const updatedCounts = calculateCounts(updatedSpaceObjects);

      // Assert - Updated count
      expect(updatedCounts.asteroids).toBe(6);
    });
  });

  describe('Filter Logic Validation', () => {
    it('filterLogic_asteroidType_matchesExactly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('asteroid', 1),
        createSpaceObject('shipwreck', 2),
      ];

      // Act - Test filter logic directly
      const asteroids = spaceObjects.filter((obj) => obj.type === 'asteroid');

      // Assert
      expect(asteroids.length).toBe(1);
      expect(asteroids[0].type).toBe('asteroid');
    });

    it('filterLogic_shipwreckType_matchesExactly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('shipwreck', 1),
        createSpaceObject('escape_pod', 2),
      ];

      // Act
      const shipwrecks = spaceObjects.filter((obj) => obj.type === 'shipwreck');

      // Assert
      expect(shipwrecks.length).toBe(1);
      expect(shipwrecks[0].type).toBe('shipwreck');
    });

    it('filterLogic_escapePodType_matchesExactly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('escape_pod', 1),
        createSpaceObject('player_ship', 2),
      ];

      // Act
      const escapePods = spaceObjects.filter((obj) => obj.type === 'escape_pod');

      // Assert
      expect(escapePods.length).toBe(1);
      expect(escapePods[0].type).toBe('escape_pod');
    });

    it('filterLogic_playerShipType_matchesExactly', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('player_ship', 1),
        createSpaceObject('asteroid', 2),
      ];

      // Act
      const playerShips = spaceObjects.filter((obj) => obj.type === 'player_ship');

      // Assert
      expect(playerShips.length).toBe(1);
      expect(playerShips[0].type).toBe('player_ship');
    });

    it('filterLogic_multipleFilters_worksIndependently', () => {
      // Arrange
      const spaceObjects = [
        createSpaceObject('asteroid', 1),
        createSpaceObject('asteroid', 2),
        createSpaceObject('shipwreck', 3),
        createSpaceObject('escape_pod', 4),
      ];

      // Act - Apply multiple filters
      const asteroids = spaceObjects.filter((obj) => obj.type === 'asteroid');
      const shipwrecks = spaceObjects.filter((obj) => obj.type === 'shipwreck');
      const escapePods = spaceObjects.filter((obj) => obj.type === 'escape_pod');

      // Assert - Each filter works independently
      expect(asteroids.length).toBe(2);
      expect(shipwrecks.length).toBe(1);
      expect(escapePods.length).toBe(1);
      // Original array unchanged
      expect(spaceObjects.length).toBe(4);
    });
  });

  describe('Type Safety', () => {
    it('typeCheck_onlyValidTypes_acceptedByFilter', () => {
      // Arrange
      const validTypes: Array<SpaceObject['type']> = [
        'asteroid',
        'shipwreck',
        'escape_pod',
        'player_ship',
      ];

      // Act & Assert - TypeScript should allow these types
      validTypes.forEach((type) => {
        const obj = createSpaceObject(type, 1);
        expect(['asteroid', 'shipwreck', 'escape_pod', 'player_ship']).toContain(obj.type);
      });
    });

    it('calculateCounts_returnsCorrectStructure', () => {
      // Arrange
      const spaceObjects = [createSpaceObject('asteroid', 1)];

      // Act
      const counts = calculateCounts(spaceObjects);

      // Assert - Verify return structure
      expect(counts).toHaveProperty('asteroids');
      expect(counts).toHaveProperty('shipwrecks');
      expect(counts).toHaveProperty('escapePods');
      expect(counts).toHaveProperty('playerShips');
      expect(typeof counts.asteroids).toBe('number');
      expect(typeof counts.shipwrecks).toBe('number');
      expect(typeof counts.escapePods).toBe('number');
      expect(typeof counts.playerShips).toBe('number');
    });
  });
});

