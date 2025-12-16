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
  // Only clear battles and messages, not users and space_objects
  // This avoids foreign key violations and is much faster
  const { clearTestDatabase, getTestDatabase } = await import('./testDatabase');
  const db = await getTestDatabase();
  
  // Clear battles table explicitly (battles reference users, so this must come first)
  await db.query('DELETE FROM battles', []);
  // Clear messages
  await clearTestDatabase();
  
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
