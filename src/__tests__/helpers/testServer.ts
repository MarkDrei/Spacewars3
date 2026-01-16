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
 * Clears test data and resets caches to ensure clean state for each test.
 */
export async function initializeIntegrationTestServer(): Promise<void> {
  const db = await getDatabase();
  
  // IMPORTANT: Shutdown caches BEFORE clearing data to ensure all pending async operations complete
  // This prevents foreign key violations from async message persistence
  // and race conditions with battle persistence
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
  
  // Now safe to clear battles and messages tables (keep users and space_objects for foreign key integrity)
  await db.query('DELETE FROM battles', []);
  await db.query('DELETE FROM messages', []);
  
  // Reset defense values for test users to default values
  // User 1 ('a'): reset to 250 (half of max 500)
  // User 2 ('dummy'): reset to 350 (half of max 700) 
  const now = Math.floor(Date.now() / 1000);
  await db.query(
    'UPDATE users SET hull_current = 250, armor_current = 250, shield_current = 250, defense_last_regen = $1 WHERE id = 1',
    [now]
  );
  await db.query(
    'UPDATE users SET hull_current = 350, armor_current = 350, shield_current = 350, defense_last_regen = $1 WHERE id = 2',
    [now]
  );
  
  // Initialize server (this will reinitialize caches)
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
