// ---
// TechRepo - Database operations for ship technology and equipment
// ---

import sqlite3 from 'sqlite3';
import { TechCounts, TechFactory } from './TechFactory';
import { getDatabase } from './database';

export interface BuildQueueItem {
  itemKey: string;
  itemType: 'weapon' | 'defense';
  completionTime: number; // Unix timestamp when build completes
}

export class TechRepo {
  private db: sqlite3.Database;

  constructor(database?: sqlite3.Database) {
    this.db = database || getDatabase();
  }

  /**
   * Get tech counts for a user's ship
   */
  getTechCounts(userId: number): Promise<TechCounts | null> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT 
          pulse_laser,
          auto_turret,
          plasma_lance,
          gauss_rifle,
          photon_torpedo,
          rocket_launcher,
          kinetic_armor,
          energy_shield,
          missile_jammer
        FROM users 
        WHERE id = ?
      `);
      
      stmt.get(userId, (err: Error | null, result: TechCounts | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result || null);
      });
    });
  }

  /**
   * Update tech counts for a user's ship
   */
  updateTechCounts(userId: number, techCounts: Partial<TechCounts>): Promise<void> {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(techCounts);
      const values = Object.values(techCounts);
      
      if (fields.length === 0) {
        resolve();
        return;
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const stmt = this.db.prepare(`
        UPDATE users 
        SET ${setClause}
        WHERE id = ?
      `);
      
      stmt.run([...values, userId], (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get build queue for a user's ship
   */
  getBuildQueue(userId: number): Promise<BuildQueueItem[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT build_queue, build_start_sec 
        FROM users 
        WHERE id = ?
      `);
      
      stmt.get(userId, (err: Error | null, result: { build_queue: string | null; build_start_sec: number | null } | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!result || !result.build_queue) {
          resolve([]);
          return;
        }

        try {
          const queue = JSON.parse(result.build_queue) as BuildQueueItem[];
          resolve(queue);
        } catch {
          // Invalid JSON, return empty queue
          resolve([]);
        }
      });
    });
  }

  /**
   * Update build queue for a user's ship
   */
  updateBuildQueue(userId: number, queue: BuildQueueItem[], startTime?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const queueJson = queue.length > 0 ? JSON.stringify(queue) : null;
      const stmt = this.db.prepare(`
        UPDATE users 
        SET build_queue = ?, build_start_sec = ?
        WHERE id = ?
      `);
      
      stmt.run(queueJson, startTime || null, userId, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get total iron cost for current tech loadout
   */
  async getTotalTechCost(userId: number): Promise<number> {
    const techCounts = await this.getTechCounts(userId);
    if (!techCounts) {
      return 0;
    }
    
    const effects = TechFactory.calculateTotalEffects(techCounts);
    return effects.grandTotalCost;
  }

  /**
   * Get detailed tech loadout analysis
   */
  async getTechLoadoutAnalysis(userId: number): Promise<{
    techCounts: TechCounts | null;
    effects: ReturnType<typeof TechFactory.calculateTotalEffects> | null;
    buildQueue: BuildQueueItem[];
    queueEstimatedCompletion: number | null;
  }> {
    const [techCounts, buildQueue] = await Promise.all([
      this.getTechCounts(userId),
      this.getBuildQueue(userId)
    ]);

    const effects = techCounts ? TechFactory.calculateTotalEffects(techCounts) : null;
    
    const queueEstimatedCompletion = buildQueue.length > 0 
      ? buildQueue[buildQueue.length - 1].completionTime 
      : null;

    return {
      techCounts,
      effects,
      buildQueue,
      queueEstimatedCompletion
    };
  }

  /**
   * Add item to build queue
   */
  async addToBuildQueue(userId: number, itemKey: string, itemType: 'weapon' | 'defense', buildDurationMinutes: number): Promise<void> {
    const currentQueue = await this.getBuildQueue(userId);
    const now = Math.floor(Date.now() / 1000);
    
    // Calculate completion time based on queue
    let completionTime = now;
    if (currentQueue.length > 0) {
      const lastItem = currentQueue[currentQueue.length - 1];
      completionTime = lastItem.completionTime;
    }
    completionTime += buildDurationMinutes * 60; // Convert minutes to seconds

    const newItem: BuildQueueItem = {
      itemKey,
      itemType,
      completionTime
    };

    currentQueue.push(newItem);
    const startTime = currentQueue.length === 1 ? now : undefined;
    
    await this.updateBuildQueue(userId, currentQueue, startTime);
  }

  /**
   * Process completed builds and update tech counts
   */
  async processCompletedBuilds(userId: number): Promise<{ completed: BuildQueueItem[]; remaining: BuildQueueItem[] }> {
    const queue = await this.getBuildQueue(userId);
    const now = Math.floor(Date.now() / 1000);
    
    const completed: BuildQueueItem[] = [];
    const remaining: BuildQueueItem[] = [];
    
    for (const item of queue) {
      if (item.completionTime <= now) {
        completed.push(item);
      } else {
        remaining.push(item);
      }
    }

    if (completed.length > 0) {
      // Update tech counts for completed items
      const techCounts = await this.getTechCounts(userId) || {
        pulse_laser: 5,
        auto_turret: 5,
        plasma_lance: 0,
        gauss_rifle: 0,
        photon_torpedo: 0,
        rocket_launcher: 0,
        ship_hull: 5,
        kinetic_armor: 5,
        energy_shield: 5,
        missile_jammer: 0
      };

      for (const item of completed) {
        if (item.itemKey in techCounts) {
          techCounts[item.itemKey as keyof TechCounts] += 1;
        }
      }

      await this.updateTechCounts(userId, techCounts);
      await this.updateBuildQueue(userId, remaining);
    }

    return { completed, remaining };
  }

  /**
   * Add weapon to build queue using TechFactory catalog
   */
  async addWeaponToBuildQueue(userId: number, weaponKey: string): Promise<void> {
    const weaponSpec = TechFactory.getWeaponSpec(weaponKey);
    if (!weaponSpec) {
      throw new Error(`Unknown weapon: ${weaponKey}`);
    }
    
    await this.addToBuildQueue(userId, weaponKey, 'weapon', weaponSpec.buildDurationMinutes);
  }

  /**
   * Add defense item to build queue using TechFactory catalog
   */
  async addDefenseToBuildQueue(userId: number, defenseKey: string): Promise<void> {
    const defenseSpec = TechFactory.getDefenseSpec(defenseKey);
    if (!defenseSpec) {
      throw new Error(`Unknown defense item: ${defenseKey}`);
    }
    
    await this.addToBuildQueue(userId, defenseKey, 'defense', defenseSpec.buildDurationMinutes);
  }

  /**
   * Add any tech item to build queue (weapon or defense)
   */
  async addTechItemToBuildQueue(userId: number, itemKey: string, itemType: 'weapon' | 'defense'): Promise<void> {
    if (itemType === 'weapon') {
      await this.addWeaponToBuildQueue(userId, itemKey);
    } else {
      await this.addDefenseToBuildQueue(userId, itemKey);
    }
  }

  /**
   * Update both tech counts and iron in a single transaction
   * This is the preferred method for spending iron on tech
   */
  updateTechCountsAndIron(userId: number, techCounts: Partial<TechCounts>, ironDelta: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const fields = Object.keys(techCounts);
        const values = Object.values(techCounts);
        
        // Build the SET clause for tech counts
        const techSetClause = fields.length > 0 ? fields.map(field => `${field} = ?`).join(', ') + ', ' : '';
        
        const stmt = this.db.prepare(`
          UPDATE users 
          SET ${techSetClause}iron = iron + ?
          WHERE id = ?
        `);
        
        stmt.run([...values, ironDelta, userId], (err: Error | null) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          this.db.run('COMMIT', (commitErr: Error | null) => {
            if (commitErr) {
              reject(commitErr);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  /**
   * Get user's current iron amount
   */
  getIron(userId: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT iron FROM users WHERE id = ?');
      
      stmt.get(userId, (err: Error | null, result: { iron: number } | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result?.iron || 0);
      });
    });
  }

  /**
   * Update user's iron amount
   */
  updateIron(userId: number, ironDelta: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE users 
        SET iron = iron + ? 
        WHERE id = ?
      `);
      
      stmt.run(ironDelta, userId, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get estimated completion time for adding a new item to queue
   */
  async getEstimatedCompletionTime(userId: number, itemKey: string, itemType: 'weapon' | 'defense'): Promise<number> {
    const currentQueue = await this.getBuildQueue(userId);
    const spec = TechFactory.getTechSpec(itemKey, itemType);
    
    if (!spec) {
      throw new Error(`Unknown ${itemType}: ${itemKey}`);
    }

    const now = Math.floor(Date.now() / 1000);
    let completionTime = now;
    
    if (currentQueue.length > 0) {
      const lastItem = currentQueue[currentQueue.length - 1];
      completionTime = lastItem.completionTime;
    }
    
    return completionTime + (spec.buildDurationMinutes * 60);
  }
}
