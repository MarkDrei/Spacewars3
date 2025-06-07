import { Ship } from './Ship';
import { SpaceObject } from './SpaceObject';

export class ShipRenderer {
    drawShip(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        ship: Ship
    ): void {
        // Draw hover effect if ship is hovered
        if (ship.isHoveredState()) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, SpaceObject.HOVER_RADIUS, 0, Math.PI * 2);
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw the ship
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngle());

        // Draw engine flames
        this.drawEngineFlames(ctx);

        // Draw the main ship body
        ctx.beginPath();
        // Main body
        ctx.moveTo(30, 0);     // Nose
        ctx.lineTo(20, 8);     // Right wing top
        ctx.lineTo(15, 12);    // Right wing tip
        ctx.lineTo(10, 8);     // Right wing bottom
        ctx.lineTo(-10, 8);    // Right engine
        ctx.lineTo(-15, 12);   // Right engine tip
        ctx.lineTo(-20, 8);    // Right engine top
        ctx.lineTo(-25, 0);    // Back center
        ctx.lineTo(-20, -8);   // Left engine top
        ctx.lineTo(-15, -12);  // Left engine tip
        ctx.lineTo(-10, -8);   // Left engine bottom
        ctx.lineTo(10, -8);    // Left wing bottom
        ctx.lineTo(15, -12);   // Left wing tip
        ctx.lineTo(20, -8);    // Left wing top
        ctx.closePath();

        // Fill with a gradient for depth
        const bodyGradient = ctx.createLinearGradient(-25, 0, 30, 0);
        bodyGradient.addColorStop(0, '#546e7a');    // Darker blue-grey at back
        bodyGradient.addColorStop(0.5, '#78909c');  // Medium blue-grey in middle
        bodyGradient.addColorStop(1, '#90a4ae');    // Lighter blue-grey at front
        ctx.fillStyle = bodyGradient;
        ctx.fill();

        // Draw cockpit
        ctx.beginPath();
        ctx.ellipse(10, 0, 8, 6, 0, 0, Math.PI * 2);
        const cockpitGradient = ctx.createRadialGradient(10, 0, 0, 10, 0, 8);
        cockpitGradient.addColorStop(0, '#b3e5fc');  // Light blue center
        cockpitGradient.addColorStop(1, '#4fc3f7');  // Darker blue edge
        ctx.fillStyle = cockpitGradient;
        ctx.fill();

        // Add some detail lines
        ctx.beginPath();
        // Wing details
        ctx.moveTo(20, 8);
        ctx.lineTo(15, 12);
        ctx.moveTo(20, -8);
        ctx.lineTo(15, -12);
        // Engine details
        ctx.moveTo(-10, 8);
        ctx.lineTo(-15, 12);
        ctx.moveTo(-10, -8);
        ctx.lineTo(-15, -12);
        ctx.strokeStyle = '#37474f';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw a subtle outline
        ctx.strokeStyle = '#263238';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    private drawEngineFlames(ctx: CanvasRenderingContext2D): void {
        // Right engine flame
        this.drawFlame(ctx, -10, 8, Math.PI / 2);
        // Left engine flame
        this.drawFlame(ctx, -10, -8, Math.PI / 2);
    }

    private drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Create flame gradient
        const flameGradient = ctx.createLinearGradient(0, 0, 0, 20);
        flameGradient.addColorStop(0, '#ff6d00');   // Orange at base
        flameGradient.addColorStop(0.5, '#ff3d00'); // Darker orange in middle
        flameGradient.addColorStop(1, '#d50000');   // Red at tip

        // Draw main flame
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(5, 10);
        ctx.lineTo(0, 20);
        ctx.lineTo(-5, 10);
        ctx.closePath();
        ctx.fillStyle = flameGradient;
        ctx.fill();

        // Add inner flame
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(3, 8);
        ctx.lineTo(0, 15);
        ctx.lineTo(-3, 8);
        ctx.closePath();
        ctx.fillStyle = '#ffab00';  // Bright yellow
        ctx.fill();

        // Add some flickering particles
        for (let i = 0; i < 3; i++) {
            const particleX = (Math.random() - 0.5) * 6;
            const particleY = Math.random() * 15;
            ctx.beginPath();
            ctx.arc(particleX, particleY, 1, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd600';  // Bright yellow
            ctx.fill();
        }

        ctx.restore();
    }
} 