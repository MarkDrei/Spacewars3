import { SpaceObject } from './SpaceObject';

export class Ship extends SpaceObject {
    constructor(x: number = 0, y: number = 0, angleDegrees: number = 0, speed: number = 20) {
        super(x, y, angleDegrees, speed);
    }

    // Ship-specific methods can be added here if needed
    // For example, methods related to ship-specific behavior
    // that aren't common to all space objects
} 