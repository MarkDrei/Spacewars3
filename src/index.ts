import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
import { AsteroidRenderer } from './AsteroidRenderer';
import { ShipRenderer } from './ShipRenderer';
import { RadarRenderer } from './RadarRenderer';
import { SpaceObject } from './SpaceObject';

class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private clickCounter: number;
    private clickCounterElement: HTMLElement;
    private ship: Ship;
    private speedElement: HTMLElement;
    private coordinatesElement: HTMLElement;
    private lastTime: number;
    private spaceObjects: SpaceObject[];
    private asteroidRenderer: AsteroidRenderer;
    private shipRenderer: ShipRenderer;
    private radarRenderer: RadarRenderer;
    private mouseX: number;
    private mouseY: number;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.clickCounter = 0;
        this.clickCounterElement = document.getElementById('clickCounter')!;
        this.ship = new Ship();
        this.speedElement = document.getElementById('speed')!;
        this.coordinatesElement = document.getElementById('coordinates')!;
        this.lastTime = performance.now();
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Initialize space objects
        this.spaceObjects = [
            this.ship,
            new Asteroid(-100, -100, 0, 10), // 0 degrees
            new Asteroid(-100, -100, 180, 10), // 180 degrees
            // new Asteroid(100, 100, 45), // 45 degrees
            // new Asteroid(200, 200, 90), // 90 degrees
            new Asteroid(0, 0, 0, 15), // Flying towards each other
            new Asteroid(100, 0, 180, 15) // Flying towards each other
        ];

        this.asteroidRenderer = new AsteroidRenderer();
        this.shipRenderer = new ShipRenderer();
        this.radarRenderer = new RadarRenderer();

        this.initializeEventListeners();
        this.gameLoop();
    }

    private initializeEventListeners(): void {
        this.canvas.addEventListener('click', (event) => {
            this.clickCounter++;
            this.updateHUD();
            // Calculate angle from center to click
            const rect = this.canvas.getBoundingClientRect();
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const dx = mouseX - centerX;
            const dy = mouseY - centerY;
            this.ship.setAngle(Math.atan2(dy, dx));
        });

        // Add mouse move listener for hover detection
        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = event.clientX - rect.left;
            this.mouseY = event.clientY - rect.top;
        });
    }

    private updateHUD(): void {
        this.clickCounterElement.textContent = this.clickCounter.toString();
        this.speedElement.textContent = this.ship.getSpeed().toString();
        this.coordinatesElement.textContent = `(${Math.round(this.ship.getX())}, ${Math.round(this.ship.getY())})`;
    }

    private updateHoverState(): void {
        // Convert mouse coordinates to world coordinates
        const worldMouseX = this.mouseX - this.canvas.width / 2 + this.ship.getX();
        const worldMouseY = this.mouseY - this.canvas.height / 2 + this.ship.getY();

        // Update hover state for all space objects
        this.spaceObjects.forEach(obj => {
            obj.setHovered(obj.isPointInHoverRadius(worldMouseX, worldMouseY));
        });
    }

    private calculateDistanceToShip(object: SpaceObject): number {
        if (object === this.ship) return 0;
        
        const dx = object.getX() - this.ship.getX();
        const dy = object.getY() - this.ship.getY();
        return Math.sqrt(dx * dx + dy * dy);
    }

    private drawTooltip(): void {
        // Find the first hovered object
        const hoveredObject = this.spaceObjects.find(obj => obj.isHoveredState());
        
        if (!hoveredObject) return;
        
        // Calculate screen position for the tooltip
        let screenX: number;
        let screenY: number;
        
        if (hoveredObject === this.ship) {
            screenX = this.canvas.width / 2;
            screenY = this.canvas.height / 2;
        } else {
            screenX = this.canvas.width / 2 + hoveredObject.getX() - this.ship.getX();
            screenY = this.canvas.height / 2 + hoveredObject.getY() - this.ship.getY();
        }
        
        // Get object type
        const objectType = hoveredObject === this.ship ? "Ship" : "Asteroid";
        
        // Calculate distance to ship
        const distance = this.calculateDistanceToShip(hoveredObject);
        
        // Format angle in degrees (0-360)
        const angleDegrees = Math.round((hoveredObject.getAngle() * 180 / Math.PI + 360) % 360);
        
        // Prepare tooltip text
        const tooltipText = [
            `Type: ${objectType}`,
            `Speed: ${hoveredObject.getSpeed()}`,
            `Angle: ${angleDegrees}°`,
            `Distance: ${Math.round(distance)}`
        ];
        
        // Draw tooltip background
        const padding = 5;
        const lineHeight = 20;
        const tooltipWidth = 150;
        const tooltipHeight = tooltipText.length * lineHeight + padding * 2;
        
        // Position tooltip to avoid going off-screen
        const tooltipX = Math.min(screenX + 30, this.canvas.width - tooltipWidth - 5);
        const tooltipY = Math.min(screenY - tooltipHeight - 10, this.canvas.height - tooltipHeight - 5);
        
        // Draw tooltip background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        
        tooltipText.forEach((line, index) => {
            this.ctx.fillText(
                line, 
                tooltipX + padding, 
                tooltipY + padding + (index + 1) * lineHeight - 5
            );
        });
    }

    private gameLoop(): void {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw a dark mode background
        this.ctx.fillStyle = '#121212';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw radar using the renderer
        this.radarRenderer.drawRadar(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.ship
        );

        // Update all space objects
        this.spaceObjects.forEach(obj => obj.updatePosition(deltaTime));

        // Update hover states
        this.updateHoverState();

        // Draw the spaceship using the renderer
        this.shipRenderer.drawShip(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.ship
        );

        // Draw the asteroids using the renderer
        this.asteroidRenderer.drawAsteroids(
            this.ctx,
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.ship.getX(),
            this.ship.getY(),
            this.spaceObjects.filter(obj => obj instanceof Asteroid) as Asteroid[]
        );

        // Draw tooltip for hovered object
        this.drawTooltip();

        // Update HUD
        this.updateHUD();

        // Request the next frame
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    new Game();
}); 