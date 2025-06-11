import { SpaceObject } from './SpaceObject';
import { Player } from './Player';

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
     * @param angle - Direction angle in radians
     * @param speed - Movement speed
     * @param value - Value/points awarded when collected
     */
    constructor(x: number, y: number, angle: number, speed: number, value: number) {
        super(x, y, angle, speed);
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
     * @param player - Reference to the player
     */
    abstract onCollect(player: Player): void;
    
    /**
     * Get the type of collectible (for rendering and game logic)
     */
    abstract getType(): string;
} 