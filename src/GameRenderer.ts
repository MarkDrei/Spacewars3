import { Ship } from './Ship';
import { SpaceObject } from './SpaceObject';
import { AsteroidRenderer } from './AsteroidRenderer';
import { ShipRenderer } from './ShipRenderer';
import { RadarRenderer } from './RadarRenderer';
import { TooltipRenderer } from './TooltipRenderer';

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private asteroidRenderer: AsteroidRenderer;
    private shipRenderer: ShipRenderer;
    private radarRenderer: RadarRenderer;
    private tooltipRenderer: TooltipRenderer;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.asteroidRenderer = new AsteroidRenderer();
        this.shipRenderer = new ShipRenderer();
        this.radarRenderer = new RadarRenderer();
        this.tooltipRenderer = new TooltipRenderer(canvas);
    }

    drawBackground(): void {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw a dark mode background
        this.ctx.fillStyle = '#121212';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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
        this.asteroidRenderer.drawAsteroids(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            ship.getX(),
            ship.getY(),
            objects
        );
    }

    drawTooltip(spaceObjects: SpaceObject[], ship: Ship): void {
        this.tooltipRenderer.drawTooltip(spaceObjects, ship);
    }
} 