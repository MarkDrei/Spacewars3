// ---
// StatisticsCache: In-memory cache for user statistics events.
// Responsibilities:
//   - Buffer events in memory and flush to database periodically
//   - Compute per-user and global stat aggregates
//   - Provide fire-and-forget event recording for game events
// Main interaction partners:
//   - statisticsRepo (for DB persistence)
//   - battleService, harvest/route, trigger-research/route, build-item/route (event emitters)
//   - statistics API route (stat readers)
// Status: ✅ Initial implementation
// Lock Strategy: STATISTICS_LOCK (level 14)
// ---

import type { DatabaseConnection } from '../database';
import * as statisticsRepo from './statisticsRepo';
import {
  StatEventType,
  StatEventData,
  UserStatAggregates,
  GlobalStatAggregates,
  TopEntry,
  createEmptyUserStats,
  BattleCompletedEventData,
  ItemCollectedEventData,
  ResearchSpentEventData,
  TechSpentEventData,
} from './statisticsTypes';
import { createLockContext, HasLock14Context, IronLocks, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { STATISTICS_LOCK } from '../typedLocks';
import { Cache } from '../caches/Cache';

const PERSISTENCE_INTERVAL_MS = 60_000; // 60 seconds

declare global {
  var statisticsCacheInstance: StatisticsCache | null;
}

export class StatisticsCache extends Cache {
  private db: DatabaseConnection | null = null;

  // Un-flushed events waiting to be persisted
  private eventBuffer: Array<{
    userId: number;
    eventType: StatEventType;
    eventData: StatEventData;
    createdAt: bigint;
  }> = [];

  // Per-user aggregates
  private userAggregates: Map<number, UserStatAggregates> = new Map();

  // Username resolver dependency
  private usernameResolver: (userId: number) => string | undefined = () => undefined;

  private constructor() {
    super();
  }

  // ========================================
  // Singleton management
  // ========================================

  private static get instance(): StatisticsCache | null {
    return globalThis.statisticsCacheInstance || null;
  }

  private static set instance(value: StatisticsCache | null) {
    globalThis.statisticsCacheInstance = value;
  }

  static getInstance(): StatisticsCache {
    if (!StatisticsCache.instance) {
      throw new Error('StatisticsCache not initialized — call initialize() first');
    }
    return StatisticsCache.instance;
  }

  static resetInstance(): void {
    StatisticsCache.instance = null;
  }

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize the statistics cache.
   *
   * @param db - Database connection
   * @param usernameResolver - Resolves user ID → username (for top-5 entries)
   */
  static async initialize(
    db: DatabaseConnection,
    usernameResolver: (userId: number) => string | undefined
  ): Promise<void> {
    if (StatisticsCache.instance) {
      await StatisticsCache.instance.shutdown();
    }

    const cache = new StatisticsCache();
    cache.db = db;
    cache.usernameResolver = usernameResolver;

    // Load historical events and rebuild aggregates (skip in test mode)
    if (process.env.NODE_ENV !== 'test') {
      const events = await statisticsRepo.getAllEvents(db);
      for (const event of events) {
        cache.applyEventToAggregates(event.userId, event.eventType, event.eventData);
      }
      console.log(`📊 StatisticsCache loaded ${events.length} historical events`);
    }

    StatisticsCache.instance = cache;
    cache.startBackgroundPersistence();
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Record a game event (fire-and-forget friendly).
   * Callers should NOT await this — exceptions are caught internally.
   */
  async recordEvent(
    userId: number,
    eventType: StatEventType,
    eventData: StatEventData
  ): Promise<void> {
    try {
      const createdAt = BigInt(Date.now());

      const ctx = createLockContext();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await ctx.useLockWithAcquire(STATISTICS_LOCK, async (_lockCtx) => {
        // Add to buffer for later persistence
        this.eventBuffer.push({ userId, eventType, eventData, createdAt });

        // Update in-memory aggregates immediately
        this.applyEventToAggregates(userId, eventType, eventData);
      });
    } catch (err) {
      console.error('⚠️ StatisticsCache.recordEvent failed:', err);
    }
  }

  /**
   * Get per-user aggregates.
   * NOTE: Caller must hold STATISTICS_LOCK (level 14).
   */
  getUserStats<THeld extends IronLocks>(_context: HasLock14Context<THeld>, userId: number): UserStatAggregates {
    return this.userAggregates.get(userId) ?? createEmptyUserStats();
  }

  /**
   * Get global aggregates (averages + top-5).
   * NOTE: Caller must hold STATISTICS_LOCK (level 14).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getGlobalStats<THeld extends IronLocks>(_context: HasLock14Context<THeld>): GlobalStatAggregates {
    return this.computeGlobalStats();
  }

  // ========================================
  // Persistence
  // ========================================

  /**
   * Flush buffered events to database.
   * NOTE: Caller must hold STATISTICS_LOCK (level 14).
   */
  async flushBufferInternal<THeld extends IronLocks>(context: HasLock14Context<THeld>): Promise<void> {
    if (this.eventBuffer.length === 0) return;
    if (!this.db) return;

    const toFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await statisticsRepo.insertEvents(context, toFlush);
      console.log(`📊 StatisticsCache flushed ${toFlush.length} event(s) to DB`);
    } catch (err) {
      // Put events back if flush fails
      this.eventBuffer = [...toFlush, ...this.eventBuffer];
      console.error('⚠️ StatisticsCache flush failed:', err);
      throw err;
    }
  }

  /**
   * Override shutdown to acquire STATISTICS_LOCK (level 14) before flushing.
   * The base Cache.shutdown() takes LocksAtMostAndHas4, but we need level 14.
   */
  public async shutdown(): Promise<void> {
    this.stopBackgroundPersistence();

    if (this.eventBuffer.length === 0) return;

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
      await this.flushBufferInternal(lockCtx);
    });
  }

  /**
   * Satisfy abstract method from Cache base class.
   * Not used directly — we override shutdown() instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async flushAllToDatabase(_context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    // Intentionally no-op: flushBufferInternal is used via shutdown() override.
    // The base class requires this method to be implemented.
  }

  protected startBackgroundPersistence(): void {
    if (!this.shouldEnableBackgroundPersistence(true)) {
      console.log('📊 StatisticsCache background persistence disabled (test mode)');
      return;
    }

    if (this.persistenceTimer) {
      return; // Already running
    }

    this.persistenceTimer = setInterval(async () => {
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) => {
        await this.flushBufferInternal(lockCtx).catch((err) => {
          console.error('📊 Background statistics flush error:', err);
        });
      });
    }, PERSISTENCE_INTERVAL_MS);

    console.log('📊 StatisticsCache background persistence started (60s interval)');
  }

  // ========================================
  // Internal aggregate computation
  // ========================================

  private applyEventToAggregates(
    userId: number,
    eventType: StatEventType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventData: any
  ): void {
    let stats = this.userAggregates.get(userId);
    if (!stats) {
      stats = createEmptyUserStats();
      this.userAggregates.set(userId, stats);
    }

    switch (eventType) {
      case 'battle_completed': {
        const d = eventData as BattleCompletedEventData;
        if (d.won) {
          stats.battlesWon += 1;
        } else {
          stats.battlesLost += 1;
        }
        stats.totalDamageDealt += d.damageDealt ?? 0;
        stats.totalDamageReceived += d.damageReceived ?? 0;
        stats.totalIronTransferred += d.ironTransferred ?? 0;
        stats.totalXpAwarded += d.xpAwarded ?? 0;
        stats.totalBattleDurationSec += d.durationSec ?? 0;
        break;
      }
      case 'item_collected': {
        const d = eventData as ItemCollectedEventData;
        if (d.objectType === 'asteroid') stats.asteroidsCollected += 1;
        else if (d.objectType === 'shipwreck') stats.shipwrecksCollected += 1;
        else if (d.objectType === 'escape_pod') stats.escapePodsCollected += 1;
        stats.totalIronFromCollection += d.ironAwarded ?? 0;
        break;
      }
      case 'research_spent': {
        const d = eventData as ResearchSpentEventData;
        stats.totalIronSpentOnResearch += d.ironCost ?? 0;
        stats.researchCount += 1;
        break;
      }
      case 'tech_spent': {
        const d = eventData as TechSpentEventData;
        stats.totalIronSpentOnBuilds += d.ironCost ?? 0;
        stats.totalBuildsCompleted += d.count ?? 1;
        break;
      }
    }
  }

  private computeGlobalStats(): GlobalStatAggregates {
    const allUsers = Array.from(this.userAggregates.entries());
    const totalPlayers = allUsers.length;

    // Compute totals (sums across all players)
    const totals = createEmptyUserStats();
    for (const [, stats] of allUsers) {
      totals.battlesWon += stats.battlesWon;
      totals.battlesLost += stats.battlesLost;
      totals.totalDamageDealt += stats.totalDamageDealt;
      totals.totalDamageReceived += stats.totalDamageReceived;
      totals.totalIronTransferred += stats.totalIronTransferred;
      totals.totalXpAwarded += stats.totalXpAwarded;
      totals.totalBattleDurationSec += stats.totalBattleDurationSec;
      totals.asteroidsCollected += stats.asteroidsCollected;
      totals.shipwrecksCollected += stats.shipwrecksCollected;
      totals.escapePodsCollected += stats.escapePodsCollected;
      totals.totalIronFromCollection += stats.totalIronFromCollection;
      totals.totalIronSpentOnResearch += stats.totalIronSpentOnResearch;
      totals.researchCount += stats.researchCount;
      totals.totalIronSpentOnBuilds += stats.totalIronSpentOnBuilds;
      totals.totalBuildsCompleted += stats.totalBuildsCompleted;
    }

    // Compute averages (totals divided by player count)
    const averages = createEmptyUserStats();
    if (totalPlayers > 0) {
      const keys = Object.keys(totals) as Array<keyof UserStatAggregates>;
      for (const key of keys) {
        averages[key] = totals[key] / totalPlayers;
      }
    }

    // Build top-5 lists
    const makeTop5 = (getValue: (s: UserStatAggregates) => number): TopEntry[] => {
      return allUsers
        .map(([userId, stats]) => ({
          userId,
          username: this.usernameResolver(userId) ?? `User ${userId}`,
          value: getValue(stats),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    };

    return {
      totalPlayers,
      totals,
      averages,
      top5: {
        // Combat
        battlesWon: makeTop5((s) => s.battlesWon),
        battlesLost: makeTop5((s) => s.battlesLost),
        totalDamageDealt: makeTop5((s) => s.totalDamageDealt),
        totalDamageReceived: makeTop5((s) => s.totalDamageReceived),
        totalIronTransferred: makeTop5((s) => s.totalIronTransferred),
        totalXpAwarded: makeTop5((s) => s.totalXpAwarded),
        // Collection
        asteroidsCollected: makeTop5((s) => s.asteroidsCollected),
        shipwrecksCollected: makeTop5((s) => s.shipwrecksCollected),
        escapePodsCollected: makeTop5((s) => s.escapePodsCollected),
        totalIronFromCollection: makeTop5((s) => s.totalIronFromCollection),
        // Economy
        totalIronSpentOnResearch: makeTop5((s) => s.totalIronSpentOnResearch),
        researchCount: makeTop5((s) => s.researchCount),
        totalIronSpentOnBuilds: makeTop5((s) => s.totalIronSpentOnBuilds),
        totalBuildsCompleted: makeTop5((s) => s.totalBuildsCompleted),
      },
    };
  }
}
