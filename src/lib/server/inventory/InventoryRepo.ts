// ---
// InventoryRepo - Database operations for player inventories
// Single responsibility: all direct DB interactions for the inventory table.
// Callers must hold USER_INVENTORY_LOCK (LOCK_5) before calling any method.
// ---

import { HasLock5Context, LockLevel } from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from '../database';
import {
  InventoryGrid,
  createEmptyInventoryGrid,
} from './inventoryTypes';

interface InventoryRow {
  user_id: number;
  // pg parses JSONB columns automatically, so this may be a string or an object
  inventory_data: string | InventoryGrid;
}

/**
 * InventoryRepo - Repository pattern for inventory database operations.
 *
 * Does NOT:
 *  - Handle business logic (that is InventoryService's job)
 *  - Handle locking (caller's responsibility, verified via context type parameters)
 */
export class InventoryRepo {
  /**
   * Load the inventory grid for a user, or null if no row exists yet.
   */
  async getInventory<THeld extends readonly LockLevel[]>(
    _context: HasLock5Context<THeld>,
    userId: number
  ): Promise<InventoryGrid | null> {
    const db = await getDatabase();
    const result = await db.query<InventoryRow>(
      `SELECT user_id, inventory_data FROM inventories WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return null;

    try {
      const raw = result.rows[0].inventory_data;
      // pg automatically parses JSONB columns into JavaScript objects.
      // Guard against both cases: raw string (unlikely) and already-parsed object.
      if (typeof raw === 'string') {
        return JSON.parse(raw) as InventoryGrid;
      }
      return raw as InventoryGrid;
    } catch {
      // Corrupted data – return empty grid
      return createEmptyInventoryGrid();
    }
  }

  /**
   * Persist (upsert) the full inventory grid for a user.
   */
  async saveInventory<THeld extends readonly LockLevel[]>(
    _context: HasLock5Context<THeld>,
    userId: number,
    grid: InventoryGrid
  ): Promise<void> {
    const db = await getDatabase();
    await db.query(
      `INSERT INTO inventories (user_id, inventory_data)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET inventory_data = EXCLUDED.inventory_data`,
      [userId, JSON.stringify(grid)]
    );
  }

  /**
   * Delete the inventory row for a user (e.g. on account deletion).
   */
  async deleteInventory<THeld extends readonly LockLevel[]>(
    _context: HasLock5Context<THeld>,
    userId: number
  ): Promise<void> {
    const db = await getDatabase();
    await db.query(`DELETE FROM inventories WHERE user_id = $1`, [userId]);
  }
}
