import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
import { SpaceObject } from './SpaceObject';
import { GameRenderer } from './GameRenderer';

class Game {
    private canvas: HTMLCanvasElement;
    private clickCounter: number;
    private clickCounterElement: HTMLElement;
    private ship: Ship;
    private speedElement: HTMLElement;
    private coordinatesElement: HTMLElement;
    private lastTime: number;
    private spaceObjects: SpaceObject[];
    private gameRenderer: GameRenderer;
    private mouseX: number;
    private mouseY: number;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
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

        this.gameRenderer = new GameRenderer(this.canvas);

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

    private gameLoop(): void {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Draw background
        this.gameRenderer.drawBackground();

        // Draw radar
        this.gameRenderer.drawRadar(this.ship);

        // Update all space objects
        this.spaceObjects.forEach(obj => obj.updatePosition(deltaTime));

        // Update hover states
        this.updateHoverState();

        // Draw the spaceship
        this.gameRenderer.drawShip(this.ship);

        // Draw the asteroids
        this.gameRenderer.drawAsteroids(
            this.ship,
            this.spaceObjects.filter(obj => obj instanceof Asteroid) as Asteroid[]
        );

        // Draw tooltip for hovered object
        this.gameRenderer.drawTooltip(this.spaceObjects, this.ship);

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