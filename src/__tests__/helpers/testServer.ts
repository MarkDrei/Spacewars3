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
  await resetTestDatabase();
  BattleCache.resetInstance();
  UserCache.resetInstance();
  WorldCache.resetInstance();
  MessageCache.resetInstance();
  
  // initializeServer will call getDatabase() which creates the test database
  // with all users (including test users 3-10)
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
