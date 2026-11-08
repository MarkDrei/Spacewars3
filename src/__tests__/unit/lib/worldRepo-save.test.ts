import { describe, it, expect, vi } from 'vitest';
import type { DatabaseConnection } from '@/lib/server/database';
import { loadWorldFromDb, saveWorldToDb } from '@/lib/server/world/worldRepo';

describe('saveWorldToDb (unit)', () => {
  it('saveWorldToDb_emptyWorld_issuesNoQuery', async () => {
    const emptyDb: DatabaseConnection = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    const fakeDb: DatabaseConnection = { query: vi.fn() };
    const world = await loadWorldFromDb(emptyDb, saveWorldToDb(fakeDb));

    await saveWorldToDb(fakeDb)(world);

    expect(fakeDb.query).not.toHaveBeenCalled();
  });

  it('saveWorldToDb_twoObjects_issuesSingleBatchedQuery', async () => {
    const rows = [
      { id: 1, type: 'asteroid', x: 1, y: 2, speed: 3, angle: 4, last_position_update_ms: 5, picture_id: 1 },
      { id: 2, type: 'asteroid', x: 6, y: 7, speed: 8, angle: 9, last_position_update_ms: 10, picture_id: 1 },
    ];
    const loadDb: DatabaseConnection = { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) };
    const fakeDb: DatabaseConnection = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 2 }) };
    const world = await loadWorldFromDb(loadDb, saveWorldToDb(fakeDb));

    await saveWorldToDb(fakeDb)(world);

    expect(fakeDb.query).toHaveBeenCalledTimes(1);
    const params = vi.mocked(fakeDb.query).mock.calls[0][1];
    expect(params).toEqual([[1, 2], [1, 6], [2, 7], [3, 8], [4, 9], [5, 10]]);
  });
});
