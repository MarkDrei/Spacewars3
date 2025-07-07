import { GameRenderer } from './renderers/GameRenderer';
import { World } from './World';
import { WorldInitializer } from './WorldInitializer';
import { Shipwreck } from './Shipwreck';
import { EscapePod } from './EscapePod';

class Game {
    private canvas: HTMLCanvasElement;
    private clickCounter: number;
    private clickCounterElement: HTMLElement;
    private speedElement: HTMLElement;
    private coordinatesElement: HTMLElement;
    private gameRenderer: GameRenderer;
    private mouseX: number;
    private mouseY: number;
    private world: World;
    private scoreElement: HTMLElement | null;
    private lastCollectedElement: HTMLElement | null;
    private inventoryListElement: HTMLElement | null;
    private ctx: CanvasRenderingContext2D;
    private lastFrameTime: number = 0;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.clickCounter = 0;
        this.clickCounterElement = document.getElementById('clickCounter')!;
        this.speedElement = document.getElementById('speed')!;
        this.coordinatesElement = document.getElementById('coordinates')!;
        // Initialize time tracking with the current time
        this.lastFrameTime = performance.now();
        this.mouseX = 0;
        this.mouseY = 0;
        this.scoreElement = document.getElementById('score');
        this.lastCollectedElement = document.getElementById('last-collected');
        this.inventoryListElement = document.getElementById('inventory-list');
        
        // Get canvas context - using non-null assertion since we know the canvas exists
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        this.ctx = ctx;
        
        // Initialize world (default for now)
        this.world = WorldInitializer.createDefaultWorld();
        
        // Initialize renderer with the world
        this.gameRenderer = new GameRenderer(
            this.ctx,
            this.canvas,
            this.world
        );
        
        // Try to load world from configuration
        this.loadWorld();
        
        this.initializeEventListeners();
        this.initializeGame();
    }
    
    private async loadWorld(): Promise<void> {
        try {
            // Load a custom world configuration - use path relative to public folder for browser
            const world = await WorldInitializer.loadWorldFromFile('./src/worlds/test_world.json');
            
            if (world) {
                this.world = world;
                
                // If we successfully loaded a new world, update the renderer
                this.gameRenderer = new GameRenderer(
                    this.ctx,
                    this.canvas,
                    this.world
                );
            }
        } catch (error) {
            console.error('Failed to load world configuration:', error);
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

    private initializeGame(): void {
        // Initialize world
        this.world = WorldInitializer.createDefaultWorld();
        
        // Initialize renderer
        this.gameRenderer = new GameRenderer(
            this.ctx,
            this.canvas,
            this.world
        );
        
        // Start the game loop
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    private updateHUD(): void {
        const ship = this.world.getShip();
        this.clickCounterElement.textContent = this.clickCounter.toString();
        this.speedElement.textContent = ship.getSpeed().toString();
        this.coordinatesElement.textContent = `(${Math.round(ship.getX())}, ${Math.round(ship.getY())})`;
        
        // Add score to HUD
        if (this.scoreElement) {
            this.scoreElement.textContent = this.world.getScore().toString();
        }
        
        // Update last collected item display
        if (this.lastCollectedElement) {
            const lastCollected = this.world.getLastCollected();
            if (lastCollected) {
                let details = '';
                if (lastCollected instanceof Shipwreck) {
                    const salvageType = lastCollected.getSalvageType();
                    details = `Shipwreck (${salvageType}) - Value: ${lastCollected.getValue()}`;
                } else if (lastCollected instanceof EscapePod) {
                    const survivors = lastCollected.getSurvivors();
                    details = `Escape Pod (${survivors} survivors) - Value: ${lastCollected.getValue()}`;
                }
                this.lastCollectedElement.textContent = details;
            } else {
                this.lastCollectedElement.textContent = 'Nothing collected yet';
            }
        }
        
        // Update inventory display
        if (this.inventoryListElement) {
            const inventory = this.world.getInventory();
            
            // Sort inventory by most recent first
            const sortedInventory = [...inventory].sort((a, b) => b.timestamp - a.timestamp);
            
            // Clear current list
            this.inventoryListElement.innerHTML = '';
            
            // Add each item
            if (sortedInventory.length === 0) {
                this.inventoryListElement.textContent = 'No items collected';
            } else {
                sortedInventory.forEach(item => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'inventory-item';
                    
                    // Add specific class based on type
                    if (item.type === 'shipwreck' && item.salvageType) {
                        itemElement.classList.add(item.salvageType);
                    } else if (item.type === 'escape-pod') {
                        itemElement.classList.add('escape-pod');
                    }
                    
                    // Format the item details
                    let itemText = '';
                    if (item.type === 'shipwreck') {
                        itemText = `Shipwreck (${item.salvageType || 'generic'}) - ${item.value} pts`;
                    } else if (item.type === 'escape-pod') {
                        itemText = `Escape Pod - ${item.value} pts`;
                    }
                    
                    itemElement.textContent = itemText;
                    if (this.inventoryListElement) {
                        this.inventoryListElement.appendChild(itemElement);
                    }
                });
            }
        }
        
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
        const worldWidth = this.world.getWidth();
        const worldHeight = this.world.getHeight();
        
        // Calculate screen position of interception point
        const screenX = this.canvas.width / 2 + (interceptionData.interceptX - ship.getX());
        const screenY = this.canvas.height / 2 + (interceptionData.interceptY - ship.getY());
        
        // Helper function to check if a screen position is visible
        const isPositionVisible = (x: number, y: number): boolean => {
            const margin = 50; // Margin for interception marker size
            return (
                x > -margin && 
                x < this.canvas.width + margin && 
                y > -margin && 
                y < this.canvas.height + margin
            );
        };
        
        // Draw the main interception point if visible
        if (isPositionVisible(screenX, screenY)) {
            this.drawInterceptionMarker(ctx, screenX, screenY, timeRemaining);
        }
        
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
        
        // Draw wrapped interception points
        wrapOffsets.forEach(offset => {
            const wrappedScreenX = screenX + offset.x;
            const wrappedScreenY = screenY + offset.y;
            
            if (isPositionVisible(wrappedScreenX, wrappedScreenY)) {
                this.drawInterceptionMarker(ctx, wrappedScreenX, wrappedScreenY, timeRemaining);
            }
        });
    }
    
    private drawInterceptionMarker(ctx: CanvasRenderingContext2D, x: number, y: number, timeRemaining: number): void {
        ctx.save();
        
        // Draw a pulsing circle
        const pulseSize = 5 + 3 * Math.sin(performance.now() / 200);
        ctx.beginPath();
        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fill();
        
        // Draw crosshairs
        const crosshairSize = 10;
        ctx.beginPath();
        ctx.moveTo(x - crosshairSize, y);
        ctx.lineTo(x + crosshairSize, y);
        ctx.moveTo(x, y - crosshairSize);
        ctx.lineTo(x, y + crosshairSize);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw time remaining text
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${timeRemaining.toFixed(1)}s`, x, y - 15);
        
        ctx.restore();
    }

    private render(): void {
        const ship = this.world.getShip();
        
        // Draw the game world
        this.gameRenderer.drawWorld(ship);
        
        // Draw interception point if available
        this.drawInterceptionPoint(this.ctx);
    }

    private gameLoop(): void {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = currentTime;

        // Update the world
        this.world.update(deltaTime);

        // Update hover states
        this.updateHoverState();

        // Update HUD
        this.updateHUD();
        
        // Render the game
        this.render();
        
        // Request next frame
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// Start the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});