import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';
import { STATISTICS_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from '@/lib/server/database';
import { getResearchEffectFromTree, ResearchType, createInitialTechTree } from '@/lib/server/techs/techtree';
import { NPC_USER_ID_OFFSET } from '@/lib/server/npc/npcConstants';

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  score: number;
  isCurrentUser: boolean;
}

export interface BestInData {
  // Battle / collection / economy — from StatisticsCache top5
  battlesWon: string | null;
  battlesLost: string | null;
  totalDamageDealt: string | null;
  totalDamageReceived: string | null;
  totalIronTransferred: string | null;
  totalXpAwarded: string | null;
  asteroidsCollected: string | null;
  shipwrecksCollected: string | null;
  escapePodsCollected: string | null;
  totalIronFromCollection: string | null;
  totalIronSpentOnResearch: string | null;
  researchCount: string | null;
  totalIronSpentOnBuilds: string | null;
  totalBuildsCompleted: string | null;
  // User-level fields — from DB query
  xp: string | null;
  shipSpeed: string | null;
  hullStrength: string | null;
  shield: string | null;
  armor: string | null;
  pulseLaser: string | null;
  autoTurret: string | null;
  plasmaLance: string | null;
  gaussRifle: string | null;
  photonTorpedo: string | null;
  rocketLauncher: string | null;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  bestIn: BestInData;
}

interface UserRow {
  id: number;
  username: string;
  score: number;
  xp: number;
  pulse_laser: number;
  auto_turret: number;
  plasma_lance: number;
  gauss_rifle: number;
  photon_torpedo: number;
  rocket_launcher: number;
  ship_hull: number;
  kinetic_armor: number;
  energy_shield: number;
  tech_tree: string;
}

function topUsername(rows: UserRow[], getValue: (r: UserRow) => number): string | null {
  if (rows.length === 0) return null;
  let best = rows[0];
  for (const row of rows) {
    if (getValue(row) > getValue(best)) {
      best = row;
    }
  }
  return getValue(best) > 0 ? best.username : null;
}

/** Ship speed research effect of a user row; 0 for an unparsable tech tree. */
function getShipSpeed(row: UserRow): number {
  try {
    const initialTree = createInitialTechTree();
    const parsedTree = row.tech_tree ? JSON.parse(row.tech_tree) : initialTree;
    return getResearchEffectFromTree({ ...initialTree, ...parsedTree }, ResearchType.ShipSpeed);
  } catch {
    return 0;
  }
}

function topByField(rows: UserRow[], field: keyof UserRow): string | null {
  return topUsername(rows, (r) => (r[field] as number) ?? 0);
}

/**
 * GET /api/leaderboard
 * Returns ranked player list (by score) and best-in-category winners.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const currentUserId = session.userId!;

    // ── 1. Fetch all users from DB ──────────────────────────────────────────
    const db = await getDatabase();
    const result = await db.query<UserRow>(
      `SELECT id, username, score, xp,
              pulse_laser, auto_turret, plasma_lance, gauss_rifle, photon_torpedo, rocket_launcher,
              ship_hull, kinetic_armor, energy_shield,
              tech_tree
       FROM users
       WHERE id < $1
       ORDER BY score DESC`,
      [NPC_USER_ID_OFFSET]
    );
    const userRows = result.rows;

    // ── 2. Build leaderboard ────────────────────────────────────────────────
    const leaderboard: LeaderboardEntry[] = userRows.map((row, index) => ({
      rank: index + 1,
      userId: row.id,
      username: row.username,
      score: row.score ?? 0,
      isCurrentUser: row.id === currentUserId,
    }));

    // ── 3. Best-in from DB user rows (no lock needed) ──────────────────────
    const shipSpeedByUserId = new Map(userRows.map((row) => [row.id, getShipSpeed(row)]));
    const userBestIn = {
      xp: topByField(userRows, 'xp'),
      shipSpeed: topUsername(userRows, (r) => shipSpeedByUserId.get(r.id) ?? 0),
      hullStrength: topByField(userRows, 'ship_hull'),
      shield: topByField(userRows, 'energy_shield'),
      armor: topByField(userRows, 'kinetic_armor'),
      pulseLaser: topByField(userRows, 'pulse_laser'),
      autoTurret: topByField(userRows, 'auto_turret'),
      plasmaLance: topByField(userRows, 'plasma_lance'),
      gaussRifle: topByField(userRows, 'gauss_rifle'),
      photonTorpedo: topByField(userRows, 'photon_torpedo'),
      rocketLauncher: topByField(userRows, 'rocket_launcher'),
    };

    // ── 4. Best-in from StatisticsCache ─────────────────────────────────────
    const statisticsCache = StatisticsCache.getInstance();
    const top5 = await createLockContext().useLockWithAcquire(STATISTICS_LOCK, async (lockCtx) =>
      statisticsCache.getGlobalStats(lockCtx).top5
    );
    const top1 = (list: { username: string }[]) => (list.length > 0 ? list[0].username : null);

    const bestIn = {
      battlesWon: top1(top5.battlesWon),
      battlesLost: top1(top5.battlesLost),
      totalDamageDealt: top1(top5.totalDamageDealt),
      totalDamageReceived: top1(top5.totalDamageReceived),
      totalIronTransferred: top1(top5.totalIronTransferred),
      totalXpAwarded: top1(top5.totalXpAwarded),
      asteroidsCollected: top1(top5.asteroidsCollected),
      shipwrecksCollected: top1(top5.shipwrecksCollected),
      escapePodsCollected: top1(top5.escapePodsCollected),
      totalIronFromCollection: top1(top5.totalIronFromCollection),
      totalIronSpentOnResearch: top1(top5.totalIronSpentOnResearch),
      researchCount: top1(top5.researchCount),
      totalIronSpentOnBuilds: top1(top5.totalIronSpentOnBuilds),
      totalBuildsCompleted: top1(top5.totalBuildsCompleted),
      ...userBestIn,
    } satisfies BestInData;

    return NextResponse.json({ leaderboard, bestIn } satisfies LeaderboardResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
