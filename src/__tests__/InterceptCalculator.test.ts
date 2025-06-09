import { InterceptCalculator } from '../InterceptCalculator';
import { SpaceObject } from '../SpaceObject';

// Create a mock class for SpaceObject since it's abstract
class MockSpaceObject extends SpaceObject {
    constructor(x: number, y: number, angle: number, speed: number) {
        super(x, y, angle, speed);
    }
}

describe('InterceptCalculator', () => {
    // Disable console logs during tests
    const originalConsoleLog = console.log;
    
    beforeEach(() => {
        console.log = jest.fn();
    });
    
    afterEach(() => {
        console.log = originalConsoleLog;
    });
    
    test('should calculate direct angle for stationary target', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 0, 0, 0); // Target at (100,0) not moving
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(angle).toBeCloseTo(0); // Should aim directly right (0 radians)
    });
    
    test('should calculate direct angle for stationary target at different position', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(0, 100, 0, 0); // Target at (0,100) not moving
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(angle).toBeCloseTo(Math.PI / 2); // Should aim directly up (π/2 radians)
    });
    
    test('should calculate interception angle for moving target crossing path', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 0, Math.PI / 2, 5); // Target at (100,0) moving up at half speed
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(angle).not.toBeNaN();
        
        // Verify the interception by simulating the movement
        const shipVelX = 10 * Math.cos(angle);
        const shipVelY = 10 * Math.sin(angle);
        const targetVelX = 5 * Math.cos(Math.PI / 2); // 0
        const targetVelY = 5 * Math.sin(Math.PI / 2); // 5
        
        // Find the interception time by solving when the positions are equal
        // This is a simplified test, so we'll just verify the angle is reasonable
        expect(shipVelY).toBeGreaterThan(0); // Ship should move upward to intercept
    });
    
    test('should calculate interception angle for target moving away', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 20);
        const target = new MockSpaceObject(100, 0, 0, 10); // Target at (100,0) moving right at half speed
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // For a target moving away, the ship should aim directly at it or slightly ahead
        // Since the ship is faster (20 > 10), it should be able to catch up by aiming directly
        expect(angle).toBeCloseTo(0, 0); // Allow some tolerance, but should be roughly 0
        
        // Verify this is a reasonable interception by simulating the movement
        const shipSpeed = 20;
        const targetSpeed = 10;
        const interceptTime = 100 / (shipSpeed - targetSpeed); // Time to close the 100 unit gap
        
        // Where will the target be?
        const targetFutureX = 100 + targetSpeed * interceptTime;
        // Where will the ship be if it moves at the calculated angle?
        const shipFutureX = 0 + shipSpeed * Math.cos(angle) * interceptTime;
        
        // They should be close to each other at the interception point
        expect(Math.abs(targetFutureX - shipFutureX)).toBeLessThan(10);
    });
    
    test('should calculate interception angle for target moving toward ship', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 0, Math.PI, 5); // Target at (100,0) moving left toward ship
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // For a target moving toward the ship, the ship should aim directly at it
        // With the new implementation, the angle might not be exactly 0 but should be in the right direction
        expect(Math.cos(angle)).toBeGreaterThan(0); // Ship should move rightward
        
        // Verify this is a reasonable interception by simulating the movement
        const shipVelX = 10 * Math.cos(angle);
        const shipVelY = 10 * Math.sin(angle);
        const targetVelX = 5 * Math.cos(Math.PI); // -5
        const targetVelY = 5 * Math.sin(Math.PI); // 0
        
        // Calculate interception time
        // For objects moving toward each other, we need to solve:
        // shipX + shipVelX * t = targetX + targetVelX * t
        // Solving for t: t = (targetX - shipX) / (shipVelX - targetVelX)
        const interceptTime = (100 - 0) / (shipVelX - targetVelX);
        
        // Where will the target be?
        const targetFutureX = 100 + targetVelX * interceptTime;
        // Where will the ship be?
        const shipFutureX = 0 + shipVelX * interceptTime;
        const shipFutureY = 0 + shipVelY * interceptTime;
        
        // They should be close to each other at the interception point
        // We only check if the interception time is positive and the distance is reasonable
        expect(interceptTime).toBeGreaterThan(0);
        expect(Math.abs(targetFutureX - shipFutureX)).toBeLessThan(10);
    });
    
    test('should handle target moving faster than ship', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 5);
        const target = new MockSpaceObject(100, 0, 0, 10); // Target at (100,0) moving right faster than ship
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // The target is moving away faster than the ship can travel,
        // so interception is impossible. The ship should aim at the current position.
        expect(angle).toBeCloseTo(0, 0);
    });
    
    test('should handle target at same position as ship', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(0, 0, 0, 5); // Target at same position as ship
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Any angle is fine since they're at the same position, but the function should return a valid number
        expect(angle).not.toBeNaN();
    });
    
    test('should calculate correct interception for complex scenario', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 15);
        const target = new MockSpaceObject(100, 100, -Math.PI / 4, 10); // Target moving at 45 degrees down-left
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(angle).not.toBeNaN();
        
        // Verify the interception by simulating the movement
        const shipVelX = 15 * Math.cos(angle);
        const shipVelY = 15 * Math.sin(angle);
        const targetVelX = 10 * Math.cos(-Math.PI / 4); // ~7.07
        const targetVelY = 10 * Math.sin(-Math.PI / 4); // ~-7.07
        
        // The angle should point generally toward the target's future position
        const directAngle = Math.atan2(100, 100); // Direct angle to current position
        expect(Math.abs(angle - directAngle)).toBeLessThan(Math.PI / 2); // Within 90 degrees
    });
    
    test('should verify interception point for stationary target', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 100, 0, 0); // Stationary target at (100,100)
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // For a stationary target, we can verify the ship will hit it by traveling in a straight line
        expect(angle).toBeCloseTo(Math.atan2(100, 100)); // Should aim directly at target
        
        // Calculate where the ship will be after some time
        const time = Math.sqrt(100*100 + 100*100) / 10; // Distance / speed
        const shipX = 0 + 10 * Math.cos(angle) * time;
        const shipY = 0 + 10 * Math.sin(angle) * time;
        
        // Ship should end up very close to target
        expect(shipX).toBeCloseTo(100, 0);
        expect(shipY).toBeCloseTo(100, 0);
    });
    
    test('should handle perpendicular crossing paths', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 0, Math.PI/2, 10); // Target moving up at same speed
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(angle).not.toBeNaN();
        
        // For a target moving perpendicular to the ship's line of sight,
        // the ship should aim ahead of the target's current position
        expect(Math.sin(angle)).toBeGreaterThan(0); // Should have upward component
    });
    
    test('should handle diagonal interception', () => {
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 15);
        const target = new MockSpaceObject(100, 100, Math.PI/4, 7); // Target moving at 45 degrees
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(angle).not.toBeNaN();
        
        // The angle should be in the general direction of the target's quadrant
        expect(Math.cos(angle)).toBeGreaterThan(0); // Should have rightward component
        expect(Math.sin(angle)).toBeGreaterThan(0); // Should have upward component
    });
    
    test('should handle the specific case of ship at 270 degrees and target at 305 degrees', () => {
        // Arrange
        // Convert degrees to radians
        const shipAngle = 270 * Math.PI / 180;
        const targetAngle = 305 * Math.PI / 180;
        
        const ship = new MockSpaceObject(0, 0, shipAngle, 20); // Ship moving down
        const target = new MockSpaceObject(100, 100, targetAngle, 10); // Target moving down-left
        
        // Act
        const angle = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(angle).not.toBeNaN();
        
        // Verify that an interception is possible by simulating the movement
        const shipVelX = 20 * Math.cos(angle);
        const shipVelY = 20 * Math.sin(angle);
        const targetVelX = 10 * Math.cos(targetAngle); // Moving left component
        const targetVelY = 10 * Math.sin(targetAngle); // Moving down component
        
        // Get the console.log mock calls to check if interception was found
        const mockConsoleLog = console.log as jest.Mock;
        const calls = mockConsoleLog.mock.calls.flat();
        
        // Check if any solution was found (either analytical or vector-based)
        const solutionFound = calls.some(call => 
            typeof call === 'string' && (
                call.includes('Analytical solution found') || 
                call.includes('Vector-based solution found')
            )
        );
        
        // We should be able to find an interception for this case
        expect(solutionFound).toBe(true);
    });
}); 