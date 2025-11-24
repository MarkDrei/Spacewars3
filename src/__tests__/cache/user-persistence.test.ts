import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserCache } from '@/lib/server/user/userCache';
import { getDatabase } from '@/lib/server/database';
import { createUser } from '@/lib/server/user/userRepo';
import { saveUserToDb } from '@/lib/server/user/userRepo';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { after } from 'node:test';

describe('User Persistence to Database', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    UserCache.resetInstance();
    const db = await getDatabase();
    await UserCache.intialize2({ db });
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer
  });

  it('userPersistence_dirtyUserModified_persitsToDatabase', async () => {
    // Arrange: Create a test user
    const db = await getDatabase();
    const saveCallback = saveUserToDb(db);
    const user = await createUser(db, 'testuser_persist', 'hashedpass', saveCallback);
    const initialIron = user.iron;
    const initialTechCount = user.techCounts.pulse_laser;
    
    // Get cache manager and initialize
    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    
    // Load user into cache
    
    await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
      userWorldCache.setUserUnsafe(userCtx, user);

      // Act: Modify user data and mark as dirty
      user.iron = 1000;
      user.techCounts.pulse_laser = 10;
      
      userWorldCache.updateUserInCache(userCtx, user);
      // Force flush to database
      await userWorldCache.flushAllToDatabase(userCtx);
    });
    
    // Assert: Read directly from database to verify persistence
    const userFromDb = await new Promise<{ iron: number; pulse_laser: number }>((resolve, reject) => {
      db.get(
        'SELECT iron, pulse_laser FROM users WHERE id = ?',
        [user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row as { iron: number; pulse_laser: number });
        }
      );
    });
    
    expect(userFromDb).toBeDefined();
    expect(userFromDb.iron).toBe(1000);
    expect(userFromDb.pulse_laser).toBe(10);
    expect(userFromDb.iron).not.toBe(initialIron);
    expect(userFromDb.pulse_laser).not.toBe(initialTechCount);
  });

  it('userPersistence_shutdownPersist_flushesUsers', async () => {
    // Arrange: Create a test user
    const db = await getDatabase();
    const saveCallback = saveUserToDb(db);
    const user = await createUser(db, 'testuser_shutdown_persist', 'hashedpass', saveCallback);
    
    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    
    await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
      // Load user into cache
      userWorldCache.setUserUnsafe(userCtx, user);

      // Act: Modify user and mark as dirty
      user.iron = 5000;
      user.techCounts.auto_turret = 15;
      
      userWorldCache.updateUserInCache(userCtx, user);
    });

    // Shutdown should persist dirty users
    await userWorldCache.shutdown();
    
    // Assert: Read directly from database to verify persistence on shutdown
    const userFromDb = await new Promise<{ iron: number; auto_turret: number }>((resolve, reject) => {
      db.get(
        'SELECT iron, auto_turret FROM users WHERE id = ?',
        [user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row as { iron: number; auto_turret: number });
        }
      );
    });
    
    expect(userFromDb).toBeDefined();
    expect(userFromDb.iron).toBe(5000);
    expect(userFromDb.auto_turret).toBe(15);
  });
});
