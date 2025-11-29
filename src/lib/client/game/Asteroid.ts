import { Collectible } from './Collectible';
import { Asteroid as SharedAsteroid } from '@shared/types/gameTypes';

export class Asteroid extends Collectible {
    constructor(serverData: SharedAsteroid) {
        super(serverData);
    }
} 