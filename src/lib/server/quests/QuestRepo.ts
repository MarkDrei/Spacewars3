// ---
// QuestRepo - database access for the mission progress of a player (table quest_progress).
// Callers hold USER_INVENTORY_LOCK (LOCK_5): mission state and mission cargo change together.
// ---

import { HasLock5Context, LockLevel } from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from '../database';
import type { PlayerQuestState } from '@/shared/quests/questTypes';

interface QuestProgressRow {
  // pg parses JSONB columns automatically
  data: PlayerQuestState | string;
}

export class QuestRepo {
  /** Stored mission state of a player, or null when the player has none yet. */
  async load<THeld extends readonly LockLevel[]>(
    _context: HasLock5Context<THeld>,
    userId: number
  ): Promise<PlayerQuestState | null> {
    const db = await getDatabase();
    const result = await db.query<QuestProgressRow>('SELECT data FROM quest_progress WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) return null;
    const raw = result.rows[0].data;
    return typeof raw === 'string' ? (JSON.parse(raw) as PlayerQuestState) : raw;
  }

  async save<THeld extends readonly LockLevel[]>(
    _context: HasLock5Context<THeld>,
    userId: number,
    state: PlayerQuestState
  ): Promise<void> {
    const db = await getDatabase();
    await db.query(
      `INSERT INTO quest_progress (user_id, data) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data`,
      [userId, JSON.stringify(state)]
    );
  }

  async delete<THeld extends readonly LockLevel[]>(_context: HasLock5Context<THeld>, userId: number): Promise<void> {
    const db = await getDatabase();
    await db.query('DELETE FROM quest_progress WHERE user_id = $1', [userId]);
  }
}
