import { describe, it, expect, beforeEach } from 'vitest';
import { UserWorldCache } from '@/lib/server/world/userWorldCache';
import { getDatabase } from '@/lib/server/database';
import { createUser } from '@/lib/server/world/userRepo';
import { saveUserToDb } from '@/lib/server/world/userRepo';

describe('User Persistence to Database', () => {
  beforeEach(() => {
    // Reset cache manager for each test
    UserWorldCache.resetInstance();
  });

  it('userPersistence_dirtyUserModified_persitsToDatabase', async () => {
    // Arrange: Create a test user
    const db = await getDatabase();
    const saveCallback = saveUserToDb(db);
    const user = await createUser(db, 'testuser_persist', 'hashedpass', saveCallback);
    const initialIron = user.iron;
    const initialTechCount = user.techCounts.pulse_laser;
    
    // Get cache manager and initialize
    const cacheManager = UserWorldCache.getInstance();
    await cacheManager.initialize();
    
    // Load user into cache
    const { createLockContext } = await import('@/lib/server/typedLocks');
    const emptyCtx = createLockContext();
    
    const userCtx = await cacheManager.acquireUserLock(emptyCtx);
    try {
      // Set user in cache
      cacheManager.setUserUnsafe(user, userCtx);
    } finally {
      userCtx.dispose();
    }
    
    // Act: Modify user data and mark as dirty
    user.iron = 1000;
    user.techCounts.pulse_laser = 10;
    
    const userCtx2 = await cacheManager.acquireUserLock(emptyCtx);
    try {
      cacheManager.updateUserInCache(user, userCtx2);
    } finally {
      userCtx2.dispose();
    }
    
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
    const cacheManager = UserWorldCache.getInstance();
    await cacheManager.initialize();
    
    // Load user into cache
    const { createLockContext } = await import('@/lib/server/typedLocks');
    const emptyCtx = createLockContext();
    
    const userCtx = await cacheManager.acquireUserLock(emptyCtx);
    try {
      cacheManager.setUserUnsafe(user, userCtx);
    } finally {
      userCtx.dispose();
    }
    
    // Act: Modify user and mark as dirty
    user.iron = 5000;
    user.techCounts.auto_turret = 15;
    
    const userCtx2 = await cacheManager.acquireUserLock(emptyCtx);
    try {
      cacheManager.updateUserInCache(user, userCtx2);
    } finally {
      userCtx2.dispose();
    }
    
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
