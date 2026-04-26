import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { withTransaction } from '../../helpers/transactionHelper';

describe('MessageCache - German Summarization', () => {
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

  describe('German battle message summarization', () => {
    it('germanSummarization_germanBattleMessages_germanSummaryHeader', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest1');
        const ctx = createLockContext();

        // German-format battle messages
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Deine **pulse laser** hat 5 Schuss abgefeuert, **3 Treffer** für **24 Schaden**! Gegner: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'A: 💀 **Niederlage!** Du hast die Schlacht gegen SomeEnemy verloren. Du hast 100 Eisen verloren.');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId, 'de');

        expect(summary).toContain('Nachrichtenübersicht');
        expect(summary).toContain('⚔️');
        expect(summary).toContain('Niederlage(n)');
      });
    });

    it('germanSummarization_englishVictoryMessage_parsedCorrectly', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest2');
        const ctx = createLockContext();

        // English-format battle outcome message (should still be parsed by German summarizer)
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle! You gained 150 iron, 20 XP and 60 score from Alice.');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId, 'de');

        expect(summary).toContain('Nachrichtenübersicht');
        expect(summary).toContain('Kämpfe');
        expect(summary).toContain('1 Sieg(e)');
      });
    });

    it('germanSummarization_germanVictoryMessage_parsedCorrectly', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest3');
        const ctx = createLockContext();

        // German-format victory message
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Sieg!** Du hast die Schlacht gewonnen! Du hast 150 Eisen, 20 EP und 60 Punkte von Alice gewonnen.');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId, 'de');

        expect(summary).toContain('Nachrichtenübersicht');
        expect(summary).toContain('1 Sieg(e)');
      });
    });

    it('germanSummarization_germanCollectionMessage_parsedCorrectly', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest4');
        const ctx = createLockContext();

        await messageCache.createMessage(ctx, userId, 'P: Erfolgreich asteroid gesammelt und **173** Eisen erhalten.');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId, 'de');

        expect(summary).toContain('Nachrichtenübersicht');
        expect(summary).toContain('Sammlungen');
        expect(summary).toContain('1 Asteroid(en)');
        expect(summary).toContain('173');
      });
    });

    it('germanSummarization_germanBuildMessage_parsedCorrectly', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest5');
        const ctx = createLockContext();

        await messageCache.createMessage(ctx, userId, 'Bau abgeschlossen: Auto Turret');
        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId, 'de');

        expect(summary).toContain('Nachrichtenübersicht');
        expect(summary).toContain('Abgeschlossene Bauten');
        expect(summary).toContain('1 Auto Turret(s)');
      });
    });

    it('germanSummarization_noMessages_returnsGermanNoMessagesText', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest6');
        const ctx = createLockContext();
        const summary = await messageCache.summarizeMessages(ctx, userId, 'de');
        expect(summary).toBe('Keine Nachrichten zum Zusammenfassen.');
      });
    });
  });

  describe('Locale-independent parsePreviousSummary accumulation', () => {
    it('summarization_germanSummaryAccumulation_accumulatesCorrectly', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest7');
        const ctx = createLockContext();

        // First round: create a German summary
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Sieg!** Du hast die Schlacht gewonnen! Du hast 100 Eisen, 10 EP und 30 Punkte von Bob gewonnen.');
        await messageCache.waitForPendingWrites();
        const summary1 = await messageCache.summarizeMessages(ctx, userId, 'de');
        expect(summary1).toContain('1 Sieg(e)');

        // Second round: add more victory messages and re-summarize
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Sieg!** Du hast die Schlacht gewonnen! Du hast 50 Eisen, 5 EP und 15 Punkte von Charlie gewonnen.');
        await messageCache.waitForPendingWrites();
        const summary2 = await messageCache.summarizeMessages(ctx, userId, 'de');

        // Should accumulate: 1 (from first summary) + 1 (new) = 2 victories
        expect(summary2).toContain('2 Sieg(e)');
      });
    });

    it('summarization_englishSummaryThenGerman_accumulatesCorrectly', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('desumtest8');
        const ctx = createLockContext();

        // First round in English
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle! You gained 100 iron, 10 XP and 30 score from Bob.');
        await messageCache.waitForPendingWrites();
        const summary1 = await messageCache.summarizeMessages(ctx, userId, 'en');
        expect(summary1).toContain('1 victory(ies)');

        // Second round in German — should still accumulate the previous English summary
        await messageCache.createMessage(ctx, userId, 'A: 💀 **Defeat!** You lost the battle against Charlie. You lost 50 iron.');
        await messageCache.waitForPendingWrites();
        const summary2 = await messageCache.summarizeMessages(ctx, userId, 'de');

        // 1 victory accumulated from previous summary, 1 new defeat
        expect(summary2).toContain('1 Sieg(e)');
        expect(summary2).toContain('1 Niederlage(n)');
      });
    });
  });
});
