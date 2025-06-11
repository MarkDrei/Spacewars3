import { SpaceObject } from './SpaceObject';
import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
import { InterceptCalculator } from './InterceptCalculator';
import { Collectible } from './Collectible';

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
    private score: number = 0;
    
    // World boundaries
    public static readonly WIDTH = 500;
    public static readonly HEIGHT = 500;

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
    
    // Get world dimensions
    getWidth(): number {
        return World.WIDTH;
    }
    
    getHeight(): number {
        return World.HEIGHT;
    }
    
    // Wrap a position to stay within world boundaries
    wrapPosition(x: number, y: number): { x: number, y: number } {
        // Wrap x-coordinate
        let wrappedX = x % World.WIDTH;
        if (wrappedX < 0) wrappedX += World.WIDTH;
        
        // Wrap y-coordinate
        let wrappedY = y % World.HEIGHT;
        if (wrappedY < 0) wrappedY += World.HEIGHT;
        
        return { x: wrappedX, y: wrappedY };
    }

    /**
     * Get the current score
     */
    getScore(): number {
        return this.score;
    }
    
    /**
     * Add points to the score
     */
    addScore(points: number): void {
        this.score += points;
    }

    // Update all object positions based on their velocity and the elapsed time
    update(deltaTime: number): void {
        // Update all space objects
        this.spaceObjects.forEach(obj => {
            // First update position normally
            obj.updatePosition(deltaTime);
            
            // Then wrap position if needed
            const wrappedPos = this.wrapPosition(obj.getX(), obj.getY());
            obj.setX(wrappedPos.x);
            obj.setY(wrappedPos.y);
        });
        
        // Check for collisions with collectibles
        this.checkCollectibleCollisions();
        
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
        
        // Wrap mouse position to world boundaries
        const wrappedMouse = this.wrapPosition(worldMouseX, worldMouseY);
        
        // Then, set hover state for objects under the mouse
        this.spaceObjects.forEach(obj => {
            // Check if the object is hovered at its current position
            if (obj.isPointInHoverRadius(wrappedMouse.x, wrappedMouse.y)) {
                obj.setHovered(true);
                return;
            }
            
            // Check for hover near world edges (for wrapped objects)
            this.checkWrappedHover(obj, wrappedMouse.x, wrappedMouse.y);
        });
    }
    
    // Check if an object is hovered when considering wrapping
    private checkWrappedHover(obj: SpaceObject, mouseX: number, mouseY: number): void {
        const objX = obj.getX();
        const objY = obj.getY();
        const radius = obj.getHoverRadius();
        
        // Check all 8 possible wrapped positions around the world edges
        const positions = [
            { x: objX - World.WIDTH, y: objY },                  // Left
            { x: objX + World.WIDTH, y: objY },                  // Right
            { x: objX, y: objY - World.HEIGHT },                 // Top
            { x: objX, y: objY + World.HEIGHT },                 // Bottom
            { x: objX - World.WIDTH, y: objY - World.HEIGHT },   // Top-Left
            { x: objX + World.WIDTH, y: objY - World.HEIGHT },   // Top-Right
            { x: objX - World.WIDTH, y: objY + World.HEIGHT },   // Bottom-Left
            { x: objX + World.WIDTH, y: objY + World.HEIGHT }    // Bottom-Right
        ];
        
        // Check if any of these positions are within hover radius
        for (const pos of positions) {
            const dx = mouseX - pos.x;
            const dy = mouseY - pos.y;
            if (dx * dx + dy * dy <= radius * radius) {
                obj.setHovered(true);
                return;
            }
        }
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
        
        // Get positions
        const shipX = ship.getX();
        const shipY = ship.getY();
        const targetX = targetObject.getX();
        const targetY = targetObject.getY();
        
        // Initialize variables for best solution
        let bestInterceptTime = Number.POSITIVE_INFINITY;
        let bestInterceptX = 0;
        let bestInterceptY = 0;
        
        // Try all images of ship and target (shifting by -wrapSize, 0, +wrapSize in both axes)
        for (let kxX = -1; kxX <= 1; kxX++) {
            for (let kyX = -1; kyX <= 1; kyX++) {
                const shipXi = shipX + kxX * World.WIDTH;
                const shipYi = shipY + kyX * World.HEIGHT;
                
                for (let kxY = -1; kxY <= 1; kxY++) {
                    for (let kyY = -1; kyY <= 1; kyY++) {
                        const targetXi = targetX + kxY * World.WIDTH;
                        const targetYi = targetY + kyY * World.HEIGHT;
                        
                        // Calculate relative positions
                        const dx = targetXi - shipXi;
                        const dy = targetYi - shipYi;
                        
                        // Calculate velocities
                        const targetVelX = targetSpeed * Math.cos(targetAngle);
                        const targetVelY = targetSpeed * Math.sin(targetAngle);
                        const shipVelX = shipSpeed * Math.cos(interceptAngle);
                        const shipVelY = shipSpeed * Math.sin(interceptAngle);
                        
                        // Calculate relative velocity
                        const relVelX = shipVelX - targetVelX;
                        const relVelY = shipVelY - targetVelY;
                        
                        // Calculate quadratic equation coefficients
                        const a = relVelX * relVelX + relVelY * relVelY;
                        const b = 2 * (dx * relVelX + dy * relVelY);
                        const c = dx * dx + dy * dy;
                        
                        // Calculate discriminant
                        const discriminant = b * b - 4 * a * c;
                        
                        // If interception is possible
                        if (discriminant >= 0 && a > 0.0001) {
                            // Calculate interception time (smaller positive root)
                            const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                            const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
                            
                            let interceptTime = Number.MAX_VALUE;
                            if (t1 > 0) interceptTime = t1;
                            if (t2 > 0 && t2 < interceptTime) interceptTime = t2;
                            
                            if (interceptTime !== Number.MAX_VALUE && interceptTime < bestInterceptTime) {
                                bestInterceptTime = interceptTime;
                                
                                // Calculate future positions
                                const futureTargetX = targetXi + targetVelX * interceptTime;
                                const futureTargetY = targetYi + targetVelY * interceptTime;
                                
                                // Store wrapped interception coordinates
                                bestInterceptX = futureTargetX;
                                bestInterceptY = futureTargetY;
                            }
                        }
                    }
                }
            }
        }
        
        // If we found a valid interception
        if (isFinite(bestInterceptTime)) {
            // Wrap the interception point to world boundaries
            const wrappedPos = this.wrapPosition(bestInterceptX, bestInterceptY);
            
            // Store interception data
            this.interceptionData = {
                targetObject: targetObject,
                interceptTime: bestInterceptTime,
                interceptX: wrappedPos.x,
                interceptY: wrappedPos.y,
                shipAngle: interceptAngle,
                timestamp: performance.now()
            };
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

    /**
     * Check for collisions between the ship and any collectibles
     */
    private checkCollectibleCollisions(): void {
        const ship = this.getShip();
        const shipX = ship.getX();
        const shipY = ship.getY();
        const collectionRadius = 30; // Radius for collecting objects (larger than hover radius)
        
        // Get all collectibles
        const collectibles = this.spaceObjects.filter(
            obj => obj instanceof Collectible && !((obj as Collectible).isCollectedState())
        ) as Collectible[];
        
        // Check each collectible for collision with ship
        collectibles.forEach(collectible => {
            // Distance calculation considering wrapped world
            const minDistance = this.getMinDistanceInWrappedWorld(
                shipX, shipY, 
                collectible.getX(), collectible.getY()
            );
            
            // If ship is close enough, collect the item
            if (minDistance <= collectionRadius) {
                // Apply collectible effect
                collectible.onCollect(this);
                
                // Add value to score
                this.addScore(collectible.getValue());
            }
        });
        
        // Remove collected objects from the world
        this.removeCollectedObjects();
    }
    
    /**
     * Calculate minimum distance between two points in a wrapped world
     */
    private getMinDistanceInWrappedWorld(x1: number, y1: number, x2: number, y2: number): number {
        let minDistance = Number.MAX_VALUE;
        
        // Try all possible wrapped positions and find the minimum distance
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                const wrappedX = x2 + offsetX * World.WIDTH;
                const wrappedY = y2 + offsetY * World.HEIGHT;
                
                const deltaX = wrappedX - x1;
                const deltaY = wrappedY - y1;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                minDistance = Math.min(minDistance, distance);
            }
        }
        
        return minDistance;
    }
    
    /**
     * Remove all collected objects from the world
     */
    private removeCollectedObjects(): void {
        this.spaceObjects = this.spaceObjects.filter(obj => {
            if (obj instanceof Collectible) {
                return !obj.isCollectedState();
            }
            return true;
        });
    }
} 