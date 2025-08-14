// Main Game class
import { World } from './World';
import { GameRenderer } from '../renderers/GameRenderer';
import { Ship } from './Ship';
import { WorldData } from '@shared/types/gameTypes';
import { setShipDirection, interceptTarget } from '../services/navigationService';
import { getShipStats } from '../services/shipStatsService';
import { InterceptCalculator } from './InterceptCalculator';
import { SpaceObjectOld } from './SpaceObject';

export class Game {
  private world: World;
  private renderer: GameRenderer;
  // private lastTimestamp: number = 0; // REMOVED: No longer needed without client physics
  private running: boolean = false;
  private ctx: CanvasRenderingContext2D;
  private ship: Ship;
  private refetchWorldData?: () => void; // Function to refresh world data from server

  constructor(canvas: HTMLCanvasElement) {
    // Initialize the canvas context
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    
    // Initialize the world - start empty since we'll get data from server
    this.world = new World(false);
    
    // Create a dummy ship initially (will be replaced by server data)
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
      // Get the mouse coordinates relative to the canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Check if any object is hovered
      const hoveredObject = this.world.findHoveredObject();
      
      if (hoveredObject) {
        // If a space object is hovered, intercept it
        this.handleInterception(hoveredObject);
      } else {
        // If no object is hovered, use the regular click-to-aim behavior
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        const angle = Math.atan2(dy, dx);
        this.handleDirectionChange(angle);
      }
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

  // Handle direction change when clicking on empty space
  private async handleDirectionChange(angleRadians: number): Promise<void> {
    try {
      // Apply immediate local update for visual feedback
      this.world.setShipAngle(angleRadians);
      
      // Then update via API
      await setShipDirection(angleRadians);
      console.log('Ship direction updated via API:', angleRadians);

      // Trigger world data refresh to get authoritative server state
      if (this.refetchWorldData) {
        this.refetchWorldData();
      }
    } catch (error) {
      console.error('Failed to update ship direction:', error);
      // Local update already applied above for immediate feedback
    }
  }

  // Handle interception when clicking on an object
  private async handleInterception(targetObject: SpaceObjectOld): Promise<void> {
    try {
      // Get current ship stats including max speed from server
      const shipStats = await getShipStats();
      
      if ('error' in shipStats) {
        console.error('Failed to get ship stats:', shipStats.error);
        return;
      }

      // Calculate interception angle using max speed for optimal interception
      const ship = this.world.getShip();
      const interceptResult = InterceptCalculator.calculateInterceptAngle(ship, targetObject, shipStats.maxSpeed);
      
      if (!isNaN(interceptResult.angle)) {
        // Then update via API with max speed
        await interceptTarget(interceptResult.angle, shipStats.maxSpeed);
        console.log('Ship interception updated via API with angle: ', interceptResult.angle, " and max speed: ", shipStats.maxSpeed);

        // Trigger world data refresh to get authoritative server state
        if (this.refetchWorldData) {
          this.refetchWorldData();
        }
      } else {
        console.warn('Could not calculate valid interception angle');
      }
    } catch (error) {
      console.error('Failed to handle interception:', error);
    }
  }
  
  // Update hover states based on current mouse position
  private updateHoverStates(): void {
    // Convert mouse coordinates to world coordinates
    const worldMouseX = this.mouseX - this.ctx.canvas.width / 2 + this.ship.getX();
    const worldMouseY = this.mouseY - this.ctx.canvas.height / 2 + this.ship.getY();

    // Update hover states for all objects
    this.world.updateHoverStates(worldMouseX, worldMouseY);
  }

  /**
   * Update the game world with server data
   */
  public updateWorldData(worldData: WorldData, playerShipId?: number): void {
    this.world.updateFromServerData(worldData, playerShipId);
    // Update the local player ship reference
    this.ship = this.world.getShip();
  }

  /**
   * Set the function to refresh world data from server
   */
  public setRefetchFunction(refetch: () => void): void {
    this.refetchWorldData = refetch;
  }

  public start(): void {
    if (!this.running) {
      this.running = true;
      // this.lastTimestamp = performance.now(); // REMOVED: No longer needed
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  public stop(): void {
    this.running = false;
  }

  private gameLoop(): void {
    if (!this.running) return;
    
    // Don't render if we don't have any space objects yet (waiting for server data)
    if (this.world.getSpaceObjects().length === 0) {
      requestAnimationFrame(this.gameLoop.bind(this));
      return;
    }
    
    // Update hover states
    this.updateHoverStates();
    
    // Render the game - adaptively call the appropriate method
    try {
      // Try the most likely method names
      if (typeof this.renderer.drawWorld === 'function') {
        this.renderer.drawWorld(this.ship);
        // // Draw interception point on top of the rendered world
        // this.drawInterceptionPoint(this.ctx);
      } else if ('render' in this.renderer && typeof this.renderer.render === 'function') {
        (this.renderer as { render: () => void }).render();
        // // Draw interception point on top of the rendered world
        // this.drawInterceptionPoint(this.ctx);
      } else {
        console.warn('No recognized rendering method found on GameRenderer');
      }
    } catch (error) {
      console.error('Error during rendering:', error);
    }
    
    // // Draw interception point if applicable
    // this.drawInterceptionPoint(this.ctx);
    
    // Continue the loop
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

export function initGame(canvas: HTMLCanvasElement): Game {
  const game = new Game(canvas);
  game.start();
  return game;
}
