import { SpaceObject } from './SpaceObject';

export class InterceptCalculator {
    /**
     * Calculates the angle needed for the ship to intercept a target object
     * @param ship The ship that will intercept
     * @param target The target object to intercept
     * @returns The angle in radians for the ship to set
     */
    static calculateInterceptAngle(ship: SpaceObject, target: SpaceObject): number {
        // Get positions
        const shipX = ship.getX();
        const shipY = ship.getY();
        const targetX = target.getX();
        const targetY = target.getY();
        
        // Get velocities
        const targetSpeed = target.getSpeed();
        const targetAngle = target.getAngle();
        const shipSpeed = ship.getSpeed();
        
        // Calculate target velocity components
        const targetVelocityX = targetSpeed * Math.cos(targetAngle);
        const targetVelocityY = targetSpeed * Math.sin(targetAngle);
        
        // Calculate relative position
        const relativeX = targetX - shipX;
        const relativeY = targetY - shipY;
        
        // Calculate direct angle to target's current position
        const directAngle = Math.atan2(relativeY, relativeX);
        const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
        
        console.log('===== INTERCEPTION CALCULATION =====');
        console.log(`Ship position: (${shipX.toFixed(2)}, ${shipY.toFixed(2)}), Speed: ${shipSpeed}, Angle: ${(ship.getAngle() * 180 / Math.PI).toFixed(2)}°`);
        console.log(`Target position: (${targetX.toFixed(2)}, ${targetY.toFixed(2)}), Speed: ${targetSpeed}, Angle: ${(targetAngle * 180 / Math.PI).toFixed(2)}°`);
        console.log(`Target velocity: (${targetVelocityX.toFixed(2)}, ${targetVelocityY.toFixed(2)})`);
        console.log(`Distance to target: ${distance.toFixed(2)}`);
        console.log(`Direct angle to target: ${(directAngle * 180 / Math.PI).toFixed(2)}°`);
        
        // If the target is not moving, just aim directly at it
        if (targetSpeed === 0) {
            console.log(`Target not moving, aiming directly at: ${(directAngle * 180 / Math.PI).toFixed(2)}°`);
            console.log(`Estimated interception time: ${(distance / shipSpeed).toFixed(2)} seconds`);
            return directAngle;
        }
        
        // If the ship is not moving, interception is impossible
        if (shipSpeed === 0) {
            console.log(`Ship not moving, interception impossible. Aiming directly at target.`);
            return directAngle;
        }
        
        // Using the Law of Cosines for the interception problem
        // We need to solve for the angle θ where the ship's path intersects the target's path
        
        // First, check if interception is possible (ship must be faster than target for some cases)
        const speedRatio = targetSpeed / shipSpeed;
        
        // If the target is faster than the ship, we need to check if interception is geometrically possible
        if (speedRatio > 1) {
            // If target is faster, we can only intercept if it's moving toward us
            const targetToShipAngle = Math.atan2(-relativeY, -relativeX);
            const angleDiff = Math.abs(InterceptCalculator.normalizeAngleDifference(targetAngle - targetToShipAngle));
            
            if (angleDiff < Math.asin(1/speedRatio)) {
                // Interception is possible - target is moving toward ship within the "interception cone"
                console.log(`Target is faster but moving toward ship, interception possible`);
            } else {
                // Target is moving away and is faster - no interception possible
                console.log(`Target is faster and not moving toward ship, no interception possible`);
                return directAngle; // Just aim at current position as fallback
            }
        }
        
        // Calculate the interception using the Law of Cosines approach
        // This is a more direct mathematical solution than brute force
        
        // We'll solve this analytically using vector geometry
        // We need to find time t where ||ship_pos + ship_vel*t - (target_pos + target_vel*t)|| = 0
        
        // Try both possible interception angles
        let bestAngle = directAngle;
        let bestTime = Number.MAX_VALUE;
        
        // The analytical solution involves a quadratic equation in cos(θ - α)
        // where θ is the ship's angle and α is the angle to the target
        
        // First, calculate the coefficients for our quadratic equation
        const a = shipSpeed * shipSpeed - targetSpeed * targetSpeed;
        const b = 2 * targetSpeed * distance * Math.cos(targetAngle - directAngle);
        const c = -distance * distance;
        
        // Calculate discriminant
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant >= 0) {
            // We have real solutions, which means interception is possible
            
            // Calculate the two possible interception times
            let t1, t2;
            
            // Handle the case where a is very close to zero (ship and target have same speed)
            if (Math.abs(a) < 0.0001) {
                t1 = -c / b;
                t2 = Number.MAX_VALUE;
            } else {
                t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
            }
            
            // Find the smallest positive time
            let interceptTime = Number.MAX_VALUE;
            if (t1 > 0.001) interceptTime = t1;
            if (t2 > 0.001 && t2 < interceptTime) interceptTime = t2;
            
            if (interceptTime < Number.MAX_VALUE) {
                // Calculate where the target will be at the interception time
                const futureTargetX = targetX + targetVelocityX * interceptTime;
                const futureTargetY = targetY + targetVelocityY * interceptTime;
                
                // Calculate the angle the ship needs to travel to reach that point
                bestAngle = Math.atan2(futureTargetY - shipY, futureTargetX - shipX);
                bestTime = interceptTime;
                
                console.log(`Analytical solution found interception at time: ${bestTime.toFixed(2)}s`);
                console.log(`Interception angle: ${(bestAngle * 180 / Math.PI).toFixed(2)}°`);
                console.log(`Target will be at: (${futureTargetX.toFixed(2)}, ${futureTargetY.toFixed(2)})`);
            } else {
                console.log(`No valid positive interception time found`);
            }
        } else {
            // No real solutions, interception is not possible
            console.log(`No analytical solution found, discriminant = ${discriminant}`);
        }
        
