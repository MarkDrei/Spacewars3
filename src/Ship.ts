export class Ship {
    private x: number;
    private y: number;
    private angle: number;
    private speed: number;

    constructor() {
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.speed = 20;
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
        const speedInPointsPerSecond = this.speed;
        const speedInPointsPerFrame = speedInPointsPerSecond * deltaTime;
        this.x += speedInPointsPerFrame * Math.cos(this.angle);
        this.y += speedInPointsPerFrame * Math.sin(this.angle);
    }
} 