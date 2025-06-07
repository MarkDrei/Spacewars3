export abstract class SpaceObject {
    protected x: number;
    protected y: number;
    protected angle: number;
    protected speed: number;

    constructor(x: number, y: number, angle: number, speed: number) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
    }

    getX(): number {
        return this.x;
    }

    getY(): number {
        return this.y;
    }

    getAngle(): number {
        return this.angle;
    }

    getSpeed(): number {
        return this.speed;
    }

    setAngle(angle: number): void {
        this.angle = angle;
    }

    setSpeed(speed: number): void {
        this.speed = speed;
    }

    updatePosition(deltaTime: number): void {
        if (this.speed === 0) return;
        this.x += this.speed * Math.cos(this.angle) * deltaTime;
        this.y += this.speed * Math.sin(this.angle) * deltaTime;
    }
} 