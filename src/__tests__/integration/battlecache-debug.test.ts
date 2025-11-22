// Debug test to understand BattleCache initialization
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserWorldCache, getUserWorldCache } from '../../lib/server/world/userWorldCache';
import { createTestDatabase } from '../helpers/testDatabase';
import { BATTLE_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

describe('BattleCache Debug Tests', () => {
  beforeEach(async () => {
    // Import and reset the test database
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
    
    await createTestDatabase();
    
    // Reset all caches to clean state
    BattleCache.resetInstance();
    UserWorldCache.resetInstance();
  });

  afterEach(async () => {
    // Clean shutdown
    try {
      await getBattleCache().shutdown();
      await getUserWorldCache().shutdown();
    } catch {
      // Ignore shutdown errors in tests
    }
  });

  it('debug_userWorldCacheInitialization_initializesBattleCache', async () => {
    
    const userWorldCache = getUserWorldCache();
    
    await userWorldCache.initialize();

    const emptyCtx = createLockContext();
    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      // Manually initialize BattleCache for tests (since test database doesn't auto-init)
      const battleCacheAfter = getBattleCache();
      console.log('⚔️ Got battle cache after init');
      
      try {
        console.log('🚀 Manually initializing BattleCache with test database...');
        const db = await userWorldCache.getDatabaseConnection();
        await battleCacheAfter.initialize(db);
        console.log('✅ BattleCache manual initialization complete');
      } catch (error) {
        console.error('❌ BattleCache manual initialization failed:', error);
        throw error;
      }
      
      // Test if BattleCache is initialized
      try {
        console.log('🔍 Testing BattleCache.getActiveBattles()...');
        const activeBattles = await battleCacheAfter.getActiveBattles(battleContext);
        console.log('✅ BattleCache.getActiveBattles() works, found:', activeBattles.length, 'battles');
        expect(activeBattles).toBeDefined();
        expect(Array.isArray(activeBattles)).toBe(true);
      } catch (error) {
        console.error('❌ BattleCache.getActiveBattles() failed:', error);
        throw error;
      }
    });
  });

  it('debug_battleCacheAutoInitialization_works', async () => {
    
    // First initialize the cache manager (for database)
    const userWorldCache = getUserWorldCache();
    await userWorldCache.initialize();

    const emptyCtx = createLockContext();
    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      // Get BattleCache and test auto-initialization
      const battleCache = getBattleCache();
      
      const activeBattles = await battleCache.getActiveBattles(battleContext);
      expect(activeBattles).toBeDefined();
      expect(Array.isArray(activeBattles)).toBe(true);
    });

  });
});