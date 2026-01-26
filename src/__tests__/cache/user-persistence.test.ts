import { describe, it, expect, beforeEach } from 'vitest';
import { UserCache } from '@/lib/server/user/userCache';
import { getDatabase } from '@/lib/server/database';
import { createUser } from '@/lib/server/user/userRepo';
import { saveUserToDb } from '@/lib/server/user/userRepo';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

describe('User Persistence to Database', () => {
  beforeEach(async () => {
    UserCache.resetInstance();
    const db = await getDatabase();
    await UserCache.intialize2(db);
  });

  it('userPersistence_dirtyUserModified_persitsToDatabase', async () => {
    // Arrange: Create a test user with unique username
    const username = `testuser_persist_${Date.now()}`;
    const db = await getDatabase();
    const saveCallback = saveUserToDb(db);
    const user = await createUser(db, username, 'hashedpass', saveCallback);
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
      await userWorldCache.flushAllToDatabaseWithLock(userCtx);
    });
    
    // Assert: Read directly from database to verify persistence
    const result = await db.query(
      'SELECT iron, pulse_laser FROM users WHERE id = $1',
      [user.id]
    );
    const userFromDb = result.rows[0] as { iron: number; pulse_laser: number };
    
    expect(userFromDb).toBeDefined();
    expect(userFromDb.iron).toBe(1000);
    expect(userFromDb.pulse_laser).toBe(10);
    expect(userFromDb.iron).not.toBe(initialIron);
    expect(userFromDb.pulse_laser).not.toBe(initialTechCount);
  });

  it('userPersistence_shutdownPersist_flushesUsers', async () => {
    // Arrange: Create a test user with unique username
    const username = `testuser_shutdown_${Date.now()}`;
    const db = await getDatabase();
    const saveCallback = saveUserToDb(db);
    const user = await createUser(db, username, 'hashedpass', saveCallback);
    
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
    const result = await db.query(
      'SELECT iron, auto_turret FROM users WHERE id = $1',
      [user.id]
    );
    const userFromDb = result.rows[0] as { iron: number; auto_turret: number };
    
    expect(userFromDb).toBeDefined();
    expect(userFromDb.iron).toBe(5000);
    expect(userFromDb.auto_turret).toBe(15);
  });
});
