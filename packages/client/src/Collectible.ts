import { SpaceObjectOld } from './SpaceObject';
import { Collectible as SharedCollectible } from '../../shared/src/types/gameTypes';

/**
 * Abstract base class for all collectible objects in the game.
 * Collectibles are space objects that can be collected by the player's ship.
 */
export abstract class Collectible extends SpaceObjectOld {
    
    /**
     * @param serverData - Server data containing all object properties including value
     */
    constructor(serverData: SharedCollectible) {
        super(serverData);
    }

} 