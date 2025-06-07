import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
import { AsteroidRenderer } from './AsteroidRenderer';
import { ShipRenderer } from './ShipRenderer';

class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private clickCounter: number;
    private clickCounterElement: HTMLElement;
    private ship: Ship;
    private speedElement: HTMLElement;
    private coordinatesElement: HTMLElement;
    private lastTime: number;
    private asteroids: Asteroid[];
    private asteroidRenderer: AsteroidRenderer;
    private shipRenderer: ShipRenderer;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.clickCounter = 0;
        this.clickCounterElement = document.getElementById('clickCounter')!;
        this.ship = new Ship();
        this.speedElement = document.getElementById('speed')!;
        this.coordinatesElement = document.getElementById('coordinates')!;
        this.lastTime = performance.now();
        this.asteroids = [
            new Asteroid(-100, -100, 0, 10), // 0 degrees
            new Asteroid(-100, -100, 180, 10), // 180 degrees
            // new Asteroid(100, 100, 45), // 45 degrees
            // new Asteroid(200, 200, 90), // 90 degrees
            new Asteroid(0, 0, 0, 15), // Flying towards each other
            new Asteroid(100, 0, 180, 15) // Flying towards each other
        ];
        this.asteroidRenderer = new AsteroidRenderer();
        this.shipRenderer = new ShipRenderer();

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
    }

    private updateHUD(): void {
        this.clickCounterElement.textContent = this.clickCounter.toString();
        this.speedElement.textContent = this.ship.getSpeed().toString();
        this.coordinatesElement.textContent = `(${Math.round(this.ship.getX())}, ${Math.round(this.ship.getY())})`;
    }

    private drawRadar(): void {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY);

        // Draw rings
        for (let radius = maxRadius / 4; radius <= maxRadius; radius += maxRadius / 4) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#4caf50';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw lines
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + maxRadius * Math.cos(angle), centerY + maxRadius * Math.sin(angle));
            ctx.strokeStyle = '#4caf50';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw coordinates
        const shipX = this.ship.getX();
        const shipY = this.ship.getY();
        const coordinateDistance = 200; // Only show coordinates within 200 units

        // Calculate the range of coordinates to show
        const minX = Math.floor((shipX - coordinateDistance) / 50) * 50;
        const maxX = Math.ceil((shipX + coordinateDistance) / 50) * 50;
        const minY = Math.floor((shipY - coordinateDistance) / 50) * 50;
        const maxY = Math.ceil((shipY + coordinateDistance) / 50) * 50;

        ctx.font = '12px Arial';
        ctx.fillStyle = '#4caf50';

        // Draw X coordinates
        ctx.textAlign = 'center';
        for (let x = minX; x <= maxX; x += 50) {
            if (x % 50 === 0) { // Only draw coordinates divisible by 50
                const screenX = centerX + (x - shipX);
                const screenY = centerY + 15; // Position below the center
                ctx.fillText(x.toString(), screenX, screenY);
            }
        }

        // Draw Y coordinates
        ctx.textAlign = 'right';
        for (let y = minY; y <= maxY; y += 50) {
            if (y % 50 === 0) { // Only draw coordinates divisible by 50
                const screenX = centerX - 15; // Position to the left of the center
                const screenY = centerY + (y - shipY);
                ctx.fillText(y.toString(), screenX, screenY);
            }
        }
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

        // Draw radar
        this.drawRadar();

        // Update ship position
        this.ship.updatePosition(deltaTime);

        // Update asteroid positions
        this.asteroids.forEach(asteroid => {
            asteroid.updatePosition(deltaTime);
        });

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
            this.asteroids
        );

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