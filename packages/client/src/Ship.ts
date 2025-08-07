import { SpaceObjectOld } from './SpaceObject';
import { SpaceObject as SharedSpaceObject } from '../../shared/src/types/gameTypes';

export class Ship extends SpaceObjectOld {
    constructor(serverData: SharedSpaceObject) {
        super(serverData);
    }

    // Ship-specific methods can be added here if needed
    // For example, methods related to ship-specific behavior
    // that aren't common to all space objects
} 