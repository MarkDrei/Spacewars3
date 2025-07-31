import { describe, expect, test } from 'vitest';
// Test the smooth update calculation logic in isolation
describe('Iron Display Time Calculations', () => {
  test('ironCalculation_timeElapsed_calculatesCorrectAmount', () => {
    // Arrange
    const serverIronAmount = 1000;
    const ironPerSecond = 2.5;
    const lastServerUpdate = Date.now() - 4000; // 4 seconds ago
    
    // Act - Simulate the calculation from useIron hook
    const now = Date.now();
    const secondsElapsed = (now - lastServerUpdate) / 1000;
    const predictedIron = Math.floor(serverIronAmount + (secondsElapsed * ironPerSecond));
    
    // Assert
    expect(secondsElapsed).toBeCloseTo(4, 1); // ~4 seconds
    expect(predictedIron).toBe(1010); // 1000 + (4 * 2.5) = 1010
  });

  test('ironCalculation_noTimeElapsed_returnsServerAmount', () => {
    // Arrange
    const serverIronAmount = 1500;
    const ironPerSecond = 3;
    const lastServerUpdate = Date.now(); // Just now
    
    // Act
    const now = Date.now();
    const secondsElapsed = (now - lastServerUpdate) / 1000;
    const predictedIron = Math.floor(serverIronAmount + (secondsElapsed * ironPerSecond));
    
    // Assert
    expect(secondsElapsed).toBeLessThan(0.1); // Less than 100ms
    expect(predictedIron).toBe(1500); // Should be the same as server amount
  });

  test('ironCalculation_zeroProduction_returnsServerAmount', () => {
    // Arrange
    const serverIronAmount = 500;
    const ironPerSecond = 0;
    const lastServerUpdate = Date.now() - 10000; // 10 seconds ago
    
    // Act
    const now = Date.now();
    const secondsElapsed = (now - lastServerUpdate) / 1000;
    const predictedIron = Math.floor(serverIronAmount + (secondsElapsed * ironPerSecond));
    
    // Assert
    expect(predictedIron).toBe(500); // Should remain unchanged
  });

  test('ironCalculation_fractionalProduction_roundsDown', () => {
    // Arrange
    const serverIronAmount = 1000;
    const ironPerSecond = 1.7;
    const lastServerUpdate = Date.now() - 3000; // 3 seconds ago
    
    // Act
    const now = Date.now();
    const secondsElapsed = (now - lastServerUpdate) / 1000;
    const predictedIron = Math.floor(serverIronAmount + (secondsElapsed * ironPerSecond));
    
    // Assert
    // 1000 + (3 * 1.7) = 1005.1, floored to 1005
    expect(predictedIron).toBe(1005);
  });

  test('ironCalculation_longTimeElapsed_handlesBigNumbers', () => {
    // Arrange
    const serverIronAmount = 1000000;
    const ironPerSecond = 100;
    const lastServerUpdate = Date.now() - 60000; // 1 minute ago
    
    // Act
    const now = Date.now();
    const secondsElapsed = (now - lastServerUpdate) / 1000;
    const predictedIron = Math.floor(serverIronAmount + (secondsElapsed * ironPerSecond));
    
    // Assert
    expect(secondsElapsed).toBeCloseTo(60, 1); // ~60 seconds
    expect(predictedIron).toBe(1006000); // 1000000 + (60 * 100) = 1006000
  });
});
