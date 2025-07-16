import { Ship } from '../Ship';

export class RadarRenderer {
    drawRadar(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, ship: Ship): void {
        const maxRadius = Math.min(centerX, centerY);

        // Draw outer circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#8b0000';  // Dark red for rings
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw inner circle at 75 distance
        ctx.beginPath();
        ctx.arc(centerX, centerY, 75, 0, Math.PI * 2);
        ctx.strokeStyle = '#8b0000';  // Dark red for rings
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw horizontal and vertical lines only (no diagonals)
        const angles = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2];
        for (const angle of angles) {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + maxRadius * Math.cos(angle), centerY + maxRadius * Math.sin(angle));
            ctx.strokeStyle = '#8b0000';  // Dark red for lines
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw coordinates
        const shipX = ship.getX();
        const shipY = ship.getY();
        const coordinateDistance = 400; // Show coordinates within 400 units
        const innerExclusionZone = 70; // Don't show coordinates within 70 units

        // Calculate the range of coordinates to show
        const minX = Math.floor((shipX - coordinateDistance) / 50) * 50;
        const maxX = Math.ceil((shipX + coordinateDistance) / 50) * 50;
        const minY = Math.floor((shipY - coordinateDistance) / 50) * 50;
        const maxY = Math.ceil((shipY + coordinateDistance) / 50) * 50;

        ctx.font = '12px Arial';
        ctx.fillStyle = '#ff0000';  // Bright red for numbers

        // Draw X coordinates
        ctx.textAlign = 'center';
        for (let x = minX; x <= maxX; x += 50) {
            if (x % 50 === 0) { // Only draw coordinates divisible by 50
                const distanceFromShipX = Math.abs(x - shipX);
                // Only draw if outside the inner exclusion zone and within the outer limit
                if (distanceFromShipX >= innerExclusionZone && distanceFromShipX <= coordinateDistance) {
                    const screenX = centerX + (x - shipX);
                    const screenY = centerY + 15; // Position below the center
                    ctx.fillText(x.toString(), screenX, screenY);
                }
            }
        }

        // Draw Y coordinates
        ctx.textAlign = 'right';
        for (let y = minY; y <= maxY; y += 50) {
            if (y % 50 === 0) { // Only draw coordinates divisible by 50
                const distanceFromShipY = Math.abs(y - shipY);
                // Only draw if outside the inner exclusion zone and within the outer limit
                if (distanceFromShipY >= innerExclusionZone && distanceFromShipY <= coordinateDistance) {
                    const screenX = centerX - 15; // Position to the left of the center
                    const screenY = centerY + (y - shipY);
                    ctx.fillText(y.toString(), screenX, screenY);
                }
            }
        }
    }
} 