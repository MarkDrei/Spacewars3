export class Asteroid {
    private x: number;
    private y: number;
    private angle: number;
    private speed: number;

    constructor(x: number, y: number, angleDegrees: number, speed: number) {
        this.x = x;
        this.y = y;
        // Convert degrees to radians and adjust for 0 degrees pointing up
        this.angle = ((angleDegrees - 90) * Math.PI) / 180;
        this.speed = speed;
    }

    getX(): number {
        return this.x;
    }

    getY(): number {
        return this.y;
    }

    updatePosition(deltaTime: number): void {
        if (this.speed === 0) return; // Don't update position if speed is 0
        this.x += this.speed * Math.cos(this.angle) * deltaTime;
        this.y += this.speed * Math.sin(this.angle) * deltaTime;
    }

    draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, shipX: number, shipY: number): void {
        const asteroidScreenX = centerX + this.x - shipX;
        const asteroidScreenY = centerY + this.y - shipY;
        ctx.save();
        ctx.translate(asteroidScreenX, asteroidScreenY);
        // Add 90 degrees (Math.PI/2) to align the visual orientation with movement direction
        ctx.rotate(this.angle + Math.PI/2);
        // Draw a simple triangle pointing upwards with a sharper angle
        ctx.beginPath();
        ctx.moveTo(0, -10);    // top
        ctx.lineTo(5, 5);      // bottom right
        ctx.lineTo(-5, 5);     // bottom left
        ctx.closePath();
        ctx.fillStyle = '#ff5722'; // orange fill
        ctx.fill();
        ctx.strokeStyle = '#bf360c'; // darker orange stroke
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
} 