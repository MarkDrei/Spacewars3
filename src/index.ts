import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
import { SpaceObject } from './SpaceObject';
import { GameRenderer } from './GameRenderer';
import { InterceptCalculator } from './InterceptCalculator';

interface InterceptionData {
    targetObject: SpaceObject;
    interceptTime: number;
    interceptX: number;
    interceptY: number;
    shipAngle: number;
    timestamp: number;
}

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
    private interceptionData: InterceptionData | null = null;

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
            
            // Check if any object is hovered
            const hoveredObject = this.spaceObjects.find(obj => obj !== this.ship && obj.isHoveredState());
            
            if (hoveredObject) {
                // If a space object is hovered, intercept it
                const interceptAngle = InterceptCalculator.calculateInterceptAngle(this.ship, hoveredObject);
                this.ship.setAngle(interceptAngle);
                
                // Calculate interception point for visualization
                const targetSpeed = hoveredObject.getSpeed();
                const targetAngle = hoveredObject.getAngle();
                const shipSpeed = this.ship.getSpeed();
                
                // Calculate velocities
                const targetVelX = targetSpeed * Math.cos(targetAngle);
                const targetVelY = targetSpeed * Math.sin(targetAngle);
                const shipVelX = shipSpeed * Math.cos(interceptAngle);
                const shipVelY = shipSpeed * Math.sin(interceptAngle);
                
                // Calculate relative positions
                const relativeX = hoveredObject.getX() - this.ship.getX();
                const relativeY = hoveredObject.getY() - this.ship.getY();
                
                // Calculate relative velocity
                const relVelX = shipVelX - targetVelX;
                const relVelY = shipVelY - targetVelY;
                
                // Calculate quadratic equation coefficients
                const a = relVelX * relVelX + relVelY * relVelY;
                const b = 2 * (relativeX * relVelX + relativeY * relVelY);
                const c = relativeX * relativeX + relativeY * relativeY;
                
                // Calculate discriminant
                const discriminant = b * b - 4 * a * c;
                
                // If interception is possible
                if (discriminant >= 0) {
                    // Calculate interception time (smaller positive root)
                    const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                    const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
                    
                    let interceptTime = Number.MAX_VALUE;
                    if (t1 > 0) interceptTime = t1;
                    if (t2 > 0 && t2 < interceptTime) interceptTime = t2;
                    
                    if (interceptTime !== Number.MAX_VALUE) {
                        // Calculate future positions
                        const futureTargetX = hoveredObject.getX() + targetVelX * interceptTime;
                        const futureTargetY = hoveredObject.getY() + targetVelY * interceptTime;
                        
                        // Store interception data
                        this.interceptionData = {
                            targetObject: hoveredObject,
                            interceptTime: interceptTime,
                            interceptX: futureTargetX,
                            interceptY: futureTargetY,
                            shipAngle: interceptAngle,
                            timestamp: performance.now()
                        };
                        
                        console.log(`Interception point set: (${futureTargetX.toFixed(2)}, ${futureTargetY.toFixed(2)}) in ${interceptTime.toFixed(2)} seconds`);
                    }
                }
            } else {
                // If no object is hovered, use the regular click-to-aim behavior
                const rect = this.canvas.getBoundingClientRect();
                const centerX = this.canvas.width / 2;
                const centerY = this.canvas.height / 2;
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;
                const dx = mouseX - centerX;
                const dy = mouseY - centerY;
                this.ship.setAngle(Math.atan2(dy, dx));
                
                // Clear any interception data
                this.interceptionData = null;
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
        this.clickCounterElement.textContent = this.clickCounter.toString();
        this.speedElement.textContent = this.ship.getSpeed().toString();
        this.coordinatesElement.textContent = `(${Math.round(this.ship.getX())}, ${Math.round(this.ship.getY())})`;
        
        // Add interception data to HUD if available
        if (this.interceptionData) {
            const timeRemaining = Math.max(0, this.interceptionData.interceptTime - (performance.now() - this.interceptionData.timestamp) / 1000);
            console.log(`Time to interception: ${timeRemaining.toFixed(2)} seconds`);
        }
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

    private drawInterceptionPoint(ctx: CanvasRenderingContext2D): void {
        if (!this.interceptionData) return;
        
        // Calculate time elapsed since interception was calculated
        const timeElapsed = (performance.now() - this.interceptionData.timestamp) / 1000;
        const timeRemaining = this.interceptionData.interceptTime - timeElapsed;
        
        // If the interception time has passed, clear the data
        if (timeRemaining <= 0) {
            this.interceptionData = null;
            return;
        }
        
        // Calculate screen position of interception point
        const screenX = this.canvas.width / 2 + (this.interceptionData.interceptX - this.ship.getX());
        const screenY = this.canvas.height / 2 + (this.interceptionData.interceptY - this.ship.getY());
        
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
        
        // Get canvas context for drawing interception point
        const ctx = this.canvas.getContext('2d')!;
        
        // Draw interception point if available
        this.drawInterceptionPoint(ctx);

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