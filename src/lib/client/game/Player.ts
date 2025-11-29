import { Collectible } from './Collectible';
import { Ship } from './Ship';
/**
 * Player class that manages the player's ship, inventory, score, and other player-specific data
 */
export class Player {
    private ship: Ship;

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
     * Handle collecting an item
     * Updates last collected, adds to inventory, and updates score
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    collectItem(_collectible: Collectible): void {
        // TODO: trigger backend
    }
} 