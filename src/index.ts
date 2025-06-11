import { GameRenderer } from './renderers/GameRenderer';
import { World } from './World';
import { WorldInitializer } from './WorldInitializer';

class Game {
    private canvas: HTMLCanvasElement;
    private clickCounter: number;
    private clickCounterElement: HTMLElement;
    private speedElement: HTMLElement;
    private coordinatesElement: HTMLElement;
    private lastTime: number;
    private gameRenderer: GameRenderer;
    private mouseX: number;
    private mouseY: number;
    private world: World;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.clickCounter = 0;
        this.clickCounterElement = document.getElementById('clickCounter')!;
        this.speedElement = document.getElementById('speed')!;
        this.coordinatesElement = document.getElementById('coordinates')!;
        this.lastTime = performance.now();
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Initialize renderer
        this.gameRenderer = new GameRenderer(this.canvas);

        // Initialize world (default for now)
        this.world = WorldInitializer.createDefaultWorld();
        
        // Try to load world from configuration
        this.loadWorld();
        
        this.initializeEventListeners();
        this.gameLoop();
    }
    
    private async loadWorld(): Promise<void> {
        try {
            // Try to load the world from the configuration file
            this.world = await WorldInitializer.loadWorldFromFile('./worlds/default.json');
        } catch (error) {
            console.error('Failed to load world configuration:', error);
            // Keep using the default world if loading fails
        }
    }

    private initializeEventListeners(): void {
        this.canvas.addEventListener('click', (event) => {
            this.clickCounter++;
            this.updateHUD();
            
            // Check if any object is hovered
            const hoveredObject = this.world.findHoveredObject();
            
            if (hoveredObject) {
                // If a space object is hovered, intercept it
                this.world.interceptObject(hoveredObject);
            } else {
                // If no object is hovered, use the regular click-to-aim behavior
                const rect = this.canvas.getBoundingClientRect();
                const centerX = this.canvas.width / 2;
                const centerY = this.canvas.height / 2;
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;
                const dx = mouseX - centerX;
                const dy = mouseY - centerY;
                this.world.setShipAngle(Math.atan2(dy, dx));
            }
        });

        // Add mouse move listener for hover detection
        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = event.clientX - rect.left;
            this.mouseY = event.clientY - rect.top;
        });
    }

    private updateHUD(): void {
        const ship = this.world.getShip();
        this.clickCounterElement.textContent = this.clickCounter.toString();
        this.speedElement.textContent = ship.getSpeed().toString();
        this.coordinatesElement.textContent = `(${Math.round(ship.getX())}, ${Math.round(ship.getY())})`;
        
        // Add interception data to HUD if available
        const interceptionData = this.world.getInterceptionData();
        if (interceptionData) {
            const timeElapsed = (performance.now() - interceptionData.timestamp) / 1000;
            const timeRemaining = Math.max(0, interceptionData.interceptTime - timeElapsed);
            console.log(`Time to interception: ${timeRemaining.toFixed(2)} seconds`);
        }
    }

    private updateHoverState(): void {
        // Convert mouse coordinates to world coordinates
        const ship = this.world.getShip();
        const worldMouseX = this.mouseX - this.canvas.width / 2 + ship.getX();
        const worldMouseY = this.mouseY - this.canvas.height / 2 + ship.getY();

        // Update hover states for all objects
        this.world.updateHoverStates(worldMouseX, worldMouseY);
    }

    private drawInterceptionPoint(ctx: CanvasRenderingContext2D): void {
        const interceptionData = this.world.getInterceptionData();
        if (!interceptionData) return;
        
        // Calculate time elapsed since interception was calculated
        const timeElapsed = (performance.now() - interceptionData.timestamp) / 1000;
        const timeRemaining = interceptionData.interceptTime - timeElapsed;
        
        // If the interception time has passed, return (world.update will clear it)
        if (timeRemaining <= 0) {
            return;
        }
        
        const ship = this.world.getShip();
        
        // Calculate screen position of interception point
        const screenX = this.canvas.width / 2 + (interceptionData.interceptX - ship.getX());
        const screenY = this.canvas.height / 2 + (interceptionData.interceptY - ship.getY());
        
        // Draw the interception point
        ctx.save();
        
        // Draw a pulsing circle
        const pulseSize = 5 + 3 * Math.sin(performance.now() / 200);
        ctx.beginPath();
        ctx.arc(screenX, screenY, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fill();
        
        // Draw crosshairs
        const crosshairSize = 10;
        ctx.beginPath();
        ctx.moveTo(screenX - crosshairSize, screenY);
        ctx.lineTo(screenX + crosshairSize, screenY);
        ctx.moveTo(screenX, screenY - crosshairSize);
        ctx.lineTo(screenX, screenY + crosshairSize);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw time remaining text
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${timeRemaining.toFixed(1)}s`, screenX, screenY - 15);
        
        ctx.restore();
    }

    private gameLoop(): void {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Update the world
        this.world.update(deltaTime);

        // Update hover states
        this.updateHoverState();

        // Draw background
        this.gameRenderer.drawBackground();

        // Draw radar
        this.gameRenderer.drawRadar(this.world.getShip());

        // Draw the spaceship
        this.gameRenderer.drawShip(this.world.getShip());

        // Get asteroids from the world (filter space objects to get only asteroids)
        const asteroids = this.world.getSpaceObjects().filter(obj => obj !== this.world.getShip());
        
        // Draw the asteroids
        this.gameRenderer.drawAsteroids(
            this.world.getShip(),
            asteroids
        );
        
        // Get canvas context for drawing interception point
        const ctx = this.canvas.getContext('2d')!;
        
        // Draw interception point if available
        this.drawInterceptionPoint(ctx);
        
        // Draw tooltips
        this.gameRenderer.drawTooltip(this.world.getSpaceObjects(), this.world.getShip());
        
        // Update HUD
        this.updateHUD();
        
        // Request next frame
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Game();
}); 