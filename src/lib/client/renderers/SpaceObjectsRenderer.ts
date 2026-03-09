import { Ship } from '../game/Ship';
import { ShipwreckRenderer } from './ShipwreckRenderer';
import { EscapePodRenderer } from './EscapePodRenderer';
import { AsteroidRenderer } from './AsteroidRenderer';
import { SpaceObject } from '@shared/types';
import { OtherShipRenderer } from './OtherShipRenderer';
import { StarbaseRenderer } from './StarbaseRenderer';
import type { ViewportInfo } from './GameRenderer';

export class SpaceObjectsRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private shipwreckRenderer: ShipwreckRenderer;
    private escapePodRenderer: EscapePodRenderer;
    private asteroidRenderer: AsteroidRenderer;
    private shipRenderer: OtherShipRenderer;
    private starbaseRenderer: StarbaseRenderer;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.shipwreckRenderer = new ShipwreckRenderer();
        this.escapePodRenderer = new EscapePodRenderer();
        this.asteroidRenderer = new AsteroidRenderer();
        this.shipRenderer = new OtherShipRenderer();
        this.starbaseRenderer = new StarbaseRenderer();
    }

    /**
     * Draw collectible objects
     */
    drawSpaceObjects(ship: Ship, collectibles: SpaceObject[], worldWidth: number, worldHeight: number, viewportInfo?: ViewportInfo): void {
        // Draw the main collectibles first
        this.drawMainObjects(ship, collectibles, viewportInfo);
        
        // Now draw the wrapped collectibles
        this.drawWrappedObjects(ship, collectibles, worldWidth, worldHeight, viewportInfo);
    }
    
    /**
     * Draw the main collectible objects
     */
    private drawMainObjects(ship: Ship, collectibles: SpaceObject[], viewportInfo?: ViewportInfo): void {
        const centerX = viewportInfo ? viewportInfo.centerX : this.canvas.width / 2;
        const centerY = viewportInfo ? viewportInfo.centerY : this.canvas.height / 2;
        const shipX = ship.getX();
        const shipY = ship.getY();
        
        collectibles.forEach(collectible => {
            this.renderObject(collectible, centerX, centerY, shipX, shipY);
        });
    }
    
    /**
     * Render a single collectible at the specified position
     */
    private renderObject(
        collectible: SpaceObject, 
        screenX: number, 
        screenY: number, 
        shipX: number, 
        shipY: number,
        offsetX: number = 0,
        offsetY: number = 0
    ): void {
        if (collectible.type === 'shipwreck') {
            this.shipwreckRenderer.drawShipwreck(
                this.ctx,
                screenX + offsetX,
                screenY + offsetY,
                shipX,
                shipY,
                collectible
            );
        } else if (collectible.type === 'escape_pod') {
            this.escapePodRenderer.drawEscapePod(
                this.ctx,
                screenX + offsetX,
                screenY + offsetY,
                shipX,
                shipY,
                collectible
            );
        } else if (collectible.type === 'asteroid') {
            this.asteroidRenderer.drawAsteroid(
                this.ctx,
                screenX + offsetX,
                screenY + offsetY,
                shipX,
                shipY,
                collectible
            );
        } else if (collectible.type === 'player_ship') {
            this.shipRenderer.drawOtherShip(
                this.ctx,
                screenX + offsetX,
                screenY + offsetY,
                shipX,
                shipY,
                collectible
            );
        } else if (collectible.type === 'starbase') {
            this.starbaseRenderer.drawStarbase(
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
        // Add a margin to account for large objects (e.g. Starbase rendered at 250px radius)
        const margin = 250;
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
    private drawWrappedObjects(ship: Ship, collectibles: SpaceObject[], worldWidth: number, worldHeight: number, viewportInfo?: ViewportInfo): void {
        const centerX = viewportInfo ? viewportInfo.centerX : this.canvas.width / 2;
        const centerY = viewportInfo ? viewportInfo.centerY : this.canvas.height / 2;
        const shipX = ship.getX();
        const shipY = ship.getY();
        
        // Calculate visible area in world coordinates using ViewportInfo when available
        const halfW = viewportInfo ? viewportInfo.halfW : this.canvas.width / 2;
        const halfH = viewportInfo ? viewportInfo.halfH : this.canvas.height / 2;
        const visibleLeft = shipX - halfW;
        const visibleRight = shipX + halfW;
        const visibleTop = shipY - halfH;
        const visibleBottom = shipY + halfH;
        
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
            const collectibleX = collectible.x;
            const collectibleY = collectible.y;

            // Check all possible wrapped positions for each collectible
            wrapOffsets.forEach(offset => {
                const wrappedX = collectibleX + offset.x;
                const wrappedY = collectibleY + offset.y;
                
                // Only draw if it would be visible on screen
                if (this.isPositionVisible(wrappedX, wrappedY, visibleLeft, visibleRight, visibleTop, visibleBottom)) {
                    this.renderObject(collectible, centerX, centerY, shipX, shipY, offset.x, offset.y);
                }
            });
        });
    }
} 