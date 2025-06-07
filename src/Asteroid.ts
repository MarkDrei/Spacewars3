import { SpaceObject } from './SpaceObject';

export class Asteroid extends SpaceObject {
    constructor(x: number, y: number, angleDegrees: number, speed: number) {
        // Convert degrees to radians and adjust for 0 degrees pointing up
        const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
        super(x, y, angleRadians, speed);
    }
} 