import { Asteroid } from './Asteroid';

export class AsteroidRenderer {
    drawAsteroids(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, shipX: number, shipY: number, asteroids: Asteroid[]): void {
        asteroids.forEach(asteroid => {
            const asteroidScreenX = centerX + asteroid.getX() - shipX;
            const asteroidScreenY = centerY + asteroid.getY() - shipY;
            ctx.save();
            ctx.translate(asteroidScreenX, asteroidScreenY);
            ctx.rotate(asteroid.getAngle() + Math.PI/2);
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
        });
    }
} 