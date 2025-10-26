// Main Game class
import { World } from './World';
import { GameRenderer } from '../renderers/GameRenderer';
import { Ship } from './Ship';
import { WorldData, TargetingLine, InterceptionLines } from '@shared/types/gameTypes';
import { setShipDirection, interceptTarget } from '../services/navigationService';
import { getShipStats } from '../services/shipStatsService';
import { InterceptCalculator } from './InterceptCalculator';
import { SpaceObjectOld } from './SpaceObject';
import { collectionService } from '../services/collectionService';
import { calculateToroidalDistance } from '@shared/physics';
import { debugState } from '../debug/debugState';
import { InterceptionLineRenderer } from '../renderers/InterceptionLineRenderer';

export class Game {
  private world: World;
  private renderer: GameRenderer;
  private interceptionRenderer: InterceptionLineRenderer;
  // private lastTimestamp: number = 0; // REMOVED: No longer needed without client physics
  private running: boolean = false;
  private ctx: CanvasRenderingContext2D;
  private ship: Ship;
  private refetchWorldData?: () => void; // Function to refresh world data from server
  private targetingLine: TargetingLine | null = null;
  private interceptionLines: InterceptionLines | null = null;
  private onNavigationCallback?: () => void; // Callback for when navigation happens
  private teleportMode: boolean = false; // Track if teleport mode is active
  private teleportRange: number = 0; // Current teleport range

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
    
    // Initialize the interception line renderer
    this.interceptionRenderer = new InterceptionLineRenderer(this.ctx);
    
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
      
      // Scale coordinates to match canvas logical size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const logicalX = mouseX * scaleX;
      const logicalY = mouseY * scaleY;
      
      // Update mouse position for consistent coordinate handling
      this.mouseX = logicalX;
      this.mouseY = logicalY;
      
      // Update hover states with fresh click coordinates to ensure accuracy
      this.updateHoverStates();
      
      // Convert click coordinates to world coordinates
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const dx = logicalX - centerX;
      const dy = logicalY - centerY;
      const ship = this.world.getShip();
      const worldTargetX = ship.getX() + dx;
      const worldTargetY = ship.getY() + dy;
      
      // Check if in teleport mode
      if (this.teleportMode) {
        // In teleport mode - attempt to teleport to the clicked location
        this.handleTeleport(worldTargetX, worldTargetY);
        return;
      }
      
      // Normal mode - check if any object is hovered
      const hoveredObject = this.world.findHoveredObject();
      
