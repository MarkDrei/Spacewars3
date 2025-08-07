import { SpaceObjectOld } from './SpaceObject';
import { World } from './World';
import { degreesToRadians, radiansToDegrees } from '../../shared/src/utils/angleUtils';

export interface InterceptResult {
    angle: number;
    interceptPoint: { x: number; y: number };
    timeToIntercept: number;
}

export class InterceptCalculator {
    /**
     * Calculates the angle needed for the ship to intercept a target object
     * @param ship The ship that will intercept
     * @param target The target object to intercept
     * @param maxSpeed Optional maximum speed for the ship (if not provided, uses ship's current speed)
     * @returns The angle in radians for the ship to set, interception point, and time to intercept
     */
    static calculateInterceptAngle(ship: SpaceObjectOld, target: SpaceObjectOld, maxSpeed?: number): InterceptResult {
        // Get positions
        const x1 = ship.getX();
        const y1 = ship.getY();
        const s1 = maxSpeed !== undefined ? maxSpeed : ship.getSpeed(); // Use maxSpeed if provided, otherwise current speed
        
        const x2 = target.getX();
        const y2 = target.getY();
        const s2 = target.getSpeed();
        const phiDegrees = target.getAngle(); // Angle in degrees from SpaceObject
        const phi = degreesToRadians(phiDegrees); // Convert to radians for calculations
        
        // Get world wrap size
        const wrapSize = World.WIDTH; // Assuming square world
        
        console.log('===== INTERCEPTION CALCULATION =====');
        console.log(`Ship position: (${x1.toFixed(2)}, ${y1.toFixed(2)}), Speed: ${s1}${maxSpeed !== undefined ? ' (max speed)' : ' (current speed)'}`);
        console.log(`Target position: (${x2.toFixed(2)}, ${y2.toFixed(2)}), Speed: ${s2}, Angle: ${phiDegrees.toFixed(2)}°`);
        
        // If both objects are at the same position, interception is immediate
        if (x1 === x2 && y1 === y2) {
            console.log(`Ship and target at same position, no movement needed.`);
            return {
                angle: ship.getAngle(), // Keep current ship angle unchanged
                interceptPoint: { x: x1, y: y1 },
                timeToIntercept: 0
            };
        }
        
        // If the ship is not moving, interception is impossible
        if (s1 === 0) {
            console.log(`Ship not moving, interception impossible. Aiming directly at target.`);
            return {
                angle: Number.NaN, // No valid angle since ship can't move
                interceptPoint: { x: x2, y: y2 },
                timeToIntercept: Number.POSITIVE_INFINITY
            };
        }
        
        // Initialize variables for best solution
        let bestInterceptTime = Number.POSITIVE_INFINITY;
        let bestThetaRad = 0;
        let bestInterceptX = 0;
        let bestInterceptY = 0;
        let bestDistanceX = 0;
        let bestDistanceY = 0;
        let bestTargetWrapX = 0, bestTargetWrapY = 0;
        
        // Try all images of the target (shifting by -wrapSize, 0, +wrapSize in both axes)
        // The target can appear in 9 different positions due to world wrapping
        // We keep the ship position fixed and find the closest target image to intercept
        for (let targetWrapX = -2; targetWrapX <= 2; targetWrapX++) {
            for (let targetWrapY = -2; targetWrapY <= 2; targetWrapY++) {
                const targetImageX = x2 + targetWrapX * wrapSize;
                const targetImageY = y2 + targetWrapY * wrapSize;
                
                const dx = targetImageX - x1;
                const dy = targetImageY - y1;
                
                const cosPhi = Math.cos(phi);
                const sinPhi = Math.sin(phi);
                
                // Quadratic coefficients
                const A = s2 * s2 - s1 * s1;
                const B = 2 * s2 * (dx * cosPhi + dy * sinPhi);
                const C = dx * dx + dy * dy;
                
                const discriminant = B * B - 4 * A * C;
                
                if (discriminant < 0) continue;
                        
                // Find the smallest positive time using quadratic formula
                const sqrtD = Math.sqrt(discriminant);
                const interceptTime1 = (-B + sqrtD) / (2 * A);
                const interceptTime2 = (-B - sqrtD) / (2 * A);
                
                let currentInterceptTime = -1;
                if (interceptTime1 > 0 && interceptTime2 > 0) currentInterceptTime = Math.min(interceptTime1, interceptTime2);
                else if (interceptTime1 > 0) currentInterceptTime = interceptTime1;
                else if (interceptTime2 > 0) currentInterceptTime = interceptTime2;
                else continue;
                
                // Calculate the interception angle for ship
                const vx = (dx / currentInterceptTime + s2 * cosPhi) / s1;
                const vy = (dy / currentInterceptTime + s2 * sinPhi) / s1;
                const thetaRad = Math.atan2(vy, vx);
                
                // Calculate distances
                const distanceX = s1 * currentInterceptTime;
                const distanceY = s2 * currentInterceptTime;
                
                // Interception point (on the torus) - ship starts from original position
                let interceptX = (x1 + s1 * Math.cos(thetaRad) * currentInterceptTime) % wrapSize;
                let interceptY = (y1 + s1 * Math.sin(thetaRad) * currentInterceptTime) % wrapSize;
                if (interceptX < 0) interceptX += wrapSize;
                if (interceptY < 0) interceptY += wrapSize;
                
                // Update best solution
                if (currentInterceptTime < bestInterceptTime) {
                    bestInterceptTime = currentInterceptTime;
                    bestThetaRad = thetaRad;
                    bestDistanceX = distanceX;
                    bestDistanceY = distanceY;
                    bestInterceptX = interceptX;
                    bestInterceptY = interceptY;
                    bestTargetWrapX = targetWrapX;
                    bestTargetWrapY = targetWrapY;
                }
            }
        }
        
        if (!isFinite(bestInterceptTime)) {
            console.log(`No interception possible.`);
        
            return {
                angle: Number.NaN,
                interceptPoint: { x: x2, y: y2 },
                timeToIntercept: Number.POSITIVE_INFINITY
            };
        }
        
        // Log results
        console.log(`Interception angle: ${(bestThetaRad * 180 / Math.PI).toFixed(2)}°`);
        console.log(`Distance traveled by ship: ${bestDistanceX.toFixed(2)} units`);
        console.log(`Distance traveled by target: ${bestDistanceY.toFixed(2)} units`);
        console.log(`Time to intercept: ${bestInterceptTime.toFixed(2)} units`);
        console.log(`Interception point: (${bestInterceptX.toFixed(2)}, ${bestInterceptY.toFixed(2)})`);
        console.log(`Ship image offset: (0, 0), Target image offset: (${bestTargetWrapX}, ${bestTargetWrapY})`);
        console.log('================================');
        
        return {
            angle: radiansToDegrees(bestThetaRad), // Convert back to degrees for SpaceObject
            interceptPoint: { x: bestInterceptX, y: bestInterceptY },
            timeToIntercept: bestInterceptTime
        };
    }
    
} 