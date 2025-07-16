import { Collectible } from './Collectible';
import { Ship } from './Ship';
import { Shipwreck } from './Shipwreck';

// Interface to track inventory items
export interface InventoryItem {
    type: string;
    salvageType?: string;
    value: number;
    timestamp: number;
}

/**
 * Player class that manages the player's ship, inventory, score, and other player-specific data
 */
export class Player {
    private ship: Ship;
    private score: number = 0;
    private lastCollected: Collectible | null = null;
    private inventory: InventoryItem[] = [];

    constructor(ship: Ship) {
        this.ship = ship;
    }

    /**
     * Get the player's ship
     */
    getShip(): Ship {
        return this.ship;
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

    /**
     * Get the last collected item
     */
    getLastCollected(): Collectible | null {
        return this.lastCollected;
    }

    /**
     * Set the last collected item
     */
    setLastCollected(collectible: Collectible): void {
        this.lastCollected = collectible;
    }

    /**
     * Get the inventory of collected items
     */
    getInventory(): InventoryItem[] {
        return this.inventory;
    }

    /**
     * Add an item to the inventory
     */
    addToInventory(item: InventoryItem): void {
        this.inventory.push(item);
    }

    /**
     * Handle collecting an item
     * Updates last collected, adds to inventory, and updates score
     */
    collectItem(collectible: Collectible): void {
        // Track this as the last collected item
        this.lastCollected = collectible;
        
        // Add to inventory
        this.inventory.push({
            type: collectible.getType(),
            value: collectible.getValue(),
            timestamp: Date.now(),
            // Add salvage type if it's a shipwreck
            ...(collectible.getType() === 'shipwreck' && collectible instanceof Shipwreck && 
                { salvageType: collectible.getSalvageType() })
        });
        
        // Add to score
        this.addScore(collectible.getValue());

        // Call the collectible's onCollect method
        collectible.onCollect(this);
    }
} 