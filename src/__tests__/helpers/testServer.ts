import { initializeServer } from '@/lib/server/main';
import { BattleCache } from '@/lib/server/battle/BattleCache';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';

async function shutdownUserWorldCache(): Promise<void> {
  try {
    const cache = UserCache.getInstance2();
    await cache.shutdown();
  } catch {
    // Ignore if cache was never initialized
  }
}

async function shutdownWorldCache(): Promise<void> {
  try {
    const cache = WorldCache.getInstance();
    await cache.shutdown();
  } catch {
    // Ignore if cache was never initialized
  }
}

async function shutdownMessageCache(): Promise<void> {
  const cache = (MessageCache as unknown as { instance?: MessageCache | null }).instance ?? null;
  if (!cache) {
    return;
  }
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
    await cache.shutdown(lockCtx);
  });
}

async function shutdownBattleCache(): Promise<void> {
  try {
    const cache = BattleCache.getInstance();
    await cache.shutdown();
  } catch {
    // Ignore if cache was never initialized
  }
}

async function shutdownStatisticsCache(): Promise<void> {
  try {
    const cache = StatisticsCache.getInstance();
    await cache.shutdown();
  } catch {
    // Ignore if cache was never initialized
  }
}

/**
 * Initialize integration test server.
 * 
 * Phase 2 of transaction-based test isolation:
 * - NO database manipulation (transactions handle isolation via ROLLBACK)
 * - Only shutdown and reset caches to ensure clean state
 * - Tests MUST use withTransaction() to wrap test code for automatic rollback
 * 
 * Background: Phase 1 eliminated background persistence race conditions by making
 * all cache writes synchronous in test mode. This means data is immediately
 * persisted within the transaction scope, and will be rolled back when the
 * transaction ends.
 */
export async function initializeIntegrationTestServer(): Promise<void> {
  // Shutdown caches to ensure all pending async operations complete
  // 
  // Shutdown order is critical (reverse dependency order):
  // 1. StatisticsCache (no dependencies on other caches)
  // 2. BattleCache (depends on User/World/Message)
  // 3. MessageCache (no dependencies on other caches)
  // 4. UserCache (depends on World/Message) 
  // 5. WorldCache (used by UserCache)
  await shutdownStatisticsCache();
  await shutdownBattleCache();
  await shutdownMessageCache();
  await shutdownUserWorldCache(); // Must be before WorldCache!
  await shutdownWorldCache();
  
  // Reset all in-memory cache instances
  // Note: Must be done AFTER shutdown completes to avoid interfering with ongoing operations
  // UserCache.resetInstance() also calls WorldCache.resetInstance() internally
  StatisticsCache.resetInstance();
  BattleCache.resetInstance();
  const ctx = createLockContext();
  MessageCache.resetInstance(ctx);
  UserCache.resetInstance();
  UserBonusCache.resetInstance();
  
  // Initialize server (this will reinitialize caches)
  // No database cleanup - tests use withTransaction() for isolation
  await initializeServer();
}

/**
 * Shutdown integration test server and clean up resources.
 */
export async function shutdownIntegrationTestServer(): Promise<void> {
  // Shutdown in reverse dependency order:
  // Statistics → Battle → Message → User → World
  await shutdownStatisticsCache();
  await shutdownBattleCache();
  await shutdownMessageCache();
  await shutdownUserWorldCache(); // Must be before WorldCache!
  await shutdownWorldCache();
  
  // Reset instances after shutdown completes
  // UserCache.resetInstance() also resets WorldCache internally
  StatisticsCache.resetInstance();
  BattleCache.resetInstance();
  const ctx = createLockContext();
  MessageCache.resetInstance(ctx);
  UserCache.resetInstance();
  UserBonusCache.resetInstance();
}
