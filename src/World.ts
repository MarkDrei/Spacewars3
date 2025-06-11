import { SpaceObject } from './SpaceObject';
import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
import { InterceptCalculator } from './InterceptCalculator';

export interface InterceptionData {
    targetObject: SpaceObject;
    interceptTime: number;
    interceptX: number;
    interceptY: number;
    shipAngle: number;
    timestamp: number;
}

export class World {
    private ship: Ship;
    private spaceObjects: SpaceObject[];
    private interceptionData: InterceptionData | null = null;

    constructor() {
        // Initialize ship
        this.ship = new Ship();
        
        // Initialize space objects (including ship)
        this.spaceObjects = [
            this.ship,
            new Asteroid(-100, -100, 0, 10), // 0 degrees
            new Asteroid(-100, -100, 180, 10), // 180 degrees
            new Asteroid(0, 0, 0, 15), // Flying towards each other
            new Asteroid(100, 0, 180, 15) // Flying towards each other
        ];
    }

    // Getters
    getShip(): Ship {
        // Find the ship in the space objects array
        const ship = this.spaceObjects.find(obj => obj instanceof Ship) as Ship;
        return ship || this.ship; // Return the found ship or the stored reference
    }

    getSpaceObjects(): SpaceObject[] {
        return this.spaceObjects;
    }

    getInterceptionData(): InterceptionData | null {
        return this.interceptionData;
    }

    // Update all object positions based on their velocity and the elapsed time
    update(deltaTime: number): void {
        // Update all space objects
        this.spaceObjects.forEach(obj => obj.updatePosition(deltaTime));
        
        // Update interception data if it exists
        if (this.interceptionData) {
            // Calculate time elapsed since interception was calculated
            const timeElapsed = (performance.now() - this.interceptionData.timestamp) / 1000;
            const timeRemaining = this.interceptionData.interceptTime - timeElapsed;
            
            // If the interception time has passed, clear the data
            if (timeRemaining <= 0) {
                this.interceptionData = null;
            }
        }
    }

    // Update hover states for all objects based on mouse position
    updateHoverStates(worldMouseX: number, worldMouseY: number): void {
        // First, clear all hover states
        this.spaceObjects.forEach(obj => {
            obj.setHovered(false);
        });
        
        // Then, set hover state for objects under the mouse
        this.spaceObjects.forEach(obj => {
            if (obj.isPointInHoverRadius(worldMouseX, worldMouseY)) {
                obj.setHovered(true);
            }
        });
    }

    // Find a hovered object that isn't the ship
    findHoveredObject(): SpaceObject | undefined {
        const ship = this.getShip();
        return this.spaceObjects.find(obj => obj !== ship && obj.isHoveredState());
    }

    // Calculate interception for a target object
    interceptObject(targetObject: SpaceObject): void {
        const ship = this.getShip();
        
        // Calculate the interception angle
        const interceptAngle = InterceptCalculator.calculateInterceptAngle(ship, targetObject);
        ship.setAngle(interceptAngle);
        
        // Calculate interception point for visualization
        const targetSpeed = targetObject.getSpeed();
        const targetAngle = targetObject.getAngle();
        const shipSpeed = ship.getSpeed();
        
        // Calculate velocities
        const targetVelX = targetSpeed * Math.cos(targetAngle);
        const targetVelY = targetSpeed * Math.sin(targetAngle);
        const shipVelX = shipSpeed * Math.cos(interceptAngle);
        const shipVelY = shipSpeed * Math.sin(interceptAngle);
        
        // Calculate relative positions
        const relativeX = targetObject.getX() - ship.getX();
        const relativeY = targetObject.getY() - ship.getY();
        
        // Calculate relative velocity
        const relVelX = shipVelX - targetVelX;
        const relVelY = shipVelY - targetVelY;
        
        // Calculate quadratic equation coefficients
        const a = relVelX * relVelX + relVelY * relVelY;
        const b = 2 * (relativeX * relVelX + relativeY * relVelY);
        const c = relativeX * relativeX + relativeY * relativeY;
        
        // Calculate discriminant
        const discriminant = b * b - 4 * a * c;
        
        // If interception is possible
        if (discriminant >= 0) {
            // Calculate interception time (smaller positive root)
            const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
            const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
            
            let interceptTime = Number.MAX_VALUE;
            if (t1 > 0) interceptTime = t1;
            if (t2 > 0 && t2 < interceptTime) interceptTime = t2;
            
            if (interceptTime !== Number.MAX_VALUE) {
                // Calculate future positions
                const futureTargetX = targetObject.getX() + targetVelX * interceptTime;
                const futureTargetY = targetObject.getY() + targetVelY * interceptTime;
                
                // Store interception data
                this.interceptionData = {
                    targetObject: targetObject,
                    interceptTime: interceptTime,
                    interceptX: futureTargetX,
                    interceptY: futureTargetY,
                    shipAngle: interceptAngle,
                    timestamp: performance.now()
                };
            }
        }
    }

    // Set ship angle directly (when clicking without a target)
    setShipAngle(angle: number): void {
        const ship = this.getShip();
        ship.setAngle(angle);
        // Clear any interception data
        this.interceptionData = null;
    }

    // Add a new space object to the world
    addSpaceObject(object: SpaceObject): void {
        this.spaceObjects.push(object);
        // If the object is a ship, update our ship reference
        if (object instanceof Ship) {
            this.ship = object;
        }
    }

    // Remove a space object from the world
    removeSpaceObject(object: SpaceObject): void {
        const index = this.spaceObjects.indexOf(object);
        if (index !== -1) {
            this.spaceObjects.splice(index, 1);
        }
    }
} 