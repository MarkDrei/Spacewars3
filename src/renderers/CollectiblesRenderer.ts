import { Ship } from '../Ship';
import { Collectible } from '../Collectible';
import { Shipwreck } from '../Shipwreck';
import { EscapePod } from '../EscapePod';
import { Asteroid } from '../Asteroid';
import { ShipwreckRenderer } from './ShipwreckRenderer';
import { EscapePodRenderer } from './EscapePodRenderer';
import { AsteroidRenderer } from './AsteroidRenderer';

export class CollectiblesRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private shipwreckRenderer: ShipwreckRenderer;
    private escapePodRenderer: EscapePodRenderer;
    private asteroidRenderer: AsteroidRenderer;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.shipwreckRenderer = new ShipwreckRenderer();
        this.escapePodRenderer = new EscapePodRenderer();
        this.asteroidRenderer = new AsteroidRenderer();
    }

    /**
     * Draw collectible objects
     */
    drawCollectibles(ship: Ship, collectibles: Collectible[], worldWidth: number, worldHeight: number): void {
        // Draw the main collectibles first
        this.drawMainCollectibles(ship, collectibles);
        
        // Now draw the wrapped collectibles
        this.drawWrappedCollectibles(ship, collectibles, worldWidth, worldHeight);
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
            this.renderCollectible(collectible, centerX, centerY, shipX, shipY);
        });
    }
    
    /**
     * Render a single collectible at the specified position
     */
    private renderCollectible(
        collectible: Collectible, 
        screenX: number, 
        screenY: number, 
        shipX: number, 
        shipY: number,
        offsetX: number = 0,
        offsetY: number = 0
    ): void {
        if (collectible instanceof Shipwreck) {
            this.shipwreckRenderer.drawCollectible(
                this.ctx,
                screenX + offsetX,
                screenY + offsetY,
                shipX,
                shipY,
                collectible
            );
        } else if (collectible instanceof EscapePod) {
            this.escapePodRenderer.drawCollectible(
                this.ctx,
                screenX + offsetX,
                screenY + offsetY,
                shipX,
                shipY,
                collectible
            );
        } else if (collectible instanceof Asteroid) {
            this.asteroidRenderer.drawCollectible(
                this.ctx,
                screenX + offsetX,
                screenY + offsetY,
                shipX,
                shipY,
                collectible
            );
        }
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
    private drawWrappedCollectibles(ship: Ship, collectibles: Collectible[], worldWidth: number, worldHeight: number): void {
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
                    this.renderCollectible(collectible, centerX, centerY, shipX, shipY, offset.x, offset.y);
                }
            });
        });
    }
} 