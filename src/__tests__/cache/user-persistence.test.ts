import { describe, it, expect, beforeEach } from 'vitest';
import { TypedCacheManager } from '@/lib/server/typedCacheManager';
import { getDatabase } from '@/lib/server/database';
import { createUser } from '@/lib/server/userRepo';
import { saveUserToDb } from '@/lib/server/userRepo';

describe('User Persistence to Database', () => {
  beforeEach(() => {
    // Reset cache manager for each test
    TypedCacheManager.resetInstance();
  });

  it('userPersistence_dirtyUserModified_persitsToDatabase', async () => {
    // Arrange: Create a test user
    const db = await getDatabase();
    const saveCallback = saveUserToDb(db);
    const user = await createUser(db, 'testuser_persist', 'hashedpass', saveCallback);
    const initialIron = user.iron;
    const initialTechCount = user.techCounts.pulse_laser;
    
    // Get cache manager and initialize
    const cacheManager = TypedCacheManager.getInstance();
    await cacheManager.initialize();
    
    // Load user into cache
    const { createEmptyLockContext } = await import('@/lib/server/ironGuard');
    const emptyCtx = createEmptyLockContext();
    
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      // Set user in cache
      cacheManager.setUserUnsafe(user, userCtx);
    });
    
    // Act: Modify user data and mark as dirty
    user.iron = 1000;
    user.techCounts.pulse_laser = 10;
    
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      cacheManager.updateUserUnsafe(user, userCtx);
    });
    
    // Force flush to database
    await cacheManager.flushAllToDatabase();
    
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
    
    // Get cache manager
    const cacheManager = TypedCacheManager.getInstance();
    await cacheManager.initialize();
    
    // Load user into cache
    const { createEmptyLockContext } = await import('@/lib/server/ironGuard');
    const emptyCtx = createEmptyLockContext();
    
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      cacheManager.setUserUnsafe(user, userCtx);
    });
    
    // Act: Modify user and mark as dirty
    user.iron = 5000;
    user.techCounts.auto_turret = 15;
    
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      cacheManager.updateUserUnsafe(user, userCtx);
    });
    
    // Shutdown should persist dirty users
    await cacheManager.shutdown();
    
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
