import { describe, expect, it } from 'vitest';

import { getDatabase } from '@/lib/server/database';
import { applyLookupIndexMigration } from '@/lib/server/migrations';
import { LOOKUP_INDEXES } from '@/lib/server/schema';
import { withTransaction } from '../../helpers/transactionHelper';

const EXPECTED_INDEXES = [
  { name: 'idx_users_username', table: 'users' },
  { name: 'idx_messages_recipient_created', table: 'messages' },
  { name: 'idx_battles_attacker_start', table: 'battles' },
  { name: 'idx_battles_attackee_start', table: 'battles' },
];

const readIndexes = async (): Promise<{ name: string; table: string }[]> => {
  const db = await getDatabase();
  const result = await db.query(
    `SELECT indexname AS name, tablename AS table FROM pg_indexes WHERE schemaname = 'public'`
  );
  return result.rows as { name: string; table: string }[];
};

describe('lookup indexes', () => {
  it('lookupIndexes_definitions_matchTheExpectedIndexes', () => {
    expect(LOOKUP_INDEXES.map((index) => index.name)).toEqual(EXPECTED_INDEXES.map((index) => index.name));
  });

  it('database_afterStartup_hasLookupIndexes', async () => {
    await withTransaction(async () => {
      const indexes = await readIndexes();

      for (const expected of EXPECTED_INDEXES) {
        expect(indexes).toContainEqual(expected);
      }
    });
  });

  it('applyLookupIndexMigration_indexMissing_createsItAgain', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      // Locks `messages` until the rollback; the migration then touches no other table, so
      // transactions of other test workers only wait and cannot deadlock with this one
      await db.query('DROP INDEX idx_messages_recipient_created');
      expect(await readIndexes()).not.toContainEqual(EXPECTED_INDEXES[1]);

      await applyLookupIndexMigration(db);

      expect(await readIndexes()).toContainEqual(EXPECTED_INDEXES[1]);
    });
  });
});
