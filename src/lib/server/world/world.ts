// ---
// Domain logic for the World and space objects physics, including persistence callback.
// ---

import { HasLock6Context, IronLocks } from '@markdrei/ironguard-typescript-locks';
import { updateAllObjectPositions, DEFAULT_WORLD_BOUNDS } from '@shared';
import { DatabaseConnection } from '../database';
import { deleteSpaceObject, insertSpaceObject } from './worldRepo';

export interface SpaceObject {
  id: number;
  type: 'player_ship' | 'asteroid' | 'shipwreck' | 'escape_pod';
  x: number;
  y: number;
  speed: number;
  angle: number;
  last_position_update_ms: number;
  picture_id: number;
  username?: string; // Optional: only present for player_ship type
}

export interface WorldData {
  worldSize: {
    width: number;
    height: number;
  };
  spaceObjects: SpaceObject[];
}

class World {
  public worldSize: { width: number; height: number };
  public spaceObjects: SpaceObject[];
  private saveCallback: SaveWorldCallback;
  private db: DatabaseConnection; // Required database reference

  constructor(
    worldSize: { width: number; height: number },
    spaceObjects: SpaceObject[],
    saveCallback: SaveWorldCallback,
    db: DatabaseConnection
  ) {
    this.worldSize = worldSize;
    this.spaceObjects = spaceObjects;
    this.saveCallback = saveCallback;
    this.db = db;
  }

  /**
   * Updates all space object positions based on elapsed time since last update
   * 
   * Needs write lock level 6 because it modifies object positions
   */
  updatePhysics<THeld extends IronLocks>(_context: HasLock6Context<THeld>, currentTime: number): void {
    this.spaceObjects = updateAllObjectPositions(
      this.spaceObjects,
      currentTime,
      this.worldSize
    );
  }

  /**
   * Get current world data
   */
  // needs _context for compile time lock checking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getWorldData<THeld extends IronLocks>(_context: HasLock6Context<THeld>): WorldData {
    return {
      worldSize: this.worldSize,
      spaceObjects: this.spaceObjects
    };
  }

  /**
   * Find a space object by ID
   */
  getSpaceObject<THeld extends IronLocks>(_context: HasLock6Context<THeld>,id: number): SpaceObject | undefined {
    return this.spaceObjects.find(obj => obj.id === id);
  }

  /**
   * Get all space objects of a specific type
   */
  getSpaceObjectsByType<THeld extends IronLocks>(_context: HasLock6Context<THeld>, type: SpaceObject['type']): SpaceObject[] {
    return this.spaceObjects.filter(obj => obj.type === type);
  }

  /**
   * Update a specific space object (e.g., for player ship movement)
   */
  updateSpaceObject<THeld extends IronLocks>(_context: HasLock6Context<THeld>, id: number, updates: Partial<Omit<SpaceObject, 'id'>>): boolean {
    const index = this.spaceObjects.findIndex(obj => obj.id === id);
    if (index === -1) return false;
    
    this.spaceObjects[index] = {
      ...this.spaceObjects[index],
      ...updates,
      last_position_update_ms: Date.now()
    };
    
    return true;
  }

  /**
   * Save the world state to persistence layer
   */
  async save(): Promise<void> {
    await this.saveCallback(this);
  }

  /**
   * Handle collection of space objects
   * @param objectId ID of the object to remove from the world
   */
  async collected<THeld extends IronLocks>(context: HasLock6Context<THeld>, objectId: number): Promise<void> {
    const objectIndex = this.spaceObjects.findIndex(obj => obj.id === objectId);
    if (objectIndex === -1) {
      return; // Object not found
    }

    const collectedObject = this.spaceObjects[objectIndex];
    console.log(`Object ${objectId} (${collectedObject.type}) was collected`);
    
    // Remove the object from the world
    this.spaceObjects.splice(objectIndex, 1);
    
    // Remove from database
    await deleteSpaceObject(this.db, objectId);
    
    // Spawn a new object to replace the collected one
    await this.spawnRandomObject(context);
  }

  /**
   * Spawn a new random space object
   * 60% chance of asteroid, 30% chance of shipwreck, 10% chance of escape pod
   */
  // needs _context for compile time lock checking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async spawnRandomObject<THeld extends IronLocks>(_context: HasLock6Context<THeld>): Promise<void> {
    const random = Math.random();
    let objectType: SpaceObject['type'];
    let baseSpeed: number;

    // Determine object type and base speed based on probabilities
    if (random < 0.6) {
      objectType = 'asteroid';
      baseSpeed = 5; // Slow moving
    } else if (random < 0.9) {
      objectType = 'shipwreck';
      baseSpeed = 10;
    } else {
      objectType = 'escape_pod';
      baseSpeed = 25; // Fast moving
    }

    // Generate random position within world bounds (with some margin from edges)
    const x = Math.random() * (this.worldSize.width);
    const y = Math.random() * (this.worldSize.height);

    // Generate random speed (±25% variation from base)
    const speedVariation = 0.25;
    const speed = baseSpeed * (1 + (Math.random() - 0.5) * 2 * speedVariation);

    // Generate random angle (0-360 degrees)
    const angle = Math.random() * 360;

    const newObject: Omit<SpaceObject, 'id'> = {
      type: objectType,
      x,
      y,
      speed: Math.max(0, speed), // Ensure speed is not negative
      angle,
      last_position_update_ms: Date.now(),
      picture_id: 1 // Default picture ID for collectibles
    };

    // Insert into database and get the new ID
    const newId = await insertSpaceObject(this.db, newObject);
    
    // Add to world with the database-assigned ID
    this.spaceObjects.push({
      id: newId,
      ...newObject
    });
    
    console.log(`Spawned new ${objectType} with ID ${newId} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  }

  /**
   * Create a new world instance with default values
   */
  static createDefault(saveCallback: SaveWorldCallback, db: DatabaseConnection): World {
    return new World(
      DEFAULT_WORLD_BOUNDS,
      [], // Empty space objects initially
      saveCallback,
      db
    );
  }
}

type SaveWorldCallback = (world: World) => Promise<void>;

export { World };
export type { SaveWorldCallback };
