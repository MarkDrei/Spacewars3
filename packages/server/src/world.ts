// ---
// Domain logic for the World and space objects physics, including persistence callback.
// ---

import { updateAllObjectPositions } from '@spacewars-ironcore/shared';
import sqlite3 from 'sqlite3';

export interface SpaceObject {
  id: number;
  type: 'player_ship' | 'asteroid' | 'shipwreck' | 'escape_pod';
  x: number;
  y: number;
  velocity: number;
  angle: number;
  last_position_update: number;
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
  private db: sqlite3.Database; // Required database reference

  constructor(
    worldSize: { width: number; height: number },
    spaceObjects: SpaceObject[],
    saveCallback: SaveWorldCallback,
    db: sqlite3.Database
  ) {
    this.worldSize = worldSize;
    this.spaceObjects = spaceObjects;
    this.saveCallback = saveCallback;
    this.db = db;
  }

  /**
   * Updates all space object positions based on elapsed time since last update
   */
  updatePhysics(currentTime: number): void {
    this.spaceObjects = updateAllObjectPositions(
      this.spaceObjects,
      currentTime,
      this.worldSize
    );
  }

  /**
   * Get current world data
   */
  getWorldData(): WorldData {
    return {
      worldSize: this.worldSize,
      spaceObjects: this.spaceObjects
    };
  }

  /**
   * Find a space object by ID
   */
  getSpaceObject(id: number): SpaceObject | undefined {
    return this.spaceObjects.find(obj => obj.id === id);
  }

  /**
   * Get all space objects of a specific type
   */
  getSpaceObjectsByType(type: SpaceObject['type']): SpaceObject[] {
    return this.spaceObjects.filter(obj => obj.type === type);
  }

  /**
   * Update a specific space object (e.g., for player ship movement)
   */
  updateSpaceObject(id: number, updates: Partial<Omit<SpaceObject, 'id'>>): boolean {
    const index = this.spaceObjects.findIndex(obj => obj.id === id);
    if (index === -1) return false;
    
    this.spaceObjects[index] = {
      ...this.spaceObjects[index],
      ...updates,
      last_position_update: Date.now()
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
  async collected(objectId: number): Promise<void> {
    const objectIndex = this.spaceObjects.findIndex(obj => obj.id === objectId);
    if (objectIndex === -1) {
      return; // Object not found
    }

    const collectedObject = this.spaceObjects[objectIndex];
    console.log(`Object ${objectId} (${collectedObject.type}) was collected`);
    
    // Remove the object from the world
    this.spaceObjects.splice(objectIndex, 1);
    
    // Remove from database
    const { deleteSpaceObject } = await import('./worldRepo');
    await deleteSpaceObject(this.db, objectId);
    
    // Spawn a new object to replace the collected one
    await this.spawnRandomObject();
  }

  /**
   * Spawn a new random space object
   * 60% chance of asteroid, 30% chance of shipwreck, 10% chance of escape pod
   */
  private async spawnRandomObject(): Promise<void> {
    const random = Math.random();
    let objectType: SpaceObject['type'];
    let baseVelocity: number;

    // Determine object type and base velocity based on probabilities
    if (random < 0.6) {
      objectType = 'asteroid';
      baseVelocity = 5; // Slow moving
    } else if (random < 0.9) {
      objectType = 'shipwreck';
      baseVelocity = 10;
    } else {
      objectType = 'escape_pod';
      baseVelocity = 25; // Fast moving
    }

    // Generate random position within world bounds (with some margin from edges)
    const x = Math.random() * (this.worldSize.width);
    const y = Math.random() * (this.worldSize.height);

    // Generate random velocity (±25% variation from base)
    const velocityVariation = 0.25;
    const velocity = baseVelocity * (1 + (Math.random() - 0.5) * 2 * velocityVariation);

    // Generate random angle (0-360 degrees)
    const angle = Math.random() * 360;

    const newObject: Omit<SpaceObject, 'id'> = {
      type: objectType,
      x,
      y,
      velocity: Math.max(0, velocity), // Ensure velocity is not negative
      angle,
      last_position_update: Date.now()
    };

    // Insert into database and get the new ID
    const { insertSpaceObject } = await import('./worldRepo');
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
  static createDefault(saveCallback: SaveWorldCallback, db: sqlite3.Database): World {
    return new World(
      { width: 500, height: 500 }, // Default world size
      [], // Empty space objects initially
      saveCallback,
      db
    );
  }
}

type SaveWorldCallback = (world: World) => Promise<void>;

export { World };
export type { SaveWorldCallback };
