import { describe, expect, test } from 'vitest';
import { getTechCount, getValidTechKeys } from '@/lib/client/services/factoryService';
import type { TechCounts } from '@/lib/client/services/factoryService';

describe('factoryService - Type Safety Functions', () => {
  
  describe('getTechCount', () => {
    
    test('getTechCount_validKey_returnsCorrectValue', () => {
      // Arrange
      const techCounts: TechCounts = {
        pulse_laser: 5,
        auto_turret: 3,
        plasma_lance: 0,
        gauss_rifle: 2,
        photon_torpedo: 1,
        rocket_launcher: 0,
        ship_hull: 1,
        kinetic_armor: 2,
        energy_shield: 3,
        missile_jammer: 1
      };
      
      // Act & Assert
      expect(getTechCount(techCounts, 'pulse_laser')).toBe(5);
      expect(getTechCount(techCounts, 'auto_turret')).toBe(3);
      expect(getTechCount(techCounts, 'plasma_lance')).toBe(0);
      expect(getTechCount(techCounts, 'kinetic_armor')).toBe(2);
    });
    
    test('getTechCount_invalidKey_returnsZero', () => {
      // Arrange
      const techCounts: TechCounts = {
        pulse_laser: 5,
        auto_turret: 3,
        plasma_lance: 0,
        gauss_rifle: 2,
        photon_torpedo: 1,
        rocket_launcher: 0,
        ship_hull: 1,
        kinetic_armor: 2,
        energy_shield: 3,
        missile_jammer: 1
      };
      
      // Act & Assert
      expect(getTechCount(techCounts, 'invalid_weapon')).toBe(0);
      expect(getTechCount(techCounts, 'nonexistent_key')).toBe(0);
      expect(getTechCount(techCounts, '')).toBe(0);
    });
    
    test('getTechCount_nullTechCounts_returnsZero', () => {
      // Act & Assert
      expect(getTechCount(null, 'pulse_laser')).toBe(0);
      expect(getTechCount(null, 'invalid_key')).toBe(0);
      expect(getTechCount(null, '')).toBe(0);
    });
    
    test('getTechCount_undefinedTechCounts_returnsZero', () => {
      // Act & Assert
      expect(getTechCount(undefined as unknown as TechCounts, 'pulse_laser')).toBe(0);
    });
    
    test('getTechCount_keyExistsButNotNumber_returnsZero', () => {
      // Arrange - simulate corrupted data
      const corruptedTechCounts = {
        pulse_laser: 5,
        auto_turret: 'invalid' as unknown as number, // corrupted data
        plasma_lance: null as unknown as number,     // corrupted data
        gauss_rifle: 2,
        photon_torpedo: 1,
        rocket_launcher: 0,
        ship_hull: 1,
        kinetic_armor: 2,
        energy_shield: 3,
        missile_jammer: 1
      };
      
      // Act & Assert
      expect(getTechCount(corruptedTechCounts, 'pulse_laser')).toBe(5); // valid number
      expect(getTechCount(corruptedTechCounts, 'auto_turret')).toBe(0); // invalid type
      expect(getTechCount(corruptedTechCounts, 'plasma_lance')).toBe(0); // null value
    });
  });
  
  describe('getValidTechKeys', () => {
    
    test('getValidTechKeys_returnsAllTechCountKeys', () => {
      // Act
      const keys = getValidTechKeys();
      
      // Assert
      expect(keys).toEqual([
        'pulse_laser', 'auto_turret', 'plasma_lance', 'gauss_rifle', 'photon_torpedo', 'rocket_launcher',
        'ship_hull', 'kinetic_armor', 'energy_shield', 'missile_jammer'
      ]);
      expect(keys).toHaveLength(10);
    });
    
    test('getValidTechKeys_returnsArrayOfStrings', () => {
      // Act
      const keys = getValidTechKeys();
      
      // Assert
      expect(Array.isArray(keys)).toBe(true);
      keys.forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });
  
});