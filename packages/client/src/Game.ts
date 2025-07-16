// Main Game class
import { World } from './World';
import { GameRenderer } from './renderers/GameRenderer';
import { WorldInitializer } from './WorldInitializer';
import { Ship } from './Ship';
import { Shipwreck } from './Shipwreck';
import { EscapePod } from './EscapePod';

export class Game {
  private world: World;
  private renderer: GameRenderer;
  private lastTimestamp: number = 0;
  private running: boolean = false;
  private ctx: CanvasRenderingContext2D;
  private ship: Ship;

  constructor(canvas: HTMLCanvasElement) {
    // Initialize the canvas context
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    
    // Initialize the world using the static method
    this.world = WorldInitializer.createDefaultWorld();
    
    // Get the player's ship using the getter method
    this.ship = this.world.getShip();
    
    // Initialize the renderer
    this.renderer = new GameRenderer(this.ctx, canvas, this.world);
    
    // Initialize click handlers
    this.initializeClickHandler(canvas);
  }
  
  // Add a getter for the world
  public getWorld(): World {
    return this.world;
  }
  
  private mouseX: number = 0;
  private mouseY: number = 0;

  // Initialize click handler
  private initializeClickHandler(canvas: HTMLCanvasElement): void {
    // Handle click events
    canvas.addEventListener('click', (event) => {
      // Update click counter in HUD
      const clickCounter = document.getElementById('clickCounter');
      if (clickCounter) {
        const currentClicks = parseInt(clickCounter.textContent || '0');
        clickCounter.textContent = (currentClicks + 1).toString();
      }
      
      // Get the mouse coordinates relative to the canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Check if any object is hovered
      const hoveredObject = this.world.findHoveredObject();
      
      if (hoveredObject) {
        // If a space object is hovered, intercept it
        this.world.interceptObject(hoveredObject);
      } else {
        // If no object is hovered, use the regular click-to-aim behavior
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        this.world.setShipAngle(Math.atan2(dy, dx));
      }
      
      // Update HUD with current ship status
      this.updateHUD();
    });

    // Handle mouse move events for hover detection
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
      
      // Update hover states for all objects
      this.updateHoverStates();
    });
  }
  
  // Update hover states based on current mouse position
  private updateHoverStates(): void {
    // Convert mouse coordinates to world coordinates
    const worldMouseX = this.mouseX - this.ctx.canvas.width / 2 + this.ship.getX();
    const worldMouseY = this.mouseY - this.ctx.canvas.height / 2 + this.ship.getY();

    // Update hover states for all objects
    this.world.updateHoverStates(worldMouseX, worldMouseY);
  }
  
  // Update HUD with latest values
  private updateHUD(): void {
    // Update ship coordinates
    const coordinatesElement = document.getElementById('coordinates');
    if (coordinatesElement) {
      const x = Math.round(this.ship.getX());
      const y = Math.round(this.ship.getY());
      coordinatesElement.textContent = `(${x}, ${y})`;
    }
    
    // Update ship speed
    const speedElement = document.getElementById('speed');
    if (speedElement) {
      speedElement.textContent = Math.round(this.ship.getSpeed()).toString();
    }
    
    // Update score
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
      scoreElement.textContent = this.world.getScore().toString();
    }
    
    // Update last collected item display
    const lastCollectedElement = document.getElementById('last-collected');
    if (lastCollectedElement) {
      const lastCollected = this.world.getLastCollected();
      if (lastCollected) {
        let details = '';
        const type = lastCollected.getType();
        
        if (type === 'shipwreck') {
          // Use proper type checking instead of any
          const salvageType = lastCollected instanceof Shipwreck ? 
            lastCollected.getSalvageType() : 'generic';
          details = `Shipwreck (${salvageType}) - Value: ${lastCollected.getValue()}`;
        } else if (type === 'escape-pod') {
          // Use proper type checking instead of any
          const survivors = lastCollected instanceof EscapePod ?
            lastCollected.getSurvivors() : 0;
          details = `Escape Pod (${survivors} survivors) - Value: ${lastCollected.getValue()}`;
        } else {
          details = `${type} - Value: ${lastCollected.getValue()}`;
        }
        
        lastCollectedElement.textContent = details;
      } else {
        lastCollectedElement.textContent = 'Nothing collected yet';
      }
    }
    
    // Update inventory display
    const inventoryListElement = document.getElementById('inventory-list');
    if (inventoryListElement) {
      const inventory = this.world.getInventory();
      
      // Sort inventory by most recent first
      const sortedInventory = [...inventory].sort((a, b) => b.timestamp - a.timestamp);
      
      // Clear current list
      inventoryListElement.innerHTML = '';
      
      // Add each item
      if (sortedInventory.length === 0) {
        inventoryListElement.textContent = 'No items collected';
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
          inventoryListElement.appendChild(itemElement);
        });
      }
    }
    
    // Display interception data if available
    const interceptionData = this.world.getInterceptionData();
    if (interceptionData) {
      const timeElapsed = (performance.now() - interceptionData.timestamp) / 1000;
      const timeRemaining = Math.max(0, interceptionData.interceptTime - timeElapsed);
      console.log(`Time to interception: ${timeRemaining.toFixed(2)} seconds`);
    }
  }

  public start(): void {
    if (!this.running) {
      this.running = true;
      this.lastTimestamp = performance.now();
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  public stop(): void {
    this.running = false;
  }

  private gameLoop(timestamp: number): void {
    if (!this.running) return;
    
    // Calculate delta time in seconds
    const deltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    
    // Update game state
    this.world.update(deltaTime);
    
    // Update hover states
    this.updateHoverStates();
    
    // Update HUD
    this.updateHUD();
    
    // Render the game - adaptively call the appropriate method
    try {
      // Try the most likely method names
      if (typeof this.renderer.drawWorld === 'function') {
        this.renderer.drawWorld(this.ship);
        // Draw interception point on top of the rendered world
        this.drawInterceptionPoint(this.ctx);
      } else if ('render' in this.renderer && typeof this.renderer.render === 'function') {
        (this.renderer as { render: () => void }).render();
        // Draw interception point on top of the rendered world
        this.drawInterceptionPoint(this.ctx);
      } else {
        console.warn('No recognized rendering method found on GameRenderer');
      }
    } catch (error) {
      console.error('Error during rendering:', error);
    }
    
    // Draw interception point if applicable
    this.drawInterceptionPoint(this.ctx);
    
    // Continue the loop
    requestAnimationFrame(this.gameLoop.bind(this));
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
    const screenX = this.ctx.canvas.width / 2 + (interceptionData.interceptX - ship.getX());
    const screenY = this.ctx.canvas.height / 2 + (interceptionData.interceptY - ship.getY());
    
    // Helper function to check if a screen position is visible
    const isPositionVisible = (x: number, y: number): boolean => {
      const margin = 50; // Margin for interception marker size
      return (
        x > -margin && 
        x < this.ctx.canvas.width + margin && 
        y > -margin && 
        y < this.ctx.canvas.height + margin
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
}

export function initGame(canvas: HTMLCanvasElement): Game {
  const game = new Game(canvas);
  game.start();
  return game;
}
