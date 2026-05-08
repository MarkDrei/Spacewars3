#!/usr/bin/env tsx

import { Pool } from 'pg';

const NPC_USER_ID_OFFSET = 1_000_000;
const NPC_USER_ID_UPPER_BOUND = 2_000_000_000;

interface Options {
  ids: number[] | null;
  deleteMode: 'none' | 'safe' | 'cascade';
  includeActiveBattles: boolean;
}

interface NpcUserRecord {
  id: number;
  username: string;
  ship_id: number | null;
  in_battle: number;
  current_battle_id: number | null;
  has_persisted_space_object: boolean;
  battle_ref_count: number;
  active_battle_count: number;
  inventory_count: number;
  message_count: number;
  event_count: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    ids: null,
    deleteMode: 'none',
    includeActiveBattles: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--delete') {
      options.deleteMode = 'safe';
      continue;
    }

    if (arg === '--cascade') {
      options.deleteMode = 'cascade';
      continue;
    }

    if (arg === '--include-active-battles') {
      options.includeActiveBattles = true;
      continue;
    }

    if (arg === '--ids') {
      options.ids = parseIds(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg.startsWith('--ids=')) {
      options.ids = parseIds(arg.slice('--ids='.length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseIds(rawValue: string): number[] {
  const ids = rawValue
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value));

  if (ids.length === 0) {
    throw new Error('Expected at least one numeric NPC id after --ids');
  }

  return ids;
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/cleanup-npc-users.ts [options]

Options:
  --ids 1001009,1001010     Limit inspection/deletion to specific NPC user ids
  --delete                  Delete only safe NPC rows (no battle references)
  --cascade                 Delete matched NPC rows and their dependent battle data
  --include-active-battles  Allow cascade deletion even when active battles exist
  --help                    Show this help

Examples:
  tsx scripts/cleanup-npc-users.ts
  tsx scripts/cleanup-npc-users.ts --ids 1001009,1001010 --delete
  tsx scripts/cleanup-npc-users.ts --ids 1001008 --cascade --include-active-battles
`);
}

function getDatabaseConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'db',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'spacewars',
    user: process.env.POSTGRES_USER || 'spacewars',
    password: process.env.POSTGRES_PASSWORD || 'spacewars',
  };
}

function isSafeToDelete(record: NpcUserRecord): boolean {
  return record.in_battle === 0
    && record.current_battle_id === null
    && record.battle_ref_count === 0
    && record.active_battle_count === 0;
}

async function loadNpcUsers(pool: Pool, ids: number[] | null): Promise<NpcUserRecord[]> {
  const params: Array<number[] | number> = [NPC_USER_ID_OFFSET, NPC_USER_ID_UPPER_BOUND];
  let idFilter = '';

  if (ids && ids.length > 0) {
    params.push(ids);
    idFilter = 'AND u.id = ANY($3::int[])';
  }

  const result = await pool.query<NpcUserRecord>(
    `SELECT
      u.id,
      u.username,
      u.ship_id,
      u.in_battle,
      u.current_battle_id,
      EXISTS(SELECT 1 FROM space_objects so WHERE so.id = u.id) AS has_persisted_space_object,
      (SELECT COUNT(*)::int FROM battles b WHERE b.attacker_id = u.id OR b.attackee_id = u.id OR b.winner_id = u.id OR b.loser_id = u.id) AS battle_ref_count,
      (SELECT COUNT(*)::int FROM battles b WHERE (b.attacker_id = u.id OR b.attackee_id = u.id) AND b.battle_end_time IS NULL) AS active_battle_count,
      (SELECT COUNT(*)::int FROM inventories i WHERE i.user_id = u.id) AS inventory_count,
      (SELECT COUNT(*)::int FROM messages m WHERE m.recipient_id = u.id) AS message_count,
      (SELECT COUNT(*)::int FROM user_events e WHERE e.user_id = u.id) AS event_count
    FROM users u
    WHERE u.id >= $1 AND u.id < $2
      ${idFilter}
    ORDER BY u.id`,
    params,
  );

  return result.rows;
}

async function deleteNpcUser(pool: Pool, record: NpcUserRecord, options: Options): Promise<string> {
  if (options.deleteMode === 'safe' && !isSafeToDelete(record)) {
    return 'skipped (not safe to delete)';
  }

  if (options.deleteMode === 'cascade' && record.active_battle_count > 0 && !options.includeActiveBattles) {
    return 'skipped (active battles present; rerun with --include-active-battles to force)';
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (options.deleteMode === 'cascade') {
      const battleIdsResult = await client.query<{ id: number }>(
        'SELECT id FROM battles WHERE attacker_id = $1 OR attackee_id = $1 OR winner_id = $1 OR loser_id = $1',
        [record.id],
      );
      const battleIds = battleIdsResult.rows.map((row) => row.id);

      if (battleIds.length > 0) {
        await client.query(
          'UPDATE users SET in_battle = 0, current_battle_id = NULL WHERE current_battle_id = ANY($1::int[])',
          [battleIds],
        );
        await client.query('DELETE FROM battles WHERE id = ANY($1::int[])', [battleIds]);
      }
    }

    await client.query('DELETE FROM messages WHERE recipient_id = $1', [record.id]);
    await client.query('DELETE FROM user_events WHERE user_id = $1', [record.id]);
    await client.query('DELETE FROM inventories WHERE user_id = $1', [record.id]);
    await client.query('DELETE FROM space_objects WHERE id = $1', [record.id]);
    await client.query('DELETE FROM users WHERE id = $1', [record.id]);

    await client.query('COMMIT');
    return 'deleted';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function printSummary(records: NpcUserRecord[]): void {
  if (records.length === 0) {
    console.log('No NPC users found.');
    return;
  }

  console.table(records.map((record) => ({
    id: record.id,
    username: record.username,
    inBattle: record.in_battle === 1,
    currentBattleId: record.current_battle_id,
    battleRefs: record.battle_ref_count,
    activeBattles: record.active_battle_count,
    safeToDelete: isSafeToDelete(record),
    hasPersistedSpaceObject: record.has_persisted_space_object,
  })));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool(getDatabaseConfig());

  try {
    const records = await loadNpcUsers(pool, options.ids);
    printSummary(records);

    if (options.deleteMode === 'none') {
      console.log('Dry run only. Re-run with --delete for safe cleanup or --cascade for battle-linked cleanup.');
      return;
    }

    for (const record of records) {
      const outcome = await deleteNpcUser(pool, record, options);
      console.log(`${record.id}: ${outcome}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('NPC cleanup script failed:', error);
  process.exitCode = 1;
});