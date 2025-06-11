import { Asteroid } from '../Asteroid';
import { SpaceObject } from '../SpaceObject';

export class AsteroidRenderer {
    drawAsteroids(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, shipX: number, shipY: number, objects: SpaceObject[]): void {
        // Filter objects to only include asteroids
        const asteroids = objects.filter(obj => obj instanceof Asteroid) as Asteroid[];
        
        asteroids.forEach(asteroid => {
            const objectScreenX = centerX + asteroid.getX() - shipX;
            const objectScreenY = centerY + asteroid.getY() - shipY;
            ctx.save();
            ctx.translate(objectScreenX, objectScreenY);
            ctx.rotate(asteroid.getAngle() + Math.PI/2);

            // Draw hover effect if object is hovered
            if (asteroid.isHoveredState()) {
                ctx.beginPath();
                ctx.arc(0, 0, SpaceObject.HOVER_RADIUS, 0, Math.PI * 2);
                ctx.strokeStyle = '#808080';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Draw the main asteroid body
            ctx.beginPath();
            // Create an irregular, rocky shape
            ctx.moveTo(0, -20);  // Top point (direction indicator)
            
            // Right side with irregular bumps
            ctx.lineTo(12, -8);  // Right upper bump
            ctx.lineTo(15, 0);   // Right middle
            ctx.lineTo(12, 8);   // Right lower bump
            ctx.lineTo(8, 12);   // Right bottom
            
            // Bottom with crater-like indentations
            ctx.lineTo(0, 15);   // Bottom center
            ctx.lineTo(-8, 12);  // Left bottom
            
            // Left side with more irregular bumps
            ctx.lineTo(-12, 8);  // Left lower bump
            ctx.lineTo(-15, 0);  // Left middle
            ctx.lineTo(-12, -8); // Left upper bump
            ctx.lineTo(-8, -12); // Left top
            
            ctx.closePath();

            // Fill with a gradient for depth
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
            gradient.addColorStop(0, '#8d6e63');    // Lighter brown in center
            gradient.addColorStop(1, '#4e342e');    // Darker brown at edges
            ctx.fillStyle = gradient;
            ctx.fill();

            // Add surface details
            ctx.strokeStyle = '#3e2723';  // Dark brown for details
            ctx.lineWidth = 1;
            
            // Draw some crater-like details
            this.drawCrater(ctx, 5, -5, 3);
            this.drawCrater(ctx, -8, 3, 4);
            this.drawCrater(ctx, 7, 7, 2);
            
            // Add some highlight lines
            ctx.beginPath();
            ctx.moveTo(-5, -10);
            ctx.lineTo(5, -8);
            ctx.moveTo(-8, 0);
            ctx.lineTo(8, 2);
            ctx.strokeStyle = '#a1887f';  // Lighter brown for highlights
            ctx.stroke();

            // Draw a subtle outline
            ctx.strokeStyle = '#3e2723';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw the direction indicator
            ctx.beginPath();
            ctx.moveTo(0, -20);  // Top point
            ctx.lineTo(5, -15);  // Right side of the point
            ctx.lineTo(0, -10);  // Bottom of the point
            ctx.lineTo(-5, -15); // Left side of the point
            ctx.closePath();
            
            // Fill the direction indicator with a lighter color
            const pointGradient = ctx.createLinearGradient(0, -20, 0, -10);
            pointGradient.addColorStop(0, '#a1887f');  // Lighter at top
            pointGradient.addColorStop(1, '#8d6e63');  // Darker at bottom
            ctx.fillStyle = pointGradient;
            ctx.fill();
            
            // Add a highlight to the direction indicator
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(2, -17);
            ctx.lineTo(0, -14);
            ctx.strokeStyle = '#d7ccc8';  // Very light highlight
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        });
    }

    private drawCrater(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = '#3e2723';
        ctx.fill();
        
        // Add a highlight to the crater
        ctx.beginPath();
        ctx.arc(x - size/3, y - size/3, size/3, 0, Math.PI * 2);
        ctx.fillStyle = '#8d6e63';
        ctx.fill();
    }
} 