      if (hoveredObject) {
        // Check if object is close enough to collect and not a ship
        const distance = calculateToroidalDistance(
          { x: ship.getX(), y: ship.getY() },
          { x: hoveredObject.getX(), y: hoveredObject.getY() },
          { width: this.world.getWidth(), height: this.world.getHeight() }
        );
        
        if (distance <= 125 && hoveredObject.getType() !== 'player_ship') {
          // Object is close enough and collectible - try to collect it
          this.handleCollection(hoveredObject);
        } else {
          // Object is too far or is a ship - use interception
          this.handleInterception(hoveredObject);
        }
      } else {
        // If no object is hovered, use the regular click-to-aim behavior
        const angle = Math.atan2(dy, dx);
        const angleDegrees = (angle * 180 / Math.PI + 360) % 360;
        
        this.handleDirectionChange(angleDegrees, worldTargetX, worldTargetY);
      }
    });

    // Handle mouse move events for hover detection
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Scale coordinates to match canvas logical size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouseX = mouseX * scaleX;
      this.mouseY = mouseY * scaleY;
      
      // Update hover states for all objects
      this.updateHoverStates();
    });
  }

  // Handle direction change when clicking on empty space
  private async handleDirectionChange(angleDegrees: number, targetX?: number, targetY?: number): Promise<void> {
    try {
      // Create targeting line if target coordinates are provided
      if (targetX !== undefined && targetY !== undefined) {
        this.createTargetingLine(targetX, targetY);
      }
      
      // Apply immediate local update for visual feedback
      this.world.setShipAngle(angleDegrees);
      
      // Then update via API
      await setShipDirection(angleDegrees);
      console.log('Ship direction updated via API:', angleDegrees);

      // Trigger world data refresh to get authoritative server state
      if (this.refetchWorldData) {
        this.refetchWorldData();
      }

      // Trigger navigation callback to update input fields
      if (this.onNavigationCallback) {
        this.onNavigationCallback();
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
        // Create interception lines for visualization using global coordinates
        this.createInterceptionLines(interceptResult.globalCoordinates, interceptResult.timeToIntercept);
        
        // Then update via API with max speed
        await interceptTarget(interceptResult.angle, shipStats.maxSpeed);
        console.log('Ship interception updated via API with angle: ', interceptResult.angle, " and max speed: ", shipStats.maxSpeed);

        // Trigger world data refresh to get authoritative server state
        if (this.refetchWorldData) {
          this.refetchWorldData();
        }

        // Trigger navigation callback to update input fields
        if (this.onNavigationCallback) {
          this.onNavigationCallback();
        }
      } else {
        console.warn('Could not calculate valid interception angle');
      }
    } catch (error) {
      console.error('Failed to handle interception:', error);
    }
  }

  // Handle collection when clicking on a nearby object
  private async handleCollection(targetObject: SpaceObjectOld): Promise<void> {
    try {
      const objectId = targetObject.getId();
      const objectType = targetObject.getType();
      
      console.log(`Attempting to collect ${objectType} with ID ${objectId}`);
      console.log(`Object ID type: ${typeof objectId}, value: ${objectId}`);
      
      if (typeof objectId !== 'number' || isNaN(objectId)) {
        console.error(`❌ Invalid object ID: ${objectId} (type: ${typeof objectId})`);
        return;
      }
      
      const result = await collectionService.collectObject(objectId);
      
      console.log(`Collection API response:`, result);
      
      if (result.success) {
        if (result.ironReward && result.ironReward > 0) {
          console.log(`Successfully collected ${result.objectType}! Received ${result.ironReward} iron (Total: ${result.totalIron}). Distance: ${result.distance} units`);
        } else {
          console.log(`Successfully collected ${result.objectType}! No iron reward. Distance: ${result.distance} units`);
        }
        
        // Trigger world data refresh to get updated state from server
        if (this.refetchWorldData) {
          console.log(`🔄 Triggering world data refresh...`);
          this.refetchWorldData();
        } else {
          console.log(`⚠️ No refetch function available`);
        }
      } else {
        console.error('Failed to collect object:', result.error);
        // Could show user feedback here (e.g., toast notification)
      }
    } catch (error) {
      console.error('Failed to handle collection:', error);
    }
  }

  // Handle teleportation when clicking in teleport mode
  private async handleTeleport(worldTargetX: number, worldTargetY: number): Promise<void> {
    try {
      // Import dynamically to avoid circular dependencies
      const { teleportShip } = await import('../services/teleportService');
      
      console.log(`Attempting to teleport to (${worldTargetX.toFixed(1)}, ${worldTargetY.toFixed(1)})`);
      
      const result = await teleportShip(worldTargetX, worldTargetY);
      
      if ('error' in result) {
        console.error('Failed to teleport:', result.error);
        // Could show user feedback here (e.g., toast notification with error message)
        return;
      }
      
      console.log(`Successfully teleported! Distance: ${result.teleportation.distance.toFixed(1)} units (Max: ${result.teleportation.maxRange.toFixed(1)})`);
      
      // Trigger world data refresh to get updated state from server
      if (this.refetchWorldData) {
        console.log(`🔄 Triggering world data refresh after teleport...`);
        this.refetchWorldData();
      }
      
      // Trigger navigation callback to update input fields
      if (this.onNavigationCallback) {
        this.onNavigationCallback();
      }
    } catch (error) {
      console.error('Failed to handle teleportation:', error);
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

  /**
   * Set a callback function to trigger when navigation happens
   */
  public setNavigationCallback(callback: () => void): void {
    this.onNavigationCallback = callback;
  }

  /**
   * Enable or disable teleport mode
   */
  public setTeleportMode(enabled: boolean, range: number = 0): void {
    this.teleportMode = enabled;
    this.teleportRange = range;
  }

  /**
   * Get the current teleport mode state
   */
  public getTeleportMode(): boolean {
    return this.teleportMode;
  }

  /**
   * Get the current teleport range
   */
  public getTeleportRange(): number {
    return this.teleportRange;
  }

  /**
   * Get the current debug drawings state
   */
  public getDebugDrawingsEnabled(): boolean {
    return debugState.debugDrawingsEnabled;
  }

  /**
   * Set the debug drawings state
   */
  public setDebugDrawingsEnabled(enabled: boolean): void {
    debugState.setDebugDrawingsEnabled(enabled);
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
    this.clearTargetingLine(); // Clean up targeting line when game stops
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
        this.renderer.drawWorld(this.ship, this.getTargetingLine());
        
        // Draw interception lines on top of the rendered world
        this.drawInterceptionLines();
      } else if ('render' in this.renderer && typeof this.renderer.render === 'function') {
        (this.renderer as { render: () => void }).render();
        
        // Draw interception lines on top of the rendered world
        this.drawInterceptionLines();
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

  // Targeting line management methods
  private createTargetingLine(targetX: number, targetY: number): void {
    const ship = this.world.getShip();
    this.targetingLine = {
      startX: ship.getX(),
      startY: ship.getY(),
      targetX,
      targetY,
      createdAt: Date.now(),
      duration: 4000 // 4 seconds
    };
  }

  private updateTargetingLine(): void {
    if (!this.targetingLine) return;
    
    const elapsed = Date.now() - this.targetingLine.createdAt;
    if (elapsed >= this.targetingLine.duration) {
      this.targetingLine = null;
    }
  }

  private clearTargetingLine(): void {
    this.targetingLine = null;
  }

  public getTargetingLine(): TargetingLine | null {
    this.updateTargetingLine(); // Clean up expired lines
    return this.targetingLine;
  }

  // Interception line management methods
  private createInterceptionLines(globalCoords: { shipX: number; shipY: number; targetX: number; targetY: number; interceptX: number; interceptY: number }, timeToIntercept: number): void {
    this.interceptionLines = {
      shipToInterceptX: globalCoords.shipX,
      shipToInterceptY: globalCoords.shipY,
      targetToInterceptX: globalCoords.targetX,
      targetToInterceptY: globalCoords.targetY,
      interceptX: globalCoords.interceptX,
      interceptY: globalCoords.interceptY,
      timeToIntercept: timeToIntercept,
      originalTimeToIntercept: timeToIntercept,
      createdAt: Date.now(),
      duration: 4000 // 4 seconds
    };
  }

  private updateInterceptionLines(): void {
    if (!this.interceptionLines) return;
    
    const elapsed = Date.now() - this.interceptionLines.createdAt;
    
    // Update the time-to-intercept by subtracting elapsed time
    const elapsedSeconds = elapsed / 1000;
    this.interceptionLines.timeToIntercept = Math.max(0, this.interceptionLines.originalTimeToIntercept - elapsedSeconds);
    
    // Clear lines if duration has expired
    if (elapsed >= this.interceptionLines.duration) {
      this.interceptionLines = null;
    }
  }

  private clearInterceptionLines(): void {
    this.interceptionLines = null;
  }

  public getInterceptionLines(): InterceptionLines | null {
    this.updateInterceptionLines(); // Clean up expired lines
    return this.interceptionLines;
  }

  // Draw interception lines if present
  private drawInterceptionLines(): void {
    const interceptionLines = this.getInterceptionLines();
    if (interceptionLines) {
      const centerX = this.ctx.canvas.width / 2;
      const centerY = this.ctx.canvas.height / 2;
      const ship = this.world.getShip();
      
      this.interceptionRenderer.drawInterceptionLines(
        interceptionLines,
        centerX,
        centerY,
        ship.getX(),
        ship.getY()
      );
    }
  }
}

export function initGame(canvas: HTMLCanvasElement): Game {
  const game = new Game(canvas);
  game.start();
  return game;
}
