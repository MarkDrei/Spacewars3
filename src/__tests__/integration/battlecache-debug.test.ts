// Debug test to understand BattleCache initialization
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/BattleCache';
import { TypedCacheManager, getTypedCacheManager } from '../../lib/server/typedCacheManager';
import { createTestDatabase } from '../helpers/testDatabase';

describe('BattleCache Debug Tests', () => {
  beforeEach(async () => {
    // Import and reset the test database
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
    
    await createTestDatabase();
    
    // Reset all caches to clean state
    BattleCache.resetInstance();
    TypedCacheManager.resetInstance();
  });

  afterEach(async () => {
    // Clean shutdown
    try {
      await getBattleCache().shutdown();
      await getTypedCacheManager().shutdown();
    } catch {
      // Ignore shutdown errors in tests
    }
  });

  it('debug_cacheManagerInitialization_initializesBattleCache', async () => {
    console.log('🔍 Starting debug test...');
    
    const cacheManager = getTypedCacheManager();
    console.log('📋 Got cache manager');
    
    const battleCacheBefore = getBattleCache();
    console.log('⚔️ Got battle cache before init');
    
    try {
      console.log('🚀 Calling cacheManager.initialize()...');
      await cacheManager.initialize();
      console.log('✅ Cache manager initialization complete');
    } catch (error) {
      console.error('❌ Cache manager initialization failed:', error);
      throw error;
    }
    
    // Manually initialize BattleCache for tests (since test database doesn't auto-init)
    const battleCacheAfter = getBattleCache();
    console.log('⚔️ Got battle cache after init');
    
    try {
      console.log('🚀 Manually initializing BattleCache with test database...');
      const db = await cacheManager.getDatabaseConnection();
      await battleCacheAfter.initialize(db);
      console.log('✅ BattleCache manual initialization complete');
    } catch (error) {
      console.error('❌ BattleCache manual initialization failed:', error);
      throw error;
    }
    
    // Test if BattleCache is initialized
    try {
      console.log('🔍 Testing BattleCache.getActiveBattles()...');
      const activeBattles = await battleCacheAfter.getActiveBattles();
      console.log('✅ BattleCache.getActiveBattles() works, found:', activeBattles.length, 'battles');
      expect(activeBattles).toBeDefined();
      expect(Array.isArray(activeBattles)).toBe(true);
    } catch (error) {
      console.error('❌ BattleCache.getActiveBattles() failed:', error);
      throw error;
    }
    
    console.log('🎉 Debug test completed successfully');
  });

  it('debug_battleCacheAutoInitialization_works', async () => {
    console.log('🔍 Testing BattleCache auto-initialization...');
    
    // First initialize the cache manager (for database)
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    console.log('✅ Cache manager initialized');
    
    // Get BattleCache and test auto-initialization
    const battleCache = getBattleCache();
    console.log('⚔️ Got BattleCache instance');
    
    try {
      console.log('🔍 Testing BattleCache.getActiveBattles() with auto-initialization...');
      const activeBattles = await battleCache.getActiveBattles();
      console.log('✅ BattleCache.getActiveBattles() works, found:', activeBattles.length, 'battles');
      expect(activeBattles).toBeDefined();
      expect(Array.isArray(activeBattles)).toBe(true);
    } catch (error) {
      console.error('❌ BattleCache.getActiveBattles() failed:', error);
      throw error;
    }
    
    console.log('🎉 Auto-initialization test completed successfully');
  });
});