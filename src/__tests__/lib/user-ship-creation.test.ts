// ---
// Test for user ship creation
// ---

import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { DatabaseConnection, getDatabase, resetTestDatabase } from '@/lib/server/database';
import { createUser, saveUserToDb } from '@/lib/server/user/userRepo';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { withTransaction } from '../helpers/transactionHelper';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';

interface SpaceObjectRow {
  id: number;
  type: string;
  x: number;
  y: number;
  speed: number;
  angle: number;
  last_position_update_ms: number;
}

describe('User Ship Creation', () => {
  let db: DatabaseConnection;

  beforeEach(async () => {
    // Reset MessageCache to avoid stale database references
    const ctx = createLockContext();
    
    MessageCache.resetInstance(ctx);
    
    // Get database connection
    db = await getDatabase();
  });

  afterEach(async () => {
    // Wait for any pending message writes before resetting
    const ctx = createLockContext();
    try {
      const cache = MessageCache.getInstance();
      await cache.waitForPendingWrites();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await cache.shutdown(lockCtx);
      });
    } catch {
      // Ignore if cache was never initialized
    }
    
    // Reset cache
    MessageCache.resetInstance(ctx);
  });

  it('createUser_newUser_createsShipAndLinksIt', async () => {
    await withTransaction(async () => {
      // Create a new user
      const user = await createUser(db, 'testuser', 'passwordhash', saveUserToDb(db));
      
      // Verify user has a ship_id
      expect(user.ship_id).toBeDefined();
      expect(user.ship_id).toBeGreaterThan(0);
      
      // Verify the ship exists in the database
      const shipResult = await db.query('SELECT * FROM space_objects WHERE id = $1 AND type = $2', [user.ship_id, 'player_ship']);
      const ship = shipResult.rows[0] as SpaceObjectRow | undefined;
      
      expect(ship).toBeDefined();
      expect(ship).not.toBeNull();
      if (ship) {
        expect(ship.type).toBe('player_ship');
        expect(ship.x).toBe(250); // Center of world
        expect(ship.y).toBe(250); // Center of world
        expect(ship.speed).toBe(0);
        expect(ship.angle).toBe(0);
        expect(ship.last_position_update_ms).toBeGreaterThan(0);
      }
    });
  });

  it('createUser_multipleUsers_eachGetsOwnShip', async () => {
    await withTransaction(async () => {
      // Create two users
      const user1 = await createUser(db, 'user1', 'hash1', saveUserToDb(db));
      const user2 = await createUser(db, 'user2', 'hash2', saveUserToDb(db));
      
      // Verify each user has a different ship
      expect(user1.ship_id).toBeDefined();
      expect(user2.ship_id).toBeDefined();
      expect(user1.ship_id).not.toBe(user2.ship_id);
      
      // Verify both ships exist
      const shipsResult = await db.query('SELECT * FROM space_objects WHERE type = $1', ['player_ship']);
      const ships = shipsResult.rows as SpaceObjectRow[];
      
      // Note: There may be existing ships from seeded data, so check at least 2 ships with our user IDs
      expect(ships.map(s => s.id)).toContain(user1.ship_id);
      expect(ships.map(s => s.id)).toContain(user2.ship_id);
    });
  });
});
