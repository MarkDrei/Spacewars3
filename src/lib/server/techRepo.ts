// ---
// TechRepo - Database operations for ship technology and equipment
// ---

import sqlite3 from 'sqlite3';
import { TechCounts, TechFactory } from './TechFactory';
import { getDatabase } from './database';
import { sendMessageToUser } from './MessageCache';

export interface BuildQueueItem {
  itemKey: string;
  itemType: 'weapon' | 'defense';
  completionTime: number; // Unix timestamp when build completes
}

export class TechRepo {
  private db: sqlite3.Database;

  constructor(database: sqlite3.Database) {
    this.db = database;
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
          ship_hull,
          kinetic_armor,
          energy_shield,
          missile_jammer
        FROM users 
        WHERE id = ?
      `);
      
      stmt.get(userId, (err: Error | null, result: TechCounts | undefined) => {
        stmt.finalize(); // Always finalize the statement
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
        stmt.finalize(); // Always finalize the statement
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
        stmt.finalize(); // Always finalize the statement
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
        stmt.finalize(); // Always finalize the statement
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
      const techCounts = await this.getTechCounts(userId);
      
      if (!techCounts) {
        throw new Error(`User tech data not found for userId: ${userId}`);
      }

      for (const item of completed) {
        if (item.itemKey in techCounts) {
          techCounts[item.itemKey as keyof TechCounts] += 1;
        }
      }

      await this.updateTechCounts(userId, techCounts);
      
      // Update defense current values for completed defense items
      // When a defense tech completes, increase current by +100 (capped at new max)
      await this.updateDefenseCurrentValuesForCompletedBuilds(userId, completed, techCounts);
      
      await this.updateBuildQueue(userId, remaining);
      
      // Send notifications for completed builds
      // In production, this runs async to not block the response
      // In tests, we await it to ensure proper test behavior
      if (process.env.NODE_ENV === 'test') {
        // Wait for notifications in test environment
        await this.sendBuildCompletionNotifications(userId, completed);
      } else {
        // Don't block in production - send async
        this.sendBuildCompletionNotifications(userId, completed).catch((error: Error) => {
          console.error('❌ Failed to send build completion notifications:', error);
        });
      }
    }

    return { completed, remaining };
  }

  /**
   * Update defense current values when defense items complete building
   * Increases current by +100 (the new tech's contribution), capped at new max
   */
  private async updateDefenseCurrentValuesForCompletedBuilds(
    userId: number, 
    completed: BuildQueueItem[], 
    updatedTechCounts: TechCounts
  ): Promise<void> {
    // Check if any defense items were completed
    const defenseItems = completed.filter(item => item.itemType === 'defense');
    if (defenseItems.length === 0) return;

    // Get current defense values from database
    const result = await new Promise<{ hull_current: number; armor_current: number; shield_current: number } | undefined>((resolve, reject) => {
      this.db.get(
        'SELECT hull_current, armor_current, shield_current FROM users WHERE id = ?',
        [userId],
        (err: Error | null, row: { hull_current: number; armor_current: number; shield_current: number } | undefined) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!result) {
      console.warn(`No defense values found for user ${userId}`);
      return;
    }

    let { hull_current, armor_current, shield_current } = result;

    // For each completed defense item, increase current by +100 (capped at new max)
    for (const item of defenseItems) {
      const maxValue = updatedTechCounts[item.itemKey as keyof TechCounts] * 100;
      
      if (item.itemKey === 'ship_hull') {
        hull_current = Math.min(hull_current + 100, maxValue);
      } else if (item.itemKey === 'kinetic_armor') {
        armor_current = Math.min(armor_current + 100, maxValue);
      } else if (item.itemKey === 'energy_shield') {
        shield_current = Math.min(shield_current + 100, maxValue);
      }
    }

    // Update the database with new current values
    await new Promise<void>((resolve, reject) => {
      this.db.run(
        `UPDATE users 
         SET hull_current = ?, armor_current = ?, shield_current = ?
         WHERE id = ?`,
        [hull_current, armor_current, shield_current, userId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Send notifications for completed build items
   */
  private async sendBuildCompletionNotifications(userId: number, completed: BuildQueueItem[]): Promise<void> {
    for (const item of completed) {
      try {
        // Get tech spec to create a more informative message
        const spec = TechFactory.getTechSpec(item.itemKey, item.itemType);
        const itemName = spec?.name || item.itemKey.replace('_', ' ');
        const itemTypeLabel = item.itemType === 'weapon' ? 'weapon' : 'defense system';
        
        // Create notification message
        const message = `🔧 Construction complete: ${itemName} (${itemTypeLabel}) is now ready for deployment!`;
        
        console.log(`📝 Sending build completion notification to user ${userId}: "${message}"`);
        await sendMessageToUser(userId, message);
      } catch (error) {
        console.error(`❌ Failed to send notification for completed ${item.itemType} ${item.itemKey}:`, error);
        // Continue with other notifications even if one fails
      }
    }
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
          stmt.finalize(); // Always finalize the statement
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
        stmt.finalize(); // Always finalize the statement
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
        stmt.finalize(); // Always finalize the statement
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
