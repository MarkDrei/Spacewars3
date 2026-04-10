import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { withTransaction } from '../../helpers/transactionHelper';

describe('MessageCache - Build Completion Summarization', () => {
  let messageCache: MessageCache;

  beforeEach(async () => {
    const { clearTestDatabase } = await import('../../helpers/testDatabase');
    await clearTestDatabase();

    const ctx = createLockContext();
    MessageCache.resetInstance(ctx);
    await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
      await MessageCache.initialize(lockCtx, {
        persistenceIntervalMs: 30000,
        enableAutoPersistence: false
      });
    });
    messageCache = MessageCache.getInstance();
  });

  afterEach(async () => {
    try {
      await messageCache.waitForPendingWrites();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await messageCache.shutdown(lockCtx);
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });

  async function createTestUser(username: string): Promise<number> {
    const { getDatabase } = await import('@/lib/server/database');
    const db = await getDatabase();
    const result = await db.query(
      'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, 'hash', 0, Math.floor(Date.now() / 1000), '{}']
    );
    return result.rows[0].id;
  }

  describe('Build Complete Messages', () => {
    it('buildSummarization_singleBuildComplete_showsInSummary', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('build1');
        const ctx = createLockContext();

        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId);

        expect(summary).toContain('Message Summary');
        expect(summary).toContain('Builds Completed:');
        expect(summary).toContain('1 Auto Turret(s)');

        await messageCache.waitForPendingWrites();

        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
        expect(messagesAfter[0].message).toBe(summary);
      });
    });

    it('buildSummarization_multipleSameType_aggregatesCount', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('build2');
        const ctx = createLockContext();

        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId);

        expect(summary).toContain('Builds Completed:');
        expect(summary).toContain('3 Auto Turret(s)');
      });
    });

    it('buildSummarization_multipleDifferentTypes_showsAllTypes', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('build3');
        const ctx = createLockContext();

        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.createMessage(ctx, userId, 'Build complete: Kinetic Armor');
        await messageCache.createMessage(ctx, userId, 'Build complete: Pulse Laser');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId);

        expect(summary).toContain('Builds Completed:');
        expect(summary).toContain('2 Auto Turret(s)');
        expect(summary).toContain('1 Kinetic Armor(s)');
        expect(summary).toContain('1 Pulse Laser(s)');
      });
    });

    it('buildSummarization_noBuildMessages_noBuildsSection', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('build4');
        const ctx = createLockContext();

        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId);

        expect(summary).not.toContain('Builds Completed:');
      });
    });

    it('buildSummarization_mixedWithOtherMessages_bothSummarized', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('build5');
        const ctx = createLockContext();

        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **150** iron.');
        await messageCache.createMessage(ctx, userId, 'Build complete: Kinetic Armor');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId);

        expect(summary).toContain('Builds Completed:');
        expect(summary).toContain('1 Auto Turret(s)');
        expect(summary).toContain('1 Kinetic Armor(s)');
        expect(summary).toContain('Collections:');
        expect(summary).toContain('1 asteroid(s)');
        expect(summary).toContain('Iron Collected:');
        expect(summary).toContain('150');

        await messageCache.waitForPendingWrites();

        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
      });
    });

    it('buildSummarization_accumulatesAcrossMultipleSummarizations', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('build6');
        const ctx = createLockContext();

        // First batch
        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.waitForPendingWrites();

        const summary1 = await messageCache.summarizeMessages(ctx, userId);
        expect(summary1).toContain('2 Auto Turret(s)');
        await messageCache.waitForPendingWrites();

        // Second batch - includes new build complete messages and old summary
        await messageCache.createMessage(ctx, userId, 'Build complete: Auto Turret');
        await messageCache.createMessage(ctx, userId, 'Build complete: Kinetic Armor');
        await messageCache.waitForPendingWrites();

        const summary2 = await messageCache.summarizeMessages(ctx, userId);
        expect(summary2).toContain('3 Auto Turret(s)'); // 2 + 1
        expect(summary2).toContain('1 Kinetic Armor(s)');

        await messageCache.waitForPendingWrites();

        // Only one summary message should remain
        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
      });
    });
  });
});
