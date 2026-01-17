import { initializeServer } from '@/lib/server/main';
import { getDatabase } from '@/lib/server/database';
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
 * When using transaction-based test isolation, database changes are automatically rolled back.
 * This function focuses on cache management only.
 */
export async function initializeIntegrationTestServer(): Promise<void> {
  // IMPORTANT: Shutdown caches to ensure all pending async operations complete
  // This prevents race conditions with background persistence operations
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
  
  // Now reset all in-memory cache instances
  // Note: Must be done AFTER shutdown completes to avoid interfering with ongoing operations
  // UserCache.resetInstance() also calls WorldCache.resetInstance() internally
  BattleCache.resetInstance();
  MessageCache.resetInstance();
  UserCache.resetInstance();
  
  // Initialize server (this will reinitialize caches)
  // Note: With transaction-based isolation, database state is managed automatically
  // Each test runs in its own transaction that is rolled back after completion
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
