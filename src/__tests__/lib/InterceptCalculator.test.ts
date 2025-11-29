import { describe, expect, vi, test, beforeEach, afterEach } from 'vitest';
import { InterceptCalculator } from '@/lib/client/game/InterceptCalculator';
import { SpaceObjectOld } from '@/lib/client/game/SpaceObject';
import { World } from '@/lib/client/game/World';
// You can now use either of these import styles:
// import { radiansToDegrees } from '@shared';  // Using the alias (now working!)
import { radiansToDegrees } from '../../shared/src/utils/angleUtils';  // Using relative path

// Create a mock class for SpaceObject since it's abstract
class MockSpaceObject extends SpaceObjectOld {
    constructor(x: number, y: number, angle: number, speed: number) {
        // Create server data object for the new constructor
        const serverData = {
            id: Math.floor(Math.random() * 1000000), // Random ID for testing
            type: 'asteroid' as const,
            x: x,
            y: y,
            speed: speed,
            angle: angle,
            last_position_update_ms: Date.now()
        };
        super(serverData);
    }
}

describe('InterceptCalculator', () => {
    // Disable console logs during tests
    const originalConsoleLog = console.log;
    
    beforeEach(() => {
        console.log = vi.fn();
    });
    
    afterEach(() => {
        console.log = originalConsoleLog;
    });
    
    test('should calculate direct angle for stationary target', () => {
        // ASCII Diagram:
        // Ship(0,0) ────────→ Target(100,0) ●
        //   S                      T
        //
        // Ship at origin, stationary target directly to the right
        // Expected: Ship should aim directly right (0 degrees)
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 0, 0, 0); // Target at (100,0) not moving
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(0); // Should aim directly right (0 degrees)
        expect(result.interceptPoint.x).toBeCloseTo(100);
        expect(result.interceptPoint.y).toBeCloseTo(0);
        expect(result.timeToIntercept).toBeCloseTo(10); // 100 units at speed 10
        
        // Verify global coordinates
        expect(result.globalCoordinates.shipX).toBeCloseTo(0);
        expect(result.globalCoordinates.shipY).toBeCloseTo(0);
        expect(result.globalCoordinates.targetX).toBeCloseTo(100);
        expect(result.globalCoordinates.targetY).toBeCloseTo(0);
        expect(result.globalCoordinates.interceptX).toBeCloseTo(100);
        expect(result.globalCoordinates.interceptY).toBeCloseTo(0);
    });
    
    test('should calculate direct angle for stationary target at different position', () => {
        // ASCII Diagram:
        //   Target(0,100) ●
        //         T
        //         ↑
        //         |
        //         |
        //   Ship(0,0) S
        //
        // Ship at origin, stationary target directly above
        // Expected: Ship should aim directly up (90 degrees)
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(0, 100, 0, 0); // Target at (0,100) not moving
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(90); // Should aim directly up (90 degrees)
        expect(result.interceptPoint.x).toBeCloseTo(0);
        expect(result.interceptPoint.y).toBeCloseTo(100);
        expect(result.timeToIntercept).toBeCloseTo(10); // 100 units at speed 10
        
        // Verify global coordinates
        expect(result.globalCoordinates.shipX).toBeCloseTo(0);
        expect(result.globalCoordinates.shipY).toBeCloseTo(0);
        expect(result.globalCoordinates.targetX).toBeCloseTo(0);
        expect(result.globalCoordinates.targetY).toBeCloseTo(100);
        expect(result.globalCoordinates.interceptX).toBeCloseTo(0);
        expect(result.globalCoordinates.interceptY).toBeCloseTo(100);
    });

    test('should verify interception point for stationary target', () => {
        // ASCII Diagram:
        //   Target(100,100) ●
        //         T        ↖
        //                   ↖
        //                    ↖
        //                     ↖
        //                      ↖
        //   Ship(0,0) ──────────↗
        //      S
        //
        // Ship at origin, stationary target at diagonal position
        // Ship should aim directly at target at 45° angle
        // Expected: Ship should aim at atan2(100,100) = 45 degrees
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 100, 0, 0); // Stationary target at (100,100)
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // For a stationary target, we can verify the ship will hit it by traveling in a straight line
        expect(result.angle).toBeCloseTo(radiansToDegrees(Math.atan2(100, 100)), 0); // Should aim directly at target (45 degrees)
        expect(result.interceptPoint.x).toBeCloseTo(100);
        expect(result.interceptPoint.y).toBeCloseTo(100);
        expect(result.timeToIntercept).toBeCloseTo(14.14); // 100 units at speed 10
    });
    
    test('should calculate interception angle for moving target crossing path', () => {
        // ASCII Diagram:
        //   Target(100,0) ↑ (moving up at 5 speed)
        //         T       |
        //                 |
        //   Ship(0,0) ────┘ (must aim diagonally to intercept)
        //      S
        //
        // Ship at origin, target to the right moving perpendicular upward
        // Ship must lead the target to intercept at future position
        // Expected: Ship should aim with upward component
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 0, 90, 5); // Target at (100,0) moving up at half speed
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(30); 
        expect(result.interceptPoint.x).toBeCloseTo(100);
        expect(result.interceptPoint.y).toBeCloseTo(57.74);
        expect(result.timeToIntercept).toBeCloseTo(11.55); 

    });
    
    test('should calculate interception angle for target moving away', () => {
        // ASCII Diagram:
        // Ship(0,0) ─────────→ Target(100,0) ────→ (moving right at 10 speed)
        //    S                     T
        //
        // Ship is faster (20) than target (10), both moving right
        // Ship should be able to catch up by aiming directly at target
        // Expected: Ship should aim directly right (0 degrees)
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 20);
        const target = new MockSpaceObject(100, 0, 0, 10); // Target at (100,0) moving right at half speed
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Since the ship is faster (20 > 10), it should be able to catch up by aiming directly
        expect(result.angle).toBeCloseTo(0); 
        expect(result.interceptPoint.x).toBeCloseTo(200);
        expect(result.interceptPoint.y).toBeCloseTo(0);
        expect(result.timeToIntercept).toBeCloseTo(10); // 100 units at speed difference of 10 (20 - 10)
        
    });
    
    test('should calculate interception angle for target moving toward ship', () => {
        // ASCII Diagram:
        // Ship(0,0) ──────────→ ←──── Target(100,0) (moving left at 5 speed)
        //    S                   T
        //
        // Ship and target moving toward each other
        // Ship should aim directly at target
        // Expected: Ship should move rightward (positive X component)
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 10);
        const target = new MockSpaceObject(100, 0, 180, 5); // Target at (100,0) moving left toward ship
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(0); 
        expect(result.interceptPoint.x).toBeCloseTo(66.67);
        expect(result.interceptPoint.y).toBeCloseTo(0);
        expect(result.timeToIntercept).toBeCloseTo(6.67);
    });
    
    test('should handle target moving faster than ship', () => {
        // ASCII Diagram:
        // Ship(0,0) ────→ Target(100,0) ════════→ (moving right faster at 10 speed)
        //    S  (5)          T     (10)
        //
        // Target is moving away faster than ship can pursue
        // Ship cannot catch up in normal pursuit
        // Expected: should aim directly at target using wrapping effect
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 5);
        const target = new MockSpaceObject(100, 0, 0, 10); // Target at (100,0) moving right faster than ship
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(180); 
        expect(result.interceptPoint.x).toBeCloseTo(366.666);
        expect(result.interceptPoint.y).toBeCloseTo(0);
        expect(result.timeToIntercept).toBeCloseTo(26.666);
    });
    
    test('should handle target at same position as ship', () => {
        // ASCII Diagram:
        // Ship & Target(0,0) ⊕ (both at same position)
        //       S/T
        //
        // Ship and target are at the exact same position
        // Any angle should work since they're already "intercepted"
        // Expected: Any valid angle (not NaN)
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 33, 10);
        const target = new MockSpaceObject(0, 0, 0, 5); // Target at same position as ship
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Any angle is fine since they're at the same position, but the function should return a valid number
        expect(result.angle).toBeCloseTo(33); // Special case direct interception: Should be unchanged
        expect(result.interceptPoint.x).toBeCloseTo(0);
        expect(result.interceptPoint.y).toBeCloseTo(0);
        expect(result.timeToIntercept).toBeCloseTo(0);
    });
    
    test('should calculate correct interception for complex scenario', () => {
        // ASCII Diagram:
        //         Target(100,100) ↙ (moving down-left at -45°)
        //              T        ↙
        //                    ↙
        //               ↙
        //          ↙
        //     ↙
        // Ship(0,0)
        //    S
        //
        // Ship at origin, target at (100,100) moving diagonally down-left
        // Ship must calculate complex interception path
        // Expected: Valid angle (not NaN)
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 15);
        const target = new MockSpaceObject(100, 100, 315, 10); // Target moving at 315 degrees (down-left)
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(3.19);
        expect(result.interceptPoint.x).toBeCloseTo(189.44);
        expect(result.interceptPoint.y).toBeCloseTo(10.56);
        expect(result.timeToIntercept).toBeCloseTo(12.65);
    });
    
    test('should handle diagonal interception', () => {
        // ASCII Diagram:
        //         Target(100,100) ↗ (moving 45° up-right)
        //              T         ↗
        //                     ↗
        //                  ↗
        //               ↗
        //            ↗
        //   Ship(0,0) ─────────────→ (faster, must calculate lead)
        //      S
        //
        // Ship faster than target, target moving diagonally
        // Ship must calculate proper lead angle for interception
        // Expected: Valid angle (not NaN)
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 15);
        const target = new MockSpaceObject(100, 100, 45, 7); // Target moving at 45 degrees
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(45);
        expect(result.interceptPoint.x).toBeCloseTo(187.5);
        expect(result.interceptPoint.y).toBeCloseTo(187.5);
        expect(result.timeToIntercept).toBeCloseTo(17.68);
    });
    
    test('should handle the specific case of ship at 270 degrees and target at 305 degrees', () => {
        // ASCII Diagram:
        //   Ship(0,0) 
        //      S
        // 
        //
        //             Target(100,100) ↙ (moving 305° down-left)
        //                  T         ↙
        //
        // target moving down-left
        // Complex angular interception calculation required
        
        // Arrange
        const ship = new MockSpaceObject(0, 0, 0, 20); // Ship moving right
        const target = new MockSpaceObject(100, 100, 305, 10); // Target moving down-left

        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        expect(result.angle).toBeCloseTo(15.5);
        expect(result.interceptPoint.x).toBeCloseTo(142.37);
        expect(result.interceptPoint.y).toBeCloseTo(39.49);
        expect(result.timeToIntercept).toBeCloseTo(7.39);
    });
    
    test('should handle interception across world boundaries', () => {
        // ASCII Diagram (Toroidal World):
        // Left edge                                Right edge
        // |                                              |
        // | Target(50,250) ──→                    Ship(950,250) |
        // |      T                                       S      |
        // |                                                     |
        // |←─────── Ship can wrap around world ─────────→|
        //
        // Ship near right edge, target near left edge
        // Faster to go left and wrap around than chase right
        // Expected: Ship should aim left (negative X direction)
        
        // Arrange
        // Position ship near right edge of world
        const ship = new MockSpaceObject(World.WIDTH - 50, 250, 0, 10);
        // Position target near left edge of world
        const target = new MockSpaceObject(50, 250, 0, 1); // Moving right
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move left (negative X) to intercept target faster by crossing the boundary
        expect(result.angle).toBeCloseTo(0);
        expect(result.interceptPoint.x).toBeCloseTo(61.11);
        expect(result.interceptPoint.y).toBeCloseTo(250);
        expect(result.timeToIntercept).toBeCloseTo(11.11);
        
        // Verify global coordinates - this is where global coords show the true shortest path
        expect(result.globalCoordinates.shipX).toBeCloseTo(World.WIDTH - 50); // Ship at (1950, 250)
        expect(result.globalCoordinates.shipY).toBeCloseTo(250);
        // Target should appear at +2000 X position when wrapping is considered for shortest path
        expect(result.globalCoordinates.targetX).toBeCloseTo(50 + World.WIDTH); // Target at (2050, 250) globally
        expect(result.globalCoordinates.targetY).toBeCloseTo(250);
        // Intercept point in global coordinates - verify it exists and is reasonable
        expect(result.globalCoordinates.interceptX).toBeDefined();
        expect(result.globalCoordinates.interceptY).toBeCloseTo(250);
    });

    test('should handle interception across top-bottom world boundary', () => {
        // ASCII Diagram (Toroidal World):
        // Top edge ────────────────────────────────────
        // |   Target(250,50) ↓ (moving down slowly)   |
        // |        T                                   |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |     Ship(250,450) S (near bottom edge)    |
        // Bottom edge ─────────────────────────────────
        // |←── Ship can wrap around world vertically ─→|
        //
        // Ship near bottom edge, target near top edge
        // Faster to go up and wrap around than chase down
        // Expected: Ship should aim up (negative Y direction)
        
        // Arrange
        const ship = new MockSpaceObject(250, World.HEIGHT - 50, 0, 10);
        const target = new MockSpaceObject(250, 50, 90, 3); // Moving down slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move up (negative Y) to intercept target faster by crossing the boundary
        expect(result.angle).toBeCloseTo(90);
        expect(result.interceptPoint.x).toBeCloseTo(250);
        expect(result.interceptPoint.y).toBeCloseTo(92.86);
        expect(result.timeToIntercept).toBeCloseTo(14.285);
        
        // Verify global coordinates for vertical world wrapping
        expect(result.globalCoordinates.shipX).toBeCloseTo(250);
        expect(result.globalCoordinates.shipY).toBeCloseTo(World.HEIGHT - 50); // Ship at (250, 1950)
        expect(result.globalCoordinates.targetX).toBeCloseTo(250);
        // Target should appear at +2000 Y position when wrapping is considered for shortest path
        expect(result.globalCoordinates.targetY).toBeCloseTo(50 + World.HEIGHT); // Target at (250, 2050) globally
        expect(result.globalCoordinates.interceptX).toBeCloseTo(250);
        // Intercept point in global coordinates - verify it exists and is reasonable
        expect(result.globalCoordinates.interceptY).toBeDefined();
    });

    test('should handle interception across left-right world boundary (ship at left)', () => {
        // ASCII Diagram (Toroidal World):
        // Left edge                                Right edge
        // |                                              |
        // | Ship(50,250) S    Target(450,250) ←── T     |
        // |                                              |
        // |                                              |
        // |──────── Ship can wrap around world ────────→|
        //
        // Ship near left edge, target near right edge moving left
        // Faster to go left and wrap around than chase right
        // Expected: Ship should aim left (180 degrees)
        
        // Arrange
        const ship = new MockSpaceObject(50, 250, 0, 10);
        const target = new MockSpaceObject(World.WIDTH - 50, 250, 180, 4); // Moving left slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move left to intercept target faster by crossing the boundary
        expect(result.angle).toBeCloseTo(180);
        expect(result.interceptPoint.x).toBeCloseTo(383.33);
        expect(result.interceptPoint.y).toBeCloseTo(250);
        expect(result.timeToIntercept).toBeCloseTo(16.666);
    });

    test('should handle interception across bottom-top world boundary', () => {
        // ASCII Diagram (Toroidal World):
        // Top edge ────────────────────────────────────
        // |     Ship(250,50) S (near top edge)        |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |   Target(250,450) ↑ (moving up slowly)    |
        // Bottom edge ─────────────────────────────────
        // |←── Ship can wrap around world vertically ─→|
        //
        // Ship near top edge, target near bottom edge moving up
        // Faster to go up and wrap around than chase down
        // Expected: Ship should aim up (270 degrees / -90 degrees)
        
        // Arrange
        const ship = new MockSpaceObject(250, 50, 0, 10);
        const target = new MockSpaceObject(250, World.HEIGHT - 50, 270, 3); // Moving up slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move up (negative Y) to intercept target faster by crossing the boundary
        expect(result.angle).toBeCloseTo(-90); // -90 degrees = 270 degrees
        expect(result.interceptPoint.x).toBeCloseTo(250);
        expect(result.interceptPoint.y).toBeCloseTo(407.14);
        expect(result.timeToIntercept).toBeCloseTo(14.29);
    });

    test('should handle interception across right-left world boundary (ship at right)', () => {
        // ASCII Diagram (Toroidal World):
        // Left edge                                Right edge
        // |                                              |
        // | Target(50,250) →── T      Ship(450,250) S   |
        // |                                              |
        // |                                              |
        // |←────── Ship can wrap around world ──────────|
        //
        // Ship near right edge, target near left edge moving right
        // Faster to go right and wrap around than chase left
        // Expected: Ship should aim right (0 degrees)
        
        // Arrange
        const ship = new MockSpaceObject(World.WIDTH - 50, 250, 0, 10);
        const target = new MockSpaceObject(50, 250, 0, 4); // Moving right slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move right to intercept target faster by crossing the boundary
        expect(result.angle).toBeCloseTo(0);
        expect(result.interceptPoint.x).toBeCloseTo(116.666);
        expect(result.interceptPoint.y).toBeCloseTo(250);
        expect(result.timeToIntercept).toBeCloseTo(16.666);
    });

    test('should handle corner-to-corner interception (top-left to bottom-right)', () => {
        // ASCII Diagram (Toroidal World):
        // Top edge ────────────────────────────────────
        // | Ship(50,50) S                             |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                              Target(450,450) ↖ |
        // |                                       T   |
        // Bottom edge ─────────────────────────────────
        // |←── Ship can wrap diagonally across world ──→|
        //
        // Ship in top-left corner, target in bottom-right corner moving up-left
        // Ship should wrap diagonally to intercept faster
        // Expected: Ship should aim diagonally
        
        // Arrange
        const ship = new MockSpaceObject(50, 50, 0, 12);
        const target = new MockSpaceObject(World.WIDTH - 50, World.HEIGHT - 50, 225, 3); // Moving up-left slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move diagonally to intercept target faster by crossing both boundaries
        expect(result.angle).toBeCloseTo(-135);
        expect(result.interceptPoint.x).toBeCloseTo(416.666);
        expect(result.interceptPoint.y).toBeCloseTo(416.666);
        expect(result.timeToIntercept).toBeCloseTo(15.71);
        
        // Verify global coordinates for diagonal world wrapping
        expect(result.globalCoordinates.shipX).toBeCloseTo(50);
        expect(result.globalCoordinates.shipY).toBeCloseTo(50);
        // Target should appear with negative coordinates when wrapping is considered for shortest diagonal path
        expect(result.globalCoordinates.targetX).toBeCloseTo((World.WIDTH - 50) - World.WIDTH); // Target at (-50, -50) globally
        expect(result.globalCoordinates.targetY).toBeCloseTo((World.HEIGHT - 50) - World.HEIGHT);
        // Intercept point in global coordinates - verify they exist and are reasonable
        expect(result.globalCoordinates.interceptX).toBeDefined();
        expect(result.globalCoordinates.interceptY).toBeDefined();
    });

    test('should handle corner-to-corner interception (top-right to bottom-left)', () => {
        // ASCII Diagram (Toroidal World):
        // Top edge ────────────────────────────────────
        // |                             Ship(450,50) S |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // | Target(50,450) ↗ T                        |
        // |                                           |
        // Bottom edge ─────────────────────────────────
        // |←── Ship can wrap diagonally across world ──→|
        //
        // Ship in top-right corner, target in bottom-left corner moving up-right
        // Ship should wrap diagonally to intercept faster
        // Expected: Ship should aim diagonally
        
        // Arrange
        const ship = new MockSpaceObject(World.WIDTH - 50, 50, 0, 12);
        const target = new MockSpaceObject(50, World.HEIGHT - 50, 45, 3); // Moving up-right slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move diagonally to intercept target faster by crossing both boundaries
        expect(result.angle).toBeCloseTo(-30.522);
        expect(result.interceptPoint.x).toBeCloseTo(75.82);
        expect(result.interceptPoint.y).toBeCloseTo(475.82);
        expect(result.timeToIntercept).toBeCloseTo(12.17);
    });

    test('should handle corner-to-corner interception (bottom-left to top-right)', () => {
        // ASCII Diagram (Toroidal World):
        // Top edge ────────────────────────────────────
        // |                              Target(450,50) ↙ |
        // |                                       T   |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // | Ship(50,450) S                            |
        // Bottom edge ─────────────────────────────────
        // |←── Ship can wrap diagonally across world ──→|
        //
        // Ship in bottom-left corner, target in top-right corner moving down-left
        // Ship should wrap diagonally to intercept faster  
        // Expected: Ship should aim diagonally
        
        // Arrange
        const ship = new MockSpaceObject(50, World.HEIGHT - 50, 0, 12);
        const target = new MockSpaceObject(World.WIDTH - 50, 50, 225, 3); // Moving down-left slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move diagonally to intercept target faster by crossing both boundaries
        expect(result.angle).toBeCloseTo(149.477);
        expect(result.interceptPoint.x).toBeCloseTo(424.180);
        expect(result.interceptPoint.y).toBeCloseTo(24.180);
        expect(result.timeToIntercept).toBeCloseTo(12.17);
    });

    test('should handle corner-to-corner interception (bottom-right to top-left)', () => {
        // ASCII Diagram (Toroidal World):
        // Top edge ────────────────────────────────────
        // | Target(50,50) ↘ T                         |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                                           |
        // |                             Ship(450,450) S |
        // Bottom edge ─────────────────────────────────
        // |←── Ship can wrap diagonally across world ──→|
        //
        // Ship in bottom-right corner, target in top-left corner moving down-right
        // Ship should wrap diagonally to intercept faster
        // Expected: Ship should aim diagonally
        
        // Arrange
        const ship = new MockSpaceObject(World.WIDTH - 50, World.HEIGHT - 50, 0, 12);
        const target = new MockSpaceObject(50, 50, 315, 1); // Moving down-right slowly
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // Ship should move diagonally to intercept target faster by crossing both boundaries
        expect(result.angle).toBeCloseTo(40.22);
        expect(result.interceptPoint.x).toBeCloseTo(58.36);
        expect(result.interceptPoint.y).toBeCloseTo(41.637);
        expect(result.timeToIntercept).toBeCloseTo(11.83);
    });

    test('should handle complex interception which needs double warping of the target', () => {
        // ASCII Diagram (Toroidal World):
        // Top edge ────────────────────────────────────
        // |                                           |
        // |                                           |
        // | Ship at (50, 250)                         |
        // |  S                                        |
        // |  T  -->                                   |
        // |  Target at (50, 270)                      |
        // |                                           |
        // |                                           |
        // |                                           |
        // Bottom edge ─────────────────────────────────

        // Ship at (50, 250), target at (50, 270) moving right faster
        // Ship should warp around the world to intercept target
        // Expected: Ship should aim appropriately
        
        // Arrange
        const ship = new MockSpaceObject(50, 250, 0, 1);
        const target = new MockSpaceObject(50, 270, 0, 10); // Moving right faster
        
        // Act
        const result = InterceptCalculator.calculateInterceptAngle(ship, target);
        
        // Assert
        // This should be a complex case that might wrap around the world
        expect(result.angle).toBeCloseTo(154.15);
        expect(result.interceptPoint.x).toBeCloseTo(8.717);
        expect(result.interceptPoint.y).toBeCloseTo(270);
        expect(result.timeToIntercept).toBeCloseTo(45.871);
    });

});