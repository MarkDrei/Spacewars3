import { Ship } from '../game/Ship';
import { SpaceObjectOld } from '../game/SpaceObject';
import { PlayerShipRenderer } from './PlayerShipRenderer';
import { RadarRenderer } from './RadarRenderer';
import { TooltipRenderer } from './TooltipRenderer';
import { World } from '../game/World';
import { SpaceObjectsRenderer } from './SpaceObjectsRenderer';
import { TargetingLineRenderer } from './TargetingLineRenderer';
import type { TargetingLine } from '@shared/types/gameTypes';
import { debugState } from '../debug/debugState';

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private world: World;
    private playerShipRenderer: PlayerShipRenderer;
    private radarRenderer: RadarRenderer;
    private tooltipRenderer: TooltipRenderer;
    private collectiblesRenderer: SpaceObjectsRenderer;
    private targetingLineRenderer: TargetingLineRenderer;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, world: World) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.world = world;
        // Get initial ship image index from ship
        const ship = world.getShip();
        const shipImageIndex = ship.getShipImageIndex() || 1;
        this.playerShipRenderer = new PlayerShipRenderer(shipImageIndex);
        this.radarRenderer = new RadarRenderer();
        this.tooltipRenderer = new TooltipRenderer(canvas);
        this.collectiblesRenderer = new SpaceObjectsRenderer(ctx, canvas);
        this.targetingLineRenderer = new TargetingLineRenderer(ctx);
    }

    /**
     * Update the ship image when world data changes (e.g., after user changes ship on profile page)
     */
    updateShipImage(): void {
        const ship = this.world.getShip();
        const shipImageIndex = ship.getShipImageIndex() || 1;
        this.playerShipRenderer.updateShipImage(shipImageIndex);
    }

    drawBackground(): void {
        // Fill background with black
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackgroundElements(): void {
        // Draw grid
        this.drawGrid();
        
        // Draw world boundaries
        this.drawWorldBoundaries();
    }

    private drawGrid(): void {
        const gridSize = 50;
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 1;
        
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
    }
    
    // Draw the world boundaries with a green color
    private drawWorldBoundaries(): void {
        if (!debugState.debugDrawingsEnabled) return;
        
        const ship = this.world.getShip();
        const shipX = ship.getX();
        const shipY = ship.getY();
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const worldWidth = this.world.getWidth();
        const worldHeight = this.world.getHeight();

        // Calculate the screen coordinates of the world boundaries
        const leftEdgeX = centerX - shipX;
        const topEdgeY = centerY - shipY;

        // Draw the world boundaries with a more visible style
        this.ctx.strokeStyle = '#214923ff'; // Green color for boundaries
        this.ctx.lineWidth = 2;

        // Draw the boundary rectangle
        this.ctx.beginPath();
        this.ctx.rect(leftEdgeX, topEdgeY, worldWidth, worldHeight);
        this.ctx.stroke();
    }

    drawRadar(ship: Ship): void {
        this.radarRenderer.drawRadar(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship
        );
    }

    drawTooltip(spaceObjects: SpaceObjectOld[], ship: Ship): void {
        this.tooltipRenderer.drawTooltip(spaceObjects, ship);
    }

    drawWorld(ship: Ship, targetingLine: TargetingLine | null = null): void {
        // Clear the canvas and draw space background
        this.drawBackground();
        
        // Set up circular clipping for all game content
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY);
        
        // Save context state
        this.ctx.save();
        
        // Create circular clipping path
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        this.ctx.clip();
        
        // Draw background elements (grid and world boundaries) inside the clipped area
        this.drawBackgroundElements();
        
        // Get collectibles and ships
        const objects = this.world.getSpaceObjects();
        const nonPlayerObjects = objects.filter(obj => !(obj instanceof Ship && obj.getId() === ship.getId()));
        // convert to SpaceObjects
        const spaceObjects = nonPlayerObjects.map(obj => obj.getServerData());
        
        // Draw radar centered around the player ship (now clipped to circle)
        this.radarRenderer.drawRadar(
            this.ctx,
            centerX,
            centerY,
            ship
        );
        
        // Draw collectibles using the collectibles renderer (now clipped to circle)
        this.collectiblesRenderer.drawSpaceObjects(
            ship, 
            spaceObjects, 
            this.world.getWidth(), 
            this.world.getHeight()
        );
        
        // Draw targeting line if present (before player ship so it appears underneath)
        if (targetingLine) {
            this.targetingLineRenderer.drawTargetingLine(
                targetingLine,
                centerX,
                centerY,
                ship.getX(),
                ship.getY()
            );
        }
        
        // Update ship image if needed, then draw player's ship in the center
        const shipImageIndex = ship.getShipImageIndex() || 1;
        this.playerShipRenderer.updateShipImage(shipImageIndex);
        this.playerShipRenderer.drawPlayerShip(
            this.ctx,
            centerX,
            centerY,
            ship
        );
        
        // Restore context state (removes clipping)
        this.ctx.restore();
        
        // Draw tooltip for all objects (outside the clipped area, so they can extend beyond)
        this.tooltipRenderer.drawTooltip(
            this.world.getSpaceObjects(),
            ship
        );
    }
}