// ---
// TechRepo - Database operations for ship technology and equipment
// Phase 4: Migrated to IronGuard V2
// ---

import sqlite3 from 'sqlite3';
import { TechCounts, TechFactory } from './TechFactory';
import { getDatabase } from './database';
import { getTypedCacheManagerV2 } from './typedCacheManagerV2';
import { createLockContext, type LockLevel } from './ironGuardV2';
import type { ValidUserLockContext } from './ironGuardTypesV2';
import { withUserLock, withDatabaseLock } from './lockHelpers';

export interface BuildQueueItem {
  itemKey: string;
  itemType: 'weapon' | 'defense';
  completionTime: number; // Unix timestamp when build completes
}

/**
 * TechRepoV2 - Uses IronGuard V2 lock system
 * Tech operations are user-specific, so they use USER lock
 */
export class TechRepoV2 {
  private db: sqlite3.Database;

  constructor(database: sqlite3.Database) {
    this.db = database;
  }

  /**
   * Get tech counts for a user's ship
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   */
  async getTechCounts(userId: number): Promise<TechCounts | null> {
    const ctx = createLockContext();
    
    return withUserLock(ctx, async (userCtx) => {
      return withDatabaseLock(userCtx, async () => {
        return new Promise<TechCounts | null>((resolve, reject) => {
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
            stmt.finalize();
            if (err) {
              reject(err);
              return;
            }
            resolve(result || null);
          });
        });
      });
    });
  }

  /**
   * Update tech counts for a user's ship
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   */
  async updateTechCounts(userId: number, techCounts: Partial<TechCounts>): Promise<void> {
    const ctx = createLockContext();
    
    return withUserLock(ctx, async (userCtx) => {
      return withDatabaseLock(userCtx, async () => {
        return new Promise<void>((resolve, reject) => {
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
            stmt.finalize();
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  /**
   * Get build queue for a user's ship
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   */
  async getBuildQueue(userId: number): Promise<BuildQueueItem[]> {
    const ctx = createLockContext();
    
    return withUserLock(ctx, async (userCtx) => {
      return withDatabaseLock(userCtx, async () => {
        return new Promise<BuildQueueItem[]>((resolve, reject) => {
          const stmt = this.db.prepare(`
            SELECT build_queue, build_start_sec 
            FROM users 
            WHERE id = ?
          `);
          
          stmt.get(userId, (err: Error | null, result: { build_queue: string | null; build_start_sec: number | null } | undefined) => {
            stmt.finalize();
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
              resolve([]);
            }
          });
        });
      });
    });
  }

  /**
   * Update build queue for a user's ship
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   */
  async updateBuildQueue(userId: number, queue: BuildQueueItem[], startTime?: number): Promise<void> {
    const ctx = createLockContext();
    
    return withUserLock(ctx, async (userCtx) => {
      return withDatabaseLock(userCtx, async () => {
        return new Promise<void>((resolve, reject) => {
          const queueJson = queue.length > 0 ? JSON.stringify(queue) : null;
          const stmt = this.db.prepare(`
            UPDATE users 
            SET build_queue = ?, build_start_sec = ?
            WHERE id = ?
          `);
          
          stmt.run(queueJson, startTime || null, userId, (err: Error | null) => {
            stmt.finalize();
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
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

  // Additional methods from original TechRepo can be added here if needed
  // For now, keeping the core functionality migrated
}

/**
 * Helper function to create TechRepoV2 instance
 */
export async function createTechRepoV2(): Promise<TechRepoV2> {
  const db = await getDatabase();
  return new TechRepoV2(db);
}
