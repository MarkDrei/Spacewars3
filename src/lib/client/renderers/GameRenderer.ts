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
import { BASE_VIEWPORT_WORLD_H, DEFAULT_ZOOM } from '@shared/viewportConstants';

/** Describes what portion of the world is currently visible on screen, in world units. */
export interface ViewportInfo {
    /** Canvas centre in world units (== ship position). */
    centerX: number;
    centerY: number;
    /** Half the visible width in world units. */
    halfW: number;
    /** Half the visible height in world units. */
    halfH: number;
}

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private world: World;
    private playerShipRenderer: PlayerShipRenderer;
    private radarRenderer: RadarRenderer;
    private tooltipRenderer: TooltipRenderer;
    private collectiblesRenderer: SpaceObjectsRenderer;
    private targetingLineRenderer: TargetingLineRenderer;
    private zoom: number = DEFAULT_ZOOM;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, world: World) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.world = world;
        this.playerShipRenderer = new PlayerShipRenderer();
        this.radarRenderer = new RadarRenderer();
        this.tooltipRenderer = new TooltipRenderer(canvas);
        this.collectiblesRenderer = new SpaceObjectsRenderer(ctx, canvas);
        this.targetingLineRenderer = new TargetingLineRenderer(ctx);
    }

    /** Set the zoom level (>1 zooms out, showing more world; <1 zooms in). */
    setZoom(zoom: number): void {
        this.zoom = zoom;
    }

    /**
     * Returns the current world-scale: CSS pixels per world unit.
     * Computed as (cssHeight / BASE_VIEWPORT_WORLD_H) / zoom.
     */
    getWorldScale(): number {
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const cssH = this.canvas.height / dpr;
        return (cssH / BASE_VIEWPORT_WORLD_H) / this.zoom;
    }

    drawBackground(): void {
        // Fill background with black
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackgroundElements(centerX: number, centerY: number, halfW: number, halfH: number): void {
        // Draw grid
        this.drawGrid(centerX, centerY, halfW, halfH);
        
        // Draw world boundaries
        this.drawWorldBoundaries(centerX, centerY);
    }

    private drawGrid(centerX: number, centerY: number, halfW: number, halfH: number): void {
        const gridSize = 50;
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 1;
        
        const shipX = this.world.getShip().getX();
        const shipY = this.world.getShip().getY();
        
        // Visible area in world coordinates
        const visibleLeft = shipX - halfW;
        const visibleRight = shipX + halfW;
        const visibleTop = shipY - halfH;
        const visibleBottom = shipY + halfH;
        
        // Draw vertical grid lines
        for (let x = Math.floor(visibleLeft / gridSize) * gridSize; x <= visibleRight; x += gridSize) {
            const screenX = centerX + (x - shipX);
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, centerY - halfH);
            this.ctx.lineTo(screenX, centerY + halfH);
            this.ctx.stroke();
        }
        
        // Draw horizontal grid lines
        for (let y = Math.floor(visibleTop / gridSize) * gridSize; y <= visibleBottom; y += gridSize) {
            const screenY = centerY + (y - shipY);
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - halfW, screenY);
            this.ctx.lineTo(centerX + halfW, screenY);
            this.ctx.stroke();
        }
    }
    
    // Draw the world boundaries with a green color
    private drawWorldBoundaries(centerX: number, centerY: number): void {
        if (!debugState.debugDrawingsEnabled) return;
        
        const ship = this.world.getShip();
        const shipX = ship.getX();
        const shipY = ship.getY();
        const worldWidth = this.world.getWidth();
        const worldHeight = this.world.getHeight();

        // Calculate the screen coordinates of the world boundaries (in world units after transform)
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

    drawTooltip(spaceObjects: SpaceObjectOld[], ship: Ship, worldScale?: number): void {
        this.tooltipRenderer.drawTooltip(spaceObjects, ship, worldScale);
    }

    drawWorld(ship: Ship, targetingLine: TargetingLine | null = null): void {
        this.drawBackground();

        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const worldScale = this.getWorldScale();

        const cssW = this.canvas.width / dpr;
        const cssH = this.canvas.height / dpr;
        const centerX = (cssW / 2) / worldScale;
        const centerY = (cssH / 2) / worldScale;
        const halfW = centerX;
        const halfH = centerY;
        const viewportInfo: ViewportInfo = { centerX, centerY, halfW, halfH };

        this.ctx.save();
        this.ctx.scale(dpr * worldScale, dpr * worldScale);

        this.drawBackgroundElements(centerX, centerY, halfW, halfH);

        const objects = this.world.getSpaceObjects();
        const nonPlayerObjects = objects.filter(obj => !(obj instanceof Ship && obj.getId() === ship.getId()));
        const spaceObjects = nonPlayerObjects
            .sort((a, b) => (a.getType() === 'starbase' ? -1 : b.getType() === 'starbase' ? 1 : 0))
            .map(obj => obj.getServerData());

        this.radarRenderer.drawRadar(this.ctx, centerX, centerY, ship);

        this.collectiblesRenderer.drawSpaceObjects(
            ship, spaceObjects, this.world.getWidth(), this.world.getHeight(), viewportInfo
        );

        if (targetingLine) {
            this.targetingLineRenderer.drawTargetingLine(
                targetingLine, centerX, centerY, ship.getX(), ship.getY()
            );
        }

        this.playerShipRenderer.drawPlayerShip(this.ctx, centerX, centerY, ship);

        this.ctx.restore();

        // Tooltip is drawn after restore, in physical pixel space
        this.tooltipRenderer.drawTooltip(this.world.getSpaceObjects(), ship, worldScale);
    }
}