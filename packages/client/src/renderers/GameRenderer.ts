import { Ship } from '../Ship';
import { SpaceObject } from '../SpaceObject';
import { ShipRenderer } from './ShipRenderer';
import { RadarRenderer } from './RadarRenderer';
import { TooltipRenderer } from './TooltipRenderer';
import { World } from '../World';
import { Collectible } from '../Collectible';
import { CollectiblesRenderer } from './CollectiblesRenderer';

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private world: World;
    private shipRenderer: ShipRenderer;
    private radarRenderer: RadarRenderer;
    private tooltipRenderer: TooltipRenderer;
    private collectiblesRenderer: CollectiblesRenderer;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, world: World) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.world = world;
        this.shipRenderer = new ShipRenderer();
        this.radarRenderer = new RadarRenderer();
        this.tooltipRenderer = new TooltipRenderer(canvas);
        this.collectiblesRenderer = new CollectiblesRenderer(ctx, canvas);
    }

    drawBackground(): void {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw a space background (black)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world boundary grid lines (subtle)
        this.ctx.strokeStyle = '#1a1a1a';
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
    
    // Draw the world boundaries with a green color
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

    drawTooltip(spaceObjects: SpaceObject[], ship: Ship): void {
        this.tooltipRenderer.drawTooltip(spaceObjects, ship);
    }

    drawWorld(ship: Ship): void {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the background
        this.drawBackground();
        
        // Get collectibles
        const objects = this.world.getSpaceObjects();
        const collectibles = objects.filter(obj => obj instanceof Collectible) as Collectible[];
        
        // Draw radar centered around the ship
        this.radarRenderer.drawRadar(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship
        );
        
        // Draw collectibles using the collectibles renderer
        this.collectiblesRenderer.drawCollectibles(
            ship, 
            collectibles, 
            this.world.getWidth(), 
            this.world.getHeight()
        );
        
        // Draw ship
        this.shipRenderer.drawShip(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship
        );
        
        // Draw tooltip for all objects
        this.tooltipRenderer.drawTooltip(
            this.world.getSpaceObjects(),
            ship
        );
    }
} 