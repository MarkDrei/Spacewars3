// Main Game class
import { World } from './World';
import { GameRenderer } from './renderers/GameRenderer';
import { WorldInitializer } from './WorldInitializer';
import { Ship } from './Ship';

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
    
    // Render the game - adaptively call the appropriate method
    try {
      // Try the most likely method names
      if (typeof this.renderer.drawWorld === 'function') {
        this.renderer.drawWorld(this.ship);
      } else if (typeof (this.renderer as any).render === 'function') {
        (this.renderer as any).render();
      } else {
        console.warn('No recognized rendering method found on GameRenderer');
      }
    } catch (error) {
      console.error('Error during rendering:', error);
    }
    
    // Continue the loop
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

export function initGame(canvas: HTMLCanvasElement): Game {
  const game = new Game(canvas);
  game.start();
  return game;
}
