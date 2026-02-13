import { SpaceObject } from '@shared/types';
import { World } from '../game/World';

/**
 * Base renderer for all space objects
 * This provides common functionality including positioning, wrapping, and basic rendering
 */
export abstract class SpaceObjectRendererBase {
    /**
     * Standard ship length in pixels (Y-axis height)
     * Used for consistent scaling of all ship types
     */
    public static readonly SHIP_LENGTH = 70;
    /**
     * Draw a space object on the canvas
     */
    drawSpaceObject(
        ctx: CanvasRenderingContext2D,
        centerX: number, 
        centerY: number,
        viewportX: number,
        viewportY: number,
        spaceObject: SpaceObject
    ): void {
        // Calculate screen position
        const screenX = centerX + (spaceObject.x - viewportX);
        const screenY = centerY + (spaceObject.y - viewportY);
        
        // Check if the object is visible on screen (with some margin)
        const margin = 100;
        if (screenX < -margin || screenX > ctx.canvas.width + margin ||
            screenY < -margin || screenY > ctx.canvas.height + margin) {
            // Try drawing wrapped versions
            this.drawWrappedObjects(ctx, centerX, centerY, viewportX, viewportY, spaceObject);
            return;
        }
        
        // Draw the object at the calculated position
        this.drawObjectAtPosition(ctx, screenX, screenY, spaceObject);
    }
    
    /**
     * Draw wrapped copies of the object when they would be visible on screen
     */
    private drawWrappedObjects(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        viewportX: number,
        viewportY: number,
        spaceObject: SpaceObject
    ): void {
        // Get world dimensions from the World class
        const worldWidth = World.WIDTH;
        const worldHeight = World.HEIGHT;
        
        // Define offsets for the 8 possible wrapped positions (including diagonals)
        const wrapOffsets = [
            { x: -worldWidth, y: 0 },             // Left
            { x: worldWidth, y: 0 },              // Right
            { x: 0, y: -worldHeight },            // Top
            { x: 0, y: worldHeight },             // Bottom
            { x: -worldWidth, y: -worldHeight },  // Top-Left
            { x: worldWidth, y: -worldHeight },   // Top-Right
            { x: -worldWidth, y: worldHeight },   // Bottom-Left
            { x: worldWidth, y: worldHeight }     // Bottom-Right
        ];
        
        // Helper function to check if a screen position is visible
        const isPositionVisible = (screenX: number, screenY: number): boolean => {
            const margin = 100;
            return (
                screenX > -margin && 
                screenX < ctx.canvas.width + margin && 
                screenY > -margin && 
                screenY < ctx.canvas.height + margin
            );
        };
        
        // Check all possible wrapped positions
        wrapOffsets.forEach(offset => {
            // Calculate the wrapped object position
            const wrappedX = spaceObject.x + offset.x;
            const wrappedY = spaceObject.y + offset.y;
            
            // Calculate where this would be on screen
            const wrappedScreenX = centerX + (wrappedX - viewportX);
            const wrappedScreenY = centerY + (wrappedY - viewportY);
            
            // Only draw if it would be visible on screen
            if (isPositionVisible(wrappedScreenX, wrappedScreenY)) {
                this.drawObjectAtPosition(ctx, wrappedScreenX, wrappedScreenY, spaceObject);
            }
        });
    }
    
    /**
     * Draw the object at the specified screen position
     */
    private drawObjectAtPosition(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, spaceObject: SpaceObject): void {
        // Set up common rendering states
        ctx.save();
        
        // Translate to object position
        ctx.translate(screenX, screenY);
        // convert angle to radians
        ctx.rotate(spaceObject.angle * (Math.PI / 180)); // Assuming angle is in degrees
        
        // Draw any additional effects before the main object (like dust trails)
        this.drawPreEffects(ctx, spaceObject);
        
        // Draw the main object shape
        const image = this.getObjectImage();
        if (image && image.complete && image.naturalHeight !== 0) {
            // Draw the object image with proper aspect ratio
            const baseSize = this.getObjectSize();
            const aspectRatio = this.getImageAspectRatio();
            
            let width: number, height: number;
            if (aspectRatio > 1) {
                // Image is wider than tall
                width = baseSize;
                height = baseSize / aspectRatio;
            } else {
                // Image is taller than wide (or square)
                width = baseSize * aspectRatio;
                height = baseSize;
            }
            
            const rotation = this.getImageRotationOffset();
            
            ctx.save();
            ctx.rotate(rotation); // Additional rotation for image orientation
            ctx.drawImage(image, -width / 2, -height / 2, width, height);
            ctx.restore();
        } else {
            // Fallback: draw the basic shape
            this.drawFallbackShape(ctx, spaceObject);
        }
        
        // Draw any additional effects after the main object (like engines)
        this.drawPostEffects(ctx, spaceObject);
        
        if ( World.getInstance().getHoveredObjectId() === spaceObject.id)
        {
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Get the image to use for this object type
     * Return null to use fallback shape instead
     */
    protected abstract getObjectImage(): HTMLImageElement | null;
    
    /**
     * Get the size to render the object at
     */
    protected abstract getObjectSize(): number;
    
    /**
     * Get additional rotation offset for image orientation
     * Default is Math.PI / 2 (90 degrees) to align with movement direction
     */
    protected getImageRotationOffset(): number {
        return Math.PI / 2;
    }
    
    /**
     * Get the aspect ratio of the image (width/height)
     * Can be overridden by subclasses to specify custom ratios
     */
    protected getImageAspectRatio(): number {
        const image = this.getObjectImage();
        if (image && image.complete && image.naturalHeight !== 0) {
            return image.naturalWidth / image.naturalHeight;
        }
        // Default to square aspect ratio if image not loaded
        return 1.0;
    }
    
    /**
     * Get the color to use for the fallback shape
     */
    protected abstract getFallbackColor(): string;
    
    /**
     * Draw the fallback shape when image is not available
     * Default implementation draws a simple circle
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected drawFallbackShape(ctx: CanvasRenderingContext2D, _spaceObject: SpaceObject): void {
        const size = this.getObjectSize();
        ctx.beginPath();
        ctx.arc(0, 0, size / 4, 0, Math.PI * 2);
        ctx.fillStyle = this.getFallbackColor();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    /**
     * Draw additional effects before the main object (e.g., dust trails)
     * Override in subclasses to add specific effects
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected drawPreEffects(_ctx: CanvasRenderingContext2D, _spaceObject: SpaceObject): void {
        // Default: no pre-effects
    }
    
    /**
     * Draw additional effects after the main object (e.g., engine flames)
     * Override in subclasses to add specific effects
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected drawPostEffects(_ctx: CanvasRenderingContext2D, _spaceObject: SpaceObject): void {
        // Default: no post-effects
    }
}
