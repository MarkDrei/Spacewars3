import { initializeServer } from '@/lib/server/main';
import { resetTestDatabase } from '@/lib/server/database';
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

export async function initializeIntegrationTestServer(): Promise<void> {
  // With transaction-based isolation, we don't need to delete data
  // The transaction rollback will handle cleanup
  // We only need to reset the in-memory caches
  
  BattleCache.resetInstance();
  UserCache.resetInstance();
  WorldCache.resetInstance();
  MessageCache.resetInstance();
  
  // initializeServer will call getDatabase() which uses the existing database
  // with all users (including test users 3-10) already seeded
  await initializeServer();
}

export async function shutdownIntegrationTestServer(): Promise<void> {
  await shutdownUserWorldCache();
  await shutdownWorldCache();
  await shutdownMessageCache();
  BattleCache.resetInstance();
  UserCache.resetInstance();
  WorldCache.resetInstance();
  MessageCache.resetInstance();
}
