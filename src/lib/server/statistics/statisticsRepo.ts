// ---
// StatisticsRepository: Pure database operations ONLY for user events / statistics.
// Responsibilities:
//   - Read/write user_events data from/to database
//   - NO cache access, NO business logic, NO orchestration
//   - Called ONLY by StatisticsCache for persistence
// Status: ✅ Initial implementation
// ---

import type { StatEvent, StatEventType } from './statisticsTypes';
import type { DatabaseConnection } from '../database';
import { getDatabase } from '../database';
import { HasLock14Context, IronLocks } from '@markdrei/ironguard-typescript-locks';

// ========================================
// Pure Database Write Operations
// ========================================

/**
 * Insert a single event into database.
 * NOTE: Caller must hold STATISTICS_LOCK (level 14).
 */
// needs _context for compile time lock checking
export async function insertEvent<THeld extends IronLocks>(
  _context: HasLock14Context<THeld>,
  userId: number,
  eventType: StatEventType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventData: any
): Promise<void> {
  const db = await getDatabase();
  const createdAt = BigInt(Date.now());

  await db.query(
    `INSERT INTO user_events (user_id, event_type, event_data, created_at) VALUES ($1, $2, $3, $4)`,
    [userId, eventType, JSON.stringify(eventData), createdAt.toString()]
  );
}

/**
 * Insert multiple events into database in a batch.
 * NOTE: Caller must hold STATISTICS_LOCK (level 14).
 */
export async function insertEvents<THeld extends IronLocks>(
  _context: HasLock14Context<THeld>,
  events: Array<{ userId: number; eventType: StatEventType; eventData: unknown; createdAt: bigint }>
): Promise<void> {
  if (events.length === 0) return;

  const db = await getDatabase();

  // Build a batched INSERT with positional parameters
  const values: unknown[] = [];
  const placeholders = events.map((event, index) => {
    const base = index * 4;
    values.push(event.userId, event.eventType, JSON.stringify(event.eventData), event.createdAt.toString());
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });

  await db.query(
    `INSERT INTO user_events (user_id, event_type, event_data, created_at) VALUES ${placeholders.join(', ')}`,
    values
  );
}

// ========================================
// Pure Database Read Operations
// ========================================

/**
 * Load all events from database (for cache initialization).
 * No lock needed — called only during startup before any concurrent access.
 */
export async function getAllEvents(db: DatabaseConnection): Promise<StatEvent[]> {
  const result = await db.query(
    `SELECT id, user_id, event_type, event_data, created_at FROM user_events ORDER BY created_at ASC`
  );

  return result.rows.map(deserializeEvent);
}

/**
 * Load all events for a specific user from database.
 * No lock needed — used for initialization or single-user queries.
 */
export async function getEventsByUserId(db: DatabaseConnection, userId: number): Promise<StatEvent[]> {
  const result = await db.query(
    `SELECT id, user_id, event_type, event_data, created_at FROM user_events WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );

  return result.rows.map(deserializeEvent);
}

// ========================================
// Helper Functions
// ========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeEvent(row: any): StatEvent {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type as StatEventType,
    eventData: row.event_data,
    createdAt: BigInt(row.created_at),
  };
}
