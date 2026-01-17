import { initializeServer } from '@/lib/server/main';
import { BattleCache } from '@/lib/server/battle/BattleCache';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { MessageCache } from '@/lib/server/messages/MessageCache';

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
  await cache.shutdown();
}

async function shutdownBattleCache(): Promise<void> {
  try {
    const cache = BattleCache.getInstance();
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
  // 1. BattleCache (depends on User/World/Message)
  // 2. MessageCache (no dependencies on other caches)
  // 3. UserCache (depends on World/Message) 
  // 4. WorldCache (used by UserCache)
  await shutdownBattleCache();
  await shutdownMessageCache();
  await shutdownUserWorldCache(); // Must be before WorldCache!
  await shutdownWorldCache();
  
  // Reset all in-memory cache instances
  // Note: Must be done AFTER shutdown completes to avoid interfering with ongoing operations
  // UserCache.resetInstance() also calls WorldCache.resetInstance() internally
  BattleCache.resetInstance();
  MessageCache.resetInstance();
  UserCache.resetInstance();
  
  // Initialize server (this will reinitialize caches)
  // No database cleanup - tests use withTransaction() for isolation
  await initializeServer();
}

/**
 * Shutdown integration test server and clean up resources.
 */
export async function shutdownIntegrationTestServer(): Promise<void> {
  // Shutdown in reverse dependency order:
  // Battle → Message → User → World
  await shutdownBattleCache();
  await shutdownMessageCache();
  await shutdownUserWorldCache(); // Must be before WorldCache!
  await shutdownWorldCache();
  
  // Reset instances after shutdown completes
  // UserCache.resetInstance() also resets WorldCache internally
  BattleCache.resetInstance();
  MessageCache.resetInstance();
  UserCache.resetInstance();
}
