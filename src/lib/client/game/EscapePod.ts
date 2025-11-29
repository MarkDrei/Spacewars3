import { Collectible } from './Collectible';
import { EscapePod as SharedEscapePod } from '@shared/types/gameTypes';

/**
 * EscapePod collectible - a life-saving pod ejected from a destroyed ship.
 * Contains survivors that provide value and potentially other benefits when rescued.
 */
export class EscapePod extends Collectible {
    /**
     * @param serverData - Server data containing all escape pod properties including survivors
     */
    constructor(serverData: SharedEscapePod) {
        super(serverData);
    }
    
    /**
     * Get the number of survivors in this escape pod
     */
    getSurvivors(): number {
        return (this.serverData as SharedEscapePod).survivors;
    }
}