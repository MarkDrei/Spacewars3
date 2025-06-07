import { Ship } from './Ship';

export class ShipRenderer {
    drawShip(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, ship: Ship): void {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngle());
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