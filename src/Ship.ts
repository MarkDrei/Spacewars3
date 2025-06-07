import { SpaceObject } from './SpaceObject';

export class Ship extends SpaceObject {
    constructor() {
        // Start at origin (0,0), angle 0, speed 20
        super(0, 0, 0, 20);
    }

    // Ship-specific methods can be added here if needed
    // For example, methods related to ship-specific behavior
    // that aren't common to all space objects
} 