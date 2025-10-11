// ---
// Domain logic for the World and space objects physics, including persistence callback.
// ---

import { updateAllObjectPositions } from '@shared/physics';
import sqlite3 from 'sqlite3';

export interface SpaceObject {
  id: number;
  type: 'player_ship' | 'asteroid' | 'shipwreck' | 'escape_pod';
  x: number;
  y: number;
  speed: number;
  angle: number;
  last_position_update_ms: number;
  username?: string; // Optional: only present for player_ship type
  // Afterburner state (only for player_ship)
  afterburner_boosted_speed?: number | null;
  afterburner_cooldown_end_ms?: number | null;
  afterburner_old_max_speed?: number | null;
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
   * Handles afterburner cooldown expiration during the update period
   */
  updatePhysics(currentTime: number): void {
    // Check if any player ships have afterburner cooldowns that expire during this update
    const playerShips = this.getSpaceObjectsByType('player_ship');
    
    for (const ship of playerShips) {
      // Check if ship has an active afterburner cooldown
      if (ship.afterburner_cooldown_end_ms !== null && 
          ship.afterburner_cooldown_end_ms !== undefined) {
        
        // Check if cooldown ends during this update period
        const oldUpdateTime = ship.last_position_update_ms;
        if (oldUpdateTime < ship.afterburner_cooldown_end_ms && 
            currentTime >= ship.afterburner_cooldown_end_ms) {
          
          // Cooldown ends during this update - split the physics calculation
          console.log(`⏱️ Afterburner cooldown ending for ship ${ship.id} at ${ship.afterburner_cooldown_end_ms}`);
          
          // Step 1: Update physics up to cooldown end time
          const cooldownObjects = this.spaceObjects.map(obj => 
            obj.id === ship.id ? { ...obj } : obj
          );
          const updatedToEnd = updateAllObjectPositions(
            cooldownObjects,
            ship.afterburner_cooldown_end_ms,
            this.worldSize
          );
          
          // Find the ship in the updated objects
          const shipAtEnd = updatedToEnd.find(obj => obj.id === ship.id);
          if (shipAtEnd) {
            // Step 2: Restore speed at cooldown end
            // If current speed is higher than old max speed, restore to old max speed
            // If current speed is already lower, keep it as is
            const oldMaxSpeed = ship.afterburner_old_max_speed || 0;
            if (shipAtEnd.speed > oldMaxSpeed) {
              console.log(`🔄 Restoring speed from ${shipAtEnd.speed} to ${oldMaxSpeed}`);
              shipAtEnd.speed = oldMaxSpeed;
            } else {
              console.log(`✅ Keeping current speed ${shipAtEnd.speed} (lower than old max ${oldMaxSpeed})`);
            }
            
            // Clear afterburner state
            shipAtEnd.afterburner_boosted_speed = null;
            shipAtEnd.afterburner_cooldown_end_ms = null;
            shipAtEnd.afterburner_old_max_speed = null;
            
            // Step 3: Continue physics from cooldown end to current time
            this.spaceObjects = updateAllObjectPositions(
              updatedToEnd,
              currentTime,
              this.worldSize
            );
          }
          
          // Skip normal update for this ship as we've handled it specially
          continue;
        }
      }
    }
    
    // Normal physics update for all objects (including ships without active cooldowns)
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
      last_position_update_ms: Date.now()
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