        // If we couldn't find a valid interception, try a more advanced approach
        if (bestTime === Number.MAX_VALUE) {
            console.log(`Trying alternative approach for interception...`);
            
            // Use the vector-based approach to calculate interception
            const result = InterceptCalculator.calculateVectorInterception(
                {x: shipX, y: shipY}, 
                {x: targetX, y: targetY}, 
                {x: targetVelocityX, y: targetVelocityY}, 
                shipSpeed
            );
            
            if (result.interceptTime > 0) {
                bestTime = result.interceptTime;
                bestAngle = result.interceptAngle;
                
                console.log(`Vector-based solution found interception at time: ${bestTime.toFixed(2)}s`);
                console.log(`Interception angle: ${(bestAngle * 180 / Math.PI).toFixed(2)}°`);
            } else {
                console.log(`No valid interception found, aiming directly at current position`);
                bestAngle = directAngle;
            }
        }
        
        // Calculate future positions at interception time for verification
        if (bestTime < Number.MAX_VALUE) {
            const shipVelocityX = shipSpeed * Math.cos(bestAngle);
            const shipVelocityY = shipSpeed * Math.sin(bestAngle);
            
            const futureTargetX = targetX + targetVelocityX * bestTime;
            const futureTargetY = targetY + targetVelocityY * bestTime;
            const futureShipX = shipX + shipVelocityX * bestTime;
            const futureShipY = shipY + shipVelocityY * bestTime;
            
            console.log('===== INTERCEPTION SOLUTION =====');
            console.log(`Best interception angle: ${(bestAngle * 180 / Math.PI).toFixed(2)}°`);
            console.log(`Expected interception time: ${bestTime.toFixed(2)} seconds`);
            console.log(`Predicted ship position at interception: (${futureShipX.toFixed(2)}, ${futureShipY.toFixed(2)})`);
            console.log(`Predicted target position at interception: (${futureTargetX.toFixed(2)}, ${futureTargetY.toFixed(2)})`);
            console.log(`Distance between positions: ${Math.sqrt(Math.pow(futureShipX - futureTargetX, 2) + Math.pow(futureShipY - futureTargetY, 2)).toFixed(2)}`);
            console.log('================================');
        }
        
        return bestAngle;
    }
    
    /**
     * Normalizes an angle to be between 0 and 2π
     */
    private static normalizeAngle(angle: number): number {
        return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    }
    
    /**
     * Normalizes an angle difference to be between -π and π
     */
    private static normalizeAngleDifference(angle: number): number {
        let result = angle;
        while (result > Math.PI) result -= 2 * Math.PI;
        while (result < -Math.PI) result += 2 * Math.PI;
        return result;
    }
    
    /**
     * Calculate interception using vector mathematics
     * This is a more robust approach that handles edge cases better
     */
    private static calculateVectorInterception(
        shipPos: {x: number, y: number}, 
        targetPos: {x: number, y: number}, 
        targetVelocity: {x: number, y: number}, 
        shipSpeed: number
    ): {interceptAngle: number, interceptTime: number} {
        // Calculate relative position
        const relativePos = {
            x: targetPos.x - shipPos.x,
            y: targetPos.y - shipPos.y
        };
        
        // Calculate quadratic equation coefficients
        const a = targetVelocity.x * targetVelocity.x + targetVelocity.y * targetVelocity.y - shipSpeed * shipSpeed;
        const b = 2 * (relativePos.x * targetVelocity.x + relativePos.y * targetVelocity.y);
        const c = relativePos.x * relativePos.x + relativePos.y * relativePos.y;
        
        // Calculate discriminant
        const discriminant = b * b - 4 * a * c;
        
        // Default values in case no solution is found
        let interceptTime = -1;
        let interceptAngle = Math.atan2(relativePos.y, relativePos.x);
        
        if (discriminant >= 0) {
            // Calculate the two possible interception times
            let t1, t2;
            
            // Handle the case where a is very close to zero (ship and target have same speed)
            if (Math.abs(a) < 0.0001) {
                if (b !== 0) {
                    t1 = -c / b;
                    t2 = Number.MAX_VALUE;
                } else {
                    // If both a and b are zero, there's no valid solution
                    return { interceptAngle, interceptTime };
                }
            } else {
                t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
            }
            
            // Find the smallest positive time
            if (t1 > 0.001) interceptTime = t1;
            if (t2 > 0.001 && t2 < interceptTime) interceptTime = t2;
            
            if (interceptTime > 0) {
                // Calculate where the target will be at the interception time
                const futureTargetX = targetPos.x + targetVelocity.x * interceptTime;
                const futureTargetY = targetPos.y + targetVelocity.y * interceptTime;
                
                // Calculate the angle the ship needs to travel to reach that point
                interceptAngle = Math.atan2(futureTargetY - shipPos.y, futureTargetX - shipPos.x);
            }
        }
        
        return { interceptAngle, interceptTime };
    }
} 