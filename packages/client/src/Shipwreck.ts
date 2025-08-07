import { Collectible } from './Collectible';
import { Shipwreck as SharedShipwreck } from '../../shared/src/types/gameTypes';

/**
 * Shipwreck collectible - remains of a destroyed ship that can be salvaged.
 * Provides value points when collected.
 */
export class Shipwreck extends Collectible {
    /**
     * @param serverData - Server data containing all shipwreck properties
     */
    constructor(serverData: SharedShipwreck) {
        super(serverData);
    }

}