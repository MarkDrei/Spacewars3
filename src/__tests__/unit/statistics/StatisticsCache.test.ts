// ---
// Unit tests for StatisticsCache
// Tests aggregate computation logic in isolation (no DB access).
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';
import { createEmptyUserStats } from '@/lib/server/statistics/statisticsTypes';
import { ResearchType } from '@/lib/server/techs/techtree';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function createTestCache(usernameResolver?: (id: number) => string | undefined): Promise<StatisticsCache> {
  // Initialize with a null db — test mode skips DB loading
  await StatisticsCache.initialize(
    null as never,
    usernameResolver ?? ((id) => `user${id}`)
  );
  return StatisticsCache.getInstance();
}

// ──────────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────────

describe('StatisticsCache', () => {
  beforeEach(() => {
    StatisticsCache.resetInstance();
  });

  afterEach(() => {
    StatisticsCache.resetInstance();
  });

  // ── recordEvent ────────────────────────────────────────────────────────────

  it('recordEvent_battleCompleted_updatesWinLossCounts', async () => {
    const cache = await createTestCache();

    await cache.recordEvent(1, 'battle_completed', {
      battleId: 100,
      opponentId: 2,
      won: true,
      damageDealt: 500,
      damageReceived: 200,
      ironTransferred: 100,
      xpAwarded: 50,
      durationSec: 30,
    });

    await cache.recordEvent(1, 'battle_completed', {
      battleId: 101,
      opponentId: 3,
      won: false,
      damageDealt: 300,
      damageReceived: 700,
      ironTransferred: 0,
      xpAwarded: 0,
      durationSec: 45,
    });

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let stats = createEmptyUserStats();
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      stats = cache.getUserStats(lockCtx, 1);
    });

    expect(stats.battlesWon).toBe(1);
    expect(stats.battlesLost).toBe(1);
    expect(stats.totalDamageDealt).toBe(800);
    expect(stats.totalDamageReceived).toBe(900);
    expect(stats.totalIronTransferred).toBe(100);
    expect(stats.totalXpAwarded).toBe(50);
    expect(stats.totalBattleDurationSec).toBe(75);
  });

  it('recordEvent_itemCollected_incrementsCorrectTypeCounter', async () => {
    const cache = await createTestCache();

    await cache.recordEvent(2, 'item_collected', {
      objectType: 'asteroid',
      ironAwarded: 10,
    });
    await cache.recordEvent(2, 'item_collected', {
      objectType: 'asteroid',
      ironAwarded: 15,
    });
    await cache.recordEvent(2, 'item_collected', {
      objectType: 'shipwreck',
      ironAwarded: 50,
    });
    await cache.recordEvent(2, 'item_collected', {
      objectType: 'escape_pod',
      ironAwarded: 0,
    });

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let stats = createEmptyUserStats();
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      stats = cache.getUserStats(lockCtx, 2);
    });

    expect(stats.asteroidsCollected).toBe(2);
    expect(stats.shipwrecksCollected).toBe(1);
    expect(stats.escapePodsCollected).toBe(1);
    expect(stats.totalIronFromCollection).toBe(75);
  });

  it('recordEvent_researchSpent_accumulatesIronSpent', async () => {
    const cache = await createTestCache();

    await cache.recordEvent(3, 'research_spent', {
      researchType: ResearchType.IronHarvesting,
      level: 2,
      ironCost: 1000,
    });
    await cache.recordEvent(3, 'research_spent', {
      researchType: ResearchType.ShipSpeed,
      level: 1,
      ironCost: 500,
    });

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let stats = createEmptyUserStats();
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      stats = cache.getUserStats(lockCtx, 3);
    });

    expect(stats.totalIronSpentOnResearch).toBe(1500);
    expect(stats.researchCount).toBe(2);
  });

  it('recordEvent_techSpent_accumulatesIronAndCount', async () => {
    const cache = await createTestCache();

    await cache.recordEvent(4, 'tech_spent', {
      itemKey: 'pulse_laser',
      itemType: 'weapon',
      ironCost: 300,
      count: 3,
    });
    await cache.recordEvent(4, 'tech_spent', {
      itemKey: 'energy_shield',
      itemType: 'defense',
      ironCost: 200,
      count: 2,
    });

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let stats = createEmptyUserStats();
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      stats = cache.getUserStats(lockCtx, 4);
    });

    expect(stats.totalIronSpentOnBuilds).toBe(500);
    expect(stats.totalBuildsCompleted).toBe(5);
  });

  // ── getGlobalStats ─────────────────────────────────────────────────────────

  it('getGlobalStats_multipleUsers_calculatesAveragesCorrectly', async () => {
    const cache = await createTestCache();

    // User 1: 4 battle wins
    for (let i = 0; i < 4; i++) {
      await cache.recordEvent(1, 'battle_completed', {
        battleId: i,
        opponentId: 99,
        won: true,
        damageDealt: 100,
        damageReceived: 50,
        ironTransferred: 10,
        xpAwarded: 10,
        durationSec: 30,
      });
    }

    // User 2: 2 battle wins
    for (let i = 0; i < 2; i++) {
      await cache.recordEvent(2, 'battle_completed', {
        battleId: 10 + i,
        opponentId: 99,
        won: true,
        damageDealt: 200,
        damageReceived: 100,
        ironTransferred: 20,
        xpAwarded: 20,
        durationSec: 60,
      });
    }

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let global: ReturnType<typeof cache.getGlobalStats> | null = null;
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      global = cache.getGlobalStats(lockCtx);
    });

    expect(global!.totalPlayers).toBe(2);
    // Average battlesWon: (4 + 2) / 2 = 3
    expect(global!.averages.battlesWon).toBe(3);
    // Average damage: (400 + 400) / 2 = 400
    expect(global!.averages.totalDamageDealt).toBe(400);
  });

  it('getGlobalStats_top5_returnsCorrectRanking', async () => {
    const cache = await createTestCache((id) => `player${id}`);

    // 6 users with different battle wins
    const winCounts = [10, 5, 8, 3, 7, 6];
    for (let userId = 1; userId <= 6; userId++) {
      for (let i = 0; i < winCounts[userId - 1]; i++) {
        await cache.recordEvent(userId, 'battle_completed', {
          battleId: userId * 100 + i,
          opponentId: 99,
          won: true,
          damageDealt: 0,
          damageReceived: 0,
          ironTransferred: 0,
          xpAwarded: 0,
          durationSec: 0,
        });
      }
    }

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let top5BattlesWon: Array<{ userId: number; value: number }> = [];
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      const globalStats = cache.getGlobalStats(lockCtx);
      top5BattlesWon = globalStats.top5.battlesWon;
    });

    // Expected ranking: user1=10, user3=8, user5=7, user6=6, user2=5
    expect(top5BattlesWon).toHaveLength(5);
    expect(top5BattlesWon[0].userId).toBe(1);
    expect(top5BattlesWon[0].value).toBe(10);
    expect(top5BattlesWon[1].userId).toBe(3);
    expect(top5BattlesWon[1].value).toBe(8);
    expect(top5BattlesWon[4].userId).toBe(2);
    expect(top5BattlesWon[4].value).toBe(5);
  });

  it('getGlobalStats_top5_handlesFewerThan5Players', async () => {
    const cache = await createTestCache();

    // Only 2 users
    await cache.recordEvent(1, 'battle_completed', {
      battleId: 1,
      opponentId: 2,
      won: true,
      damageDealt: 100,
      damageReceived: 50,
      ironTransferred: 10,
      xpAwarded: 10,
      durationSec: 30,
    });
    await cache.recordEvent(2, 'battle_completed', {
      battleId: 2,
      opponentId: 1,
      won: false,
      damageDealt: 50,
      damageReceived: 100,
      ironTransferred: 0,
      xpAwarded: 0,
      durationSec: 30,
    });

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let top5BattlesWon: Array<{ userId: number; value: number }> = [];
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      const globalStats = cache.getGlobalStats(lockCtx);
      top5BattlesWon = globalStats.top5.battlesWon;
    });

    // Only 2 players → top5 list has at most 2 entries
    expect(top5BattlesWon.length).toBeLessThanOrEqual(2);
    // Only user 1 won a battle
    expect(top5BattlesWon[0].userId).toBe(1);
    expect(top5BattlesWon[0].value).toBe(1);
  });

  // ── Empty stats ────────────────────────────────────────────────────────────

  it('getUserStats_unknownUser_returnsZeroedStats', async () => {
    const cache = await createTestCache();

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let stats = createEmptyUserStats();
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      stats = cache.getUserStats(lockCtx, 9999);
    });

    expect(stats.battlesWon).toBe(0);
    expect(stats.battlesLost).toBe(0);
    expect(stats.totalDamageDealt).toBe(0);
    expect(stats.totalIronFromCollection).toBe(0);
  });

  // ── NPC filtering ──────────────────────────────────────────────────────────

  it('getGlobalStats_npcEvents_excludedFromGlobalStats', async () => {
    const { NPC_USER_ID_OFFSET } = await import('@/lib/server/npc/npcConstants');
    const cache = await createTestCache((id) => `player${id}`);

    const npcId = NPC_USER_ID_OFFSET + 1000; // a valid NPC ID

    // Record events for a real player (id=1) and an NPC
    await cache.recordEvent(1, 'battle_completed', {
      battleId: 1,
      opponentId: npcId,
      won: true,
      damageDealt: 500,
      damageReceived: 100,
      ironTransferred: 0,
      xpAwarded: 10,
      durationSec: 30,
    });
    await cache.recordEvent(npcId, 'battle_completed', {
      battleId: 1,
      opponentId: 1,
      won: false,
      damageDealt: 100,
      damageReceived: 500,
      ironTransferred: 0,
      xpAwarded: 0,
      durationSec: 30,
    });

    const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
    const { STATISTICS_LOCK } = await import('@/lib/server/typedLocks');
    const ctx = createLockContext();
    let global: ReturnType<typeof cache.getGlobalStats> | null = null;
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      global = cache.getGlobalStats(lockCtx);
    });

    // Only the real player should be counted
    expect(global!.totalPlayers).toBe(1);
    // Top 5 should not include the NPC
    const top5 = global!.top5.battlesWon;
    expect(top5.every((e: { userId: number }) => e.userId < NPC_USER_ID_OFFSET)).toBe(true);
  });
});
