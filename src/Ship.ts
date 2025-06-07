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

    draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.angle);
        // Draw a simple triangle spaceship
        ctx.beginPath();
        ctx.moveTo(30, 0);    // nose
        ctx.lineTo(-15, 12);  // left wing
        ctx.lineTo(-10, 0);   // tail
        ctx.lineTo(-15, -12); // right wing
        ctx.closePath();
        ctx.fillStyle = '#4caf50'; // greenish fill
        ctx.fill();
        ctx.strokeStyle = '#2e7d32'; // darker green stroke
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
} 