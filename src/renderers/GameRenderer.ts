import { Ship } from '../Ship';
import { SpaceObject } from '../SpaceObject';
import { AsteroidRenderer } from './AsteroidRenderer';
import { ShipRenderer } from './ShipRenderer';
import { RadarRenderer } from './RadarRenderer';
import { TooltipRenderer } from './TooltipRenderer';
import { World } from '../World';

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private asteroidRenderer: AsteroidRenderer;
    private shipRenderer: ShipRenderer;
    private radarRenderer: RadarRenderer;
    private tooltipRenderer: TooltipRenderer;
    private world: World;

    constructor(canvas: HTMLCanvasElement, world: World) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.asteroidRenderer = new AsteroidRenderer();
        this.shipRenderer = new ShipRenderer();
        this.radarRenderer = new RadarRenderer();
        this.tooltipRenderer = new TooltipRenderer(canvas);
        this.world = world;
    }

    drawBackground(): void {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw a dark mode background
        this.ctx.fillStyle = '#121212';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world boundary grid lines (subtle)
        this.ctx.strokeStyle = '#303030';
        this.ctx.lineWidth = 1;
        
        // Draw vertical grid lines
        const gridSize = 50; // Grid size in world units
        const shipX = this.world.getShip().getX();
        const shipY = this.world.getShip().getY();
        
        // Calculate visible area in world coordinates
        const viewportWidth = this.canvas.width;
        const viewportHeight = this.canvas.height;
        const visibleLeft = shipX - viewportWidth / 2;
        const visibleRight = shipX + viewportWidth / 2;
        const visibleTop = shipY - viewportHeight / 2;
        const visibleBottom = shipY + viewportHeight / 2;
        
        // Draw vertical grid lines
        for (let x = Math.floor(visibleLeft / gridSize) * gridSize; x <= visibleRight; x += gridSize) {
            const screenX = this.canvas.width / 2 + (x - shipX);
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal grid lines
        for (let y = Math.floor(visibleTop / gridSize) * gridSize; y <= visibleBottom; y += gridSize) {
            const screenY = this.canvas.height / 2 + (y - shipY);
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvas.width, screenY);
            this.ctx.stroke();
        }
        
        // Draw world boundaries
        this.drawWorldBoundaries();
    }
    
    // Draw the world boundaries
    private drawWorldBoundaries(): void {
        const shipX = this.world.getShip().getX();
        const shipY = this.world.getShip().getY();
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const worldWidth = this.world.getWidth();
        const worldHeight = this.world.getHeight();
        
        // Calculate the screen coordinates of the world boundaries
        const leftEdgeX = centerX - shipX;
        const rightEdgeX = centerX + (worldWidth - shipX);
        const topEdgeY = centerY - shipY;
        const bottomEdgeY = centerY + (worldHeight - shipY);
        
        // Draw the world boundaries with a more visible style
        this.ctx.strokeStyle = '#4CAF50'; // Green color for boundaries
        this.ctx.lineWidth = 2;
        
        // Draw the boundary rectangle
        this.ctx.beginPath();
        this.ctx.rect(leftEdgeX, topEdgeY, worldWidth, worldHeight);
        this.ctx.stroke();
        
        // Add boundary labels
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        // X-axis labels
        this.ctx.fillText('0', leftEdgeX, centerY + 20);
        this.ctx.fillText(worldWidth.toString(), rightEdgeX, centerY + 20);
        
        // Y-axis labels
        this.ctx.fillText('0', centerX + 20, topEdgeY);
        this.ctx.fillText(worldHeight.toString(), centerX + 20, bottomEdgeY);
    }

    drawRadar(ship: Ship): void {
        this.radarRenderer.drawRadar(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship
        );
    }

    drawShip(ship: Ship): void {
        this.shipRenderer.drawShip(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship
        );
    }

    drawAsteroids(ship: Ship, objects: SpaceObject[]): void {
        // Draw the main objects first
        this.asteroidRenderer.drawAsteroids(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship.getX(),
            ship.getY(),
            objects
        );
        
        // Now draw the wrapped objects
        this.drawWrappedObjects(ship, objects);
    }
    
    private drawWrappedObjects(ship: Ship, objects: SpaceObject[]): void {
        const worldWidth = this.world.getWidth();
        const worldHeight = this.world.getHeight();
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const shipX = ship.getX();
        const shipY = ship.getY();
        
        // Calculate visible area in world coordinates
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const visibleLeft = shipX - canvasWidth / 2;
        const visibleRight = shipX + canvasWidth / 2;
        const visibleTop = shipY - canvasHeight / 2;
        const visibleBottom = shipY + canvasHeight / 2;
        
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
        
        // Check each object
        objects.forEach(object => {
            const objectX = object.getX();
            const objectY = object.getY();
            
            // Check all possible wrapped positions for each object
            wrapOffsets.forEach(offset => {
                const wrappedX = objectX + offset.x;
                const wrappedY = objectY + offset.y;
                
                // Only draw if it would be visible on screen
                if (this.isPositionVisible(wrappedX, wrappedY, visibleLeft, visibleRight, visibleTop, visibleBottom)) {
                    this.drawWrappedObject(object, wrappedX, wrappedY, ship);
                }
            });
        });
    }
    
    /**
     * Check if a world position is within the visible viewport
     */
    private isPositionVisible(
        worldX: number, 
        worldY: number, 
        visibleLeft: number, 
        visibleRight: number, 
        visibleTop: number, 
        visibleBottom: number
    ): boolean {
        // Add a small margin to account for object size
        const margin = 50;
        return (
            worldX >= visibleLeft - margin && 
            worldX <= visibleRight + margin &&
            worldY >= visibleTop - margin && 
            worldY <= visibleBottom + margin
        );
    }

    private drawWrappedObject(object: SpaceObject, wrappedX: number, wrappedY: number, ship: Ship): void {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const shipX = ship.getX();
        const shipY = ship.getY();
        
        // Create a temporary object with wrapped coordinates for rendering
        // We'll use the original object's properties but with new position
        const wrappedObject = {
            getX: () => wrappedX,
            getY: () => wrappedY,
            getAngle: () => object.getAngle(),
            getSpeed: () => object.getSpeed(),
            isHoveredState: () => object.isHoveredState()
        } as SpaceObject;
        
        // Use the asteroid renderer to draw this wrapped object
        this.asteroidRenderer.drawAsteroids(
            this.ctx,
            centerX,
            centerY,
            shipX,
            shipY,
            [wrappedObject]
        );
    }

    drawTooltip(spaceObjects: SpaceObject[], ship: Ship): void {
        this.tooltipRenderer.drawTooltip(spaceObjects, ship);
    }
} 