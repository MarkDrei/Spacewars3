import { Ship } from '../Ship';
import { SpaceObject } from '../SpaceObject';
import { AsteroidRenderer } from './AsteroidRenderer';
import { ShipRenderer } from './ShipRenderer';
import { RadarRenderer } from './RadarRenderer';
import { TooltipRenderer } from './TooltipRenderer';
import { World } from '../World';
import { Collectible } from '../Collectible';
import { ShipwreckRenderer } from './ShipwreckRenderer';
import { EscapePodRenderer } from './EscapePodRenderer';
import { Shipwreck } from '../Shipwreck';
import { EscapePod } from '../EscapePod';
import { Asteroid } from '../Asteroid';

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private world: World;
    private shipRenderer: ShipRenderer;
    private asteroidRenderer: AsteroidRenderer;
    private radarRenderer: RadarRenderer;
    private tooltipRenderer: TooltipRenderer;
    private shipwreckRenderer: ShipwreckRenderer;
    private escapePodRenderer: EscapePodRenderer;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, world: World) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.world = world;
        this.shipRenderer = new ShipRenderer();
        this.asteroidRenderer = new AsteroidRenderer();
        this.radarRenderer = new RadarRenderer();
        this.tooltipRenderer = new TooltipRenderer(canvas);
        this.shipwreckRenderer = new ShipwreckRenderer();
        this.escapePodRenderer = new EscapePodRenderer();
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

    drawTooltip(spaceObjects: SpaceObject[], ship: Ship): void {
        this.tooltipRenderer.drawTooltip(spaceObjects, ship);
    }

    drawWorld(ship: Ship): void {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the background
        this.drawBackground();
        
        // Get all space objects except the ship
        const objects = this.world.getSpaceObjects().filter(obj => obj !== ship);
        
        const collectibles = objects.filter(obj => obj instanceof Collectible) as Collectible[];
        
        // Draw collectibles 
        this.drawCollectibles(ship, collectibles);
        
        // Draw ship
        this.shipRenderer.drawShip(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship
        );
        
        // Draw radar centered around the ship
        this.radarRenderer.drawRadar(
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

    /**
     * Draw collectible objects
     */
    drawCollectibles(ship: Ship, collectibles: Collectible[]): void {
        // Draw the main collectibles first
        this.drawMainCollectibles(ship, collectibles);
        
        // Now draw the wrapped collectibles
        this.drawWrappedCollectibles(ship, collectibles);
    }
    
    /**
     * Draw the main collectible objects
     */
    private drawMainCollectibles(ship: Ship, collectibles: Collectible[]): void {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const shipX = ship.getX();
        const shipY = ship.getY();
        
        collectibles.forEach(collectible => {
            if (collectible instanceof Shipwreck) {
                this.shipwreckRenderer.drawCollectible(
                    this.ctx,
                    centerX,
                    centerY,
                    shipX,
                    shipY,
                    collectible
                );
            } else if (collectible instanceof EscapePod) {
                this.escapePodRenderer.drawCollectible(
                    this.ctx,
                    centerX,
                    centerY,
                    shipX,
                    shipY,
                    collectible
                );
            } else if (collectible instanceof Asteroid) {
                // Handle asteroid collectibles
                this.asteroidRenderer.drawAsteroid(
                    this.ctx,
                    centerX,
                    centerY,
                    shipX,
                    shipY,
                    collectible
                );
            }
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
    
    /**
     * Draw wrapped collectible objects
     */
    private drawWrappedCollectibles(ship: Ship, collectibles: Collectible[]): void {
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
        
        // Check each collectible
        collectibles.forEach(collectible => {
            const collectibleX = collectible.getX();
            const collectibleY = collectible.getY();
            
            // Check all possible wrapped positions for each collectible
            wrapOffsets.forEach(offset => {
                const wrappedX = collectibleX + offset.x;
                const wrappedY = collectibleY + offset.y;
                
                // Only draw if it would be visible on screen
                if (this.isPositionVisible(wrappedX, wrappedY, visibleLeft, visibleRight, visibleTop, visibleBottom)) {
                    if (collectible instanceof Shipwreck) {
                        this.shipwreckRenderer.drawCollectible(
                            this.ctx,
                            centerX + offset.x,
                            centerY + offset.y,
                            shipX,
                            shipY,
                            collectible
                        );
                    } else if (collectible instanceof EscapePod) {
                        this.escapePodRenderer.drawCollectible(
                            this.ctx,
                            centerX + offset.x,
                            centerY + offset.y,
                            shipX,
                            shipY,
                            collectible
                        );
                    } else if (collectible instanceof Asteroid) {
                        this.asteroidRenderer.drawAsteroid(
                            this.ctx,
                            centerX + offset.x,
                            centerY + offset.y,
                            shipX,
                            shipY,
                            collectible
                        );
                    }
                }
            });
        });
    }
} 