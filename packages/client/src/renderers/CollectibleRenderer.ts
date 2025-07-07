import { Collectible } from '../Collectible';

/**
 * Base renderer for collectible objects
 * This provides common functionality for all collectible renderers
 */
export abstract class CollectibleRenderer {
    /**
     * Draw a collectible on the canvas
     */
    drawCollectible(
        ctx: CanvasRenderingContext2D,
        centerX: number, 
        centerY: number,
        viewportX: number,
        viewportY: number,
        collectible: Collectible
    ): void {
        // Calculate screen position
        const screenX = centerX + (collectible.getX() - viewportX);
        const screenY = centerY + (collectible.getY() - viewportY);
        
        // Set up common rendering states
        ctx.save();
        
        // Translate to object position
        ctx.translate(screenX, screenY);
        ctx.rotate(collectible.getAngle());
        
        // Draw the collectible (implemented by specific renderers)
        this.drawCollectibleShape(ctx, collectible);
        
        // Draw hover effect if hovered
        if (collectible.isHoveredState()) {
            ctx.beginPath();
            ctx.arc(0, 0, collectible.getHoverRadius(), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Draw the specific shape of a collectible
     * This is implemented by subclasses for each collectible type
     */
    protected abstract drawCollectibleShape(ctx: CanvasRenderingContext2D, collectible: Collectible): void;
} 