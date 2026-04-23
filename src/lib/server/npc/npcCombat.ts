/**
 * NPC Combat — upsert NPC users into the database with randomised stats,
 * create temporary space objects for battle, and handle iron rewards.
 *
 * Called on first attack (lazy creation) and on midnight respawn (re-randomise).
 */

import { getDatabase } from '../database';
import type { NpcShip } from './npcTypes';
import { npcUserId, npcDisplayName } from './npcConstants';
import type { TechCounts } from '../techs/TechFactory';
import { TechFactory } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import { createInitialTechTree } from '../techs/techtree';
import { UserBonusCache } from '../bonus/UserBonusCache';
import { UserCache } from '../user/userCache';
import { NPCManager } from './NPCManager';
import type { LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '../world/worldCache';
import { WORLD_LOCK } from '../typedLocks';
import type { SpaceObject } from '../world/world';

/** Fixed bcrypt hash that is not loginable (invalid format placeholder). */
const NPC_PASSWORD_HASH =
  '$2b$10$NPCNPCNPCNPCNPCNPCNPCNPCNPCNPCNPCNPCNPCNPCNPCNPCNPC';

/** All 6 weapon column keys in the DB / TechCounts. */
const ALL_WEAPON_KEYS: (keyof TechCounts)[] = TechFactory.getWeaponKeys() as (keyof TechCounts)[];

/** Defense base values per level (before random variance). */
const DEFENSE_BASE_PER_LEVEL = 10;

/** Weapon base count per level before random variance. */
const WEAPON_BASE_PER_LEVEL = 5;

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

/**
 * Apply random variance to a base value.
 * Result is `Math.round(base * uniform(0.6, 1.7))`.
 */
function applyVariance(base: number): number {
  return Math.round(base * (0.6 + Math.random() * 1.1));
}

/**
 * Pick `count` unique random elements from `arr`.
 */
function pickRandom<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// Tech-count generation
// ---------------------------------------------------------------------------

/**
 * Generate randomised tech counts for an NPC.
 *
 * - Defense values: (DEFENSE_BASE_PER_LEVEL × level) × uniform(0.6, 1.7) for hull/armor/shield; jammer stays 0.
 * - Weapons: `numWeapons = min(npcIndex + 1, 6)` randomly chosen weapon types
 *   each receiving `(WEAPON_BASE_PER_LEVEL × level) × uniform(0.6, 1.7)`; others set to 0.
 */
export function generateNpcTechCounts(npcIndex: number, npcLevel: number = 1): TechCounts {
  const numWeapons = Math.min(npcIndex + 1, ALL_WEAPON_KEYS.length);
  const selectedWeapons = new Set(pickRandom(ALL_WEAPON_KEYS, numWeapons));

  const defenseBase = DEFENSE_BASE_PER_LEVEL * npcLevel;
  const weaponBase = WEAPON_BASE_PER_LEVEL * npcLevel;

  const techCounts: TechCounts = {
    pulse_laser: 0,
    auto_turret: 0,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: applyVariance(defenseBase),
    kinetic_armor: applyVariance(defenseBase),
    energy_shield: applyVariance(defenseBase),
    missile_jammer: 0, // stays 0
  };

  for (const key of ALL_WEAPON_KEYS) {
    if (selectedWeapons.has(key)) {
      techCounts[key] = applyVariance(weaponBase);
    }
  }

  return techCounts;
}

// ---------------------------------------------------------------------------
// Upsert NPC user
// ---------------------------------------------------------------------------

/**
 * Upsert an NPC user row into the `users` table with freshly randomised stats.
 *
 * Idempotent: safe to call multiple times (uses `ON CONFLICT DO UPDATE`).
 * Also creates a temporary space object in WorldCache so the battle system
 * can find the NPC's ship position.
 *
 * @param npc The in-memory NPC ship descriptor.
 * @param context Lock context holding at least USER_LOCK (LOCK_4).
 */
export async function upsertNpcUser(
  npc: NpcShip,
  context: LockContext<LocksAtMostAndHas4>,
): Promise<void> {
  const npcId = npcUserId(npc.ownerId, npc.npcIndex);
  const username = npcDisplayName(npc.level);
  const now = Math.floor(Date.now() / 1000);

  // 1. Generate randomised tech counts scaled to NPC level
  const techCounts = generateNpcTechCounts(npc.npcIndex, npc.level);

  // 2. Create initial tech tree & compute max defense
  const techTree = createInitialTechTree();
  const maxDef = TechService.calculateMaxDefense(techCounts, techTree);

  // 3. Upsert into DB (all columns, ON CONFLICT DO UPDATE)
  const db = await getDatabase();

  await db.query(
    `INSERT INTO users (
        id, username, password_hash, iron, xp, last_updated, tech_tree, ship_id,
        pulse_laser, auto_turret, plasma_lance, gauss_rifle, photon_torpedo, rocket_launcher,
        ship_hull, kinetic_armor, energy_shield, missile_jammer,
        hull_current, armor_current, shield_current, defense_last_regen,
        in_battle, current_battle_id, build_queue, build_start_sec,
        teleport_charges, teleport_last_regen, score
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,
        $19,$20,$21,$22,
        $23,$24,$25,$26,
        $27,$28,$29
      )
      ON CONFLICT (id) DO UPDATE SET
        username         = EXCLUDED.username,
        password_hash    = EXCLUDED.password_hash,
        iron             = EXCLUDED.iron,
        xp               = EXCLUDED.xp,
        last_updated     = EXCLUDED.last_updated,
        tech_tree        = EXCLUDED.tech_tree,
        ship_id          = EXCLUDED.ship_id,
        pulse_laser      = EXCLUDED.pulse_laser,
        auto_turret      = EXCLUDED.auto_turret,
        plasma_lance     = EXCLUDED.plasma_lance,
        gauss_rifle      = EXCLUDED.gauss_rifle,
        photon_torpedo   = EXCLUDED.photon_torpedo,
        rocket_launcher  = EXCLUDED.rocket_launcher,
        ship_hull        = EXCLUDED.ship_hull,
        kinetic_armor    = EXCLUDED.kinetic_armor,
        energy_shield    = EXCLUDED.energy_shield,
        missile_jammer   = EXCLUDED.missile_jammer,
        hull_current     = EXCLUDED.hull_current,
        armor_current    = EXCLUDED.armor_current,
        shield_current   = EXCLUDED.shield_current,
        defense_last_regen = EXCLUDED.defense_last_regen,
        in_battle        = EXCLUDED.in_battle,
        current_battle_id = EXCLUDED.current_battle_id,
        build_queue      = EXCLUDED.build_queue,
        build_start_sec  = EXCLUDED.build_start_sec,
        teleport_charges = EXCLUDED.teleport_charges,
        teleport_last_regen = EXCLUDED.teleport_last_regen,
        score            = EXCLUDED.score`,
    [
      npcId, username, NPC_PASSWORD_HASH,
      0, // iron
      0, // xp
      now,
      JSON.stringify(techTree),
      null, // ship_id — will be set via space object injection below
      techCounts.pulse_laser, techCounts.auto_turret, techCounts.plasma_lance,
      techCounts.gauss_rifle, techCounts.photon_torpedo, techCounts.rocket_launcher,
      techCounts.ship_hull, techCounts.kinetic_armor, techCounts.energy_shield, techCounts.missile_jammer,
      maxDef.hull, maxDef.armor, maxDef.shield,
      now, // defense_last_regen
      0,    // in_battle = false
      null, // current_battle_id
      JSON.stringify([]), // build_queue
      null, // build_start_sec
      0,    // teleport_charges
      0,    // teleport_last_regen
      0,    // score
    ],
  );

  // 4. Invalidate bonus cache (forces fresh computation on next access)
  UserBonusCache.getInstance().invalidateBonuses(npcId);

  // 5. Load NPC user into UserCache (forces DB→cache load)
  //    getUserByIdWithLock will load from DB, call setUserUnsafe, compute bonuses.
  await UserCache.getInstance2().getUserByIdWithLock(context, npcId);

  // 6. Inject a temporary space object into WorldCache so the battle system
  //    can resolve the NPC's ship position and stop the ship.
  await injectNpcSpaceObject(npc, context);

  // 7. Mark the NPC as having a user row
  npc.npcUserCreated = true;
}

// ---------------------------------------------------------------------------
// Space-object management for NPC battles
// ---------------------------------------------------------------------------

/**
 * Create (or update) an in-memory space object for the NPC in WorldCache.
 * This lets `getShipPosition` and `setShipSpeed` work normally.
 *
 * The NPC's orbit position is used as the ship location. We also update
 * the NPC user's `ship_id` in the cache so `initiateBattle` finds it.
 */
async function injectNpcSpaceObject(
  npc: NpcShip,
  context: LockContext<LocksAtMostAndHas4>,
): Promise<void> {
  const npcId = npc.id;
  const pos = NPCManager.positionForAngle(npc.orbitAngleDeg);

  const npcSpaceObject: SpaceObject = {
    id: npcId,
    type: 'player_ship', // use 'player_ship' so the battle system treats it normally
    x: pos.x,
    y: pos.y,
    speed: 0,
    angle: npc.orbitAngleDeg - 90,
    last_position_update_ms: Date.now(),
    picture_id: npc.npcIndex + 1,
  };

  // Inject into WorldCache in-memory world
  const worldCache = WorldCache.getInstance();
  await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    // Remove existing NPC object if present (idempotent)
    world.spaceObjects = world.spaceObjects.filter(obj => obj.id !== npcId);
    world.spaceObjects.push(npcSpaceObject);
    await worldCache.updateWorldUnsafe(worldContext, world);
  });

  // Update the NPC user's ship_id in cache
  const userCache = UserCache.getInstance2();
  const user = userCache.getUserByIdFromCache(context, npcId);
  if (user) {
    user.ship_id = npcId;
    await userCache.updateUserInCache(context, user);
  }
}

/**
 * Remove the NPC's temporary space object from WorldCache.
 * Called after battle resolution to clean up.
 */
export async function removeNpcSpaceObject(
  npcId: number,
  context: LockContext<LocksAtMostAndHas4>,
): Promise<void> {
  const worldCache = WorldCache.getInstance();
  await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    world.spaceObjects = world.spaceObjects.filter(obj => obj.id !== npcId);
    await worldCache.updateWorldUnsafe(worldContext, world);
  });
}

// ---------------------------------------------------------------------------
// Iron reward
// ---------------------------------------------------------------------------

/**
 * Calculate the iron reward for defeating an NPC of a given level.
 * Formula: `5000 × 5^(level − 1)`.
 *
 * L1=5 000, L2=25 000, L3=125 000, L4=625 000.
 */
export function calculateNpcIronReward(npcLevel: number): number {
  return 5000 * Math.pow(5, npcLevel - 1);
}
