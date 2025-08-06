import { SpaceObject } from './SpaceObject';

/**
 * Abstract base class for all collectible objects in the game.
 * Collectibles are space objects that can be collected by the player's ship.
 */
export abstract class Collectible extends SpaceObject {
    protected value: number;
    protected isCollected: boolean;
    
    /**
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param angleDegrees - Direction angle in degrees (0-360)
     * @param speed - Movement speed
     * @param value - Points awarded when collected
     */
    constructor(x: number, y: number, angleDegrees: number, speed: number, value: number) {
        super(x, y, angleDegrees, speed);
        this.value = value;
        this.isCollected = false;
    }
    
    /**
     * Get the value/points for this collectible
     */
    getValue(): number {
        return this.value;
    }
    
    /**
     * Mark this collectible as collected
     */
    collect(): void {
        this.isCollected = true;
    }
    
    /**
     * Check if this collectible has been collected
     */
    isCollectedState(): boolean {
        return this.isCollected;
    }
    
    /**
     * Abstract method that defines what happens when this collectible is collected
     * Each collectible type will implement its own collection effect
     */
    abstract onCollect(): void;
    
    /**
     * Get the type of collectible (for rendering and game logic)
     */
    abstract getType(): string;
} 