import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { GET as questsGET, POST as questsPOST } from '@/app/api/quests/route';
import { POST as adminQuestsPOST } from '@/app/api/admin/quests/route';
import { GET as inventoryGET, DELETE as inventoryDELETE } from '@/app/api/inventory/route';
import { GET as worldGET } from '@/app/api/world/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { createRequest, extractSessionCookie } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { getDatabase } from '@/lib/server/database';
import { QuestService } from '@/lib/server/quests/QuestService';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { HOSTILE_ARCHETYPES, hostileOrbit, positionOnOrbit } from '@/shared/quests/npcArchetypes';
import { LOCATION_DISCOVERY_XP } from '@/shared/quests/locations';
import type { InventoryItemData } from '@/shared/inventoryShared';
import type {
  QuestActionResult,
  QuestEvent,
  QuestNotification,
  QuestOverview,
} from '@/shared/quests/questTypes';

const BASE = 'http://localhost:3000/api';

/** The seeded developer user: the only one who may use the mission test tools (jump, fulfil, …). */
async function loginAsDeveloper(): Promise<{ cookie: string; userId: number }> {
  const response = await loginPOST(createRequest(`${BASE}/login`, 'POST', { username: 'a', password: 'a' }));
  const cookie = extractSessionCookie(response);
  if (!cookie) throw new Error('Login of user "a" failed');
  const db = await getDatabase();
  const { rows } = await db.query<{ id: number }>(`SELECT id FROM users WHERE username = 'a'`);
  return { cookie, userId: rows[0].id };
}

async function overviewOf(cookie: string): Promise<QuestOverview> {
  const response = await questsGET(createRequest(`${BASE}/quests`, 'GET', undefined, cookie));
  expect(response.status).toBe(200);
  return (await response.json()) as QuestOverview;
}

async function questAction(cookie: string, body: Record<string, unknown>): Promise<{ status: number; data: QuestActionResult & { code?: string } }> {
  const response = await questsPOST(createRequest(`${BASE}/quests`, 'POST', body, cookie));
  return { status: response.status, data: await response.json() };
}

async function adminAction(cookie: string, body: Record<string, unknown>): Promise<QuestActionResult> {
  const response = await adminQuestsPOST(createRequest(`${BASE}/admin/quests`, 'POST', body, cookie));
  expect(response.status, JSON.stringify(body)).toBe(200);
  return (await response.json()) as QuestActionResult;
}

async function cargoInInventory(cookie: string): Promise<Record<string, number>> {
  const response = await inventoryGET(createRequest(`${BASE}/inventory`, 'GET', undefined, cookie));
  const { grid } = (await response.json()) as { grid: (InventoryItemData | null)[][] };
  const cargo: Record<string, number> = {};
  for (const item of grid.flat()) {
    if (item?.itemType === 'cargo') cargo[item.cargoId] = item.quantity;
  }
  return cargo;
}

async function xpAndIron(userId: number): Promise<{ xp: number; iron: number }> {
  const user = await UserCache.getInstance2().getUserById(createLockContext(), userId);
  if (!user) throw new Error(`User ${userId} not found`);
  return { xp: user.xp, iron: user.iron };
}

/** Iron rewards are capped by the iron storage: tests of a reward start below the cap. */
async function setIron(userId: number, iron: number): Promise<void> {
  await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
    const userCache = UserCache.getInstance2();
    const user = await userCache.getUserByIdWithLock(userContext, userId);
    user!.iron = iron;
    await userCache.updateUserInCache(userContext, user!);
  });
}

/** What the game reports to the mission system (harvest route, battle end). */
async function gameEvent(userId: number, event: QuestEvent): Promise<QuestActionResult> {
  return QuestService.getInstance().recordEvent(createLockContext(), userId, event);
}

/** Puts the ship of the user at the position (the test tool "jump" only knows contacts and locations). */
async function placeShip(userId: number, position: { x: number; y: number }): Promise<void> {
  await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
    const user = await UserCache.getInstance2().getUserByIdWithLock(userContext, userId);
    await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      const worldCache = WorldCache.getInstance();
      const world = worldCache.getWorldFromCache(worldContext);
      const ship = world.getSpaceObject(worldContext, user!.ship_id!);
      ship!.x = position.x;
      ship!.y = position.y;
      ship!.speed = 0;
      ship!.last_position_update_ms = Date.now();
      await worldCache.updateWorldUnsafe(worldContext, world);
    });
  });
}

const kinds = (notifications: readonly QuestNotification[]): string[] => notifications.map((n) => n.kind);

describe('Missions (API with database)', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await shutdownIntegrationTestServer();
  });

  it('quests_newPlayer_seesTheFirstMissionAsAvailableAndTheRestLocked', async () => {
    await withTransaction(async () => {
      const { cookie } = await loginAsDeveloper();

      const overview = await overviewOf(cookie);

      expect(overview.state.quests).toEqual({});
      expect(overview.cargo.counts).toEqual({});
      expect(overview.level).toBeGreaterThanOrEqual(1);
    });
  });

  it('quests_acceptFarFromTheContact_isRejectedAndNothingIsStored', async () => {
    await withTransaction(async () => {
      const { cookie } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'jump', locationId: 'azure_drift' });

      const { status, data } = await questAction(cookie, { action: 'accept', questId: 'c1_first_haul' });

      expect(status).toBe(400);
      expect(data.code).toBe('contactOutOfRange');
      expect((await overviewOf(cookie)).state.quests).toEqual({});
    });
  });

  it('quests_acceptCollectAndReport_completesTheMissionAndPaysTheReward', async () => {
    await withTransaction(async () => {
      const { cookie, userId } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'jump', contactId: 'vess' });
      expect((await overviewOf(cookie)).contactsInRange).toContain('vess');

      // Accept at the contact
      const accepted = await questAction(cookie, { action: 'accept', questId: 'c1_first_haul' });
      expect(accepted.status).toBe(200);
      expect(kinds(accepted.data.notifications)).toEqual(['questAccepted']);

      // Reporting too early is against the rules
      const tooEarly = await questAction(cookie, { action: 'report', questId: 'c1_first_haul', contactId: 'vess' });
      expect(tooEarly.status).toBe(400);
      expect(tooEarly.data.code).toBe('objectivesIncomplete');

      // Three asteroids; the third one fulfils the objective
      await gameEvent(userId, { type: 'object_collected', objectType: 'asteroid' });
      await gameEvent(userId, { type: 'object_collected', objectType: 'asteroid' });
      const third = await gameEvent(userId, { type: 'object_collected', objectType: 'asteroid' });
      expect(kinds(third.notifications)).toContain('readyToReport');
      expect((await overviewOf(cookie)).state.quests.c1_first_haul).toMatchObject({ status: 'active', progress: [3] });

      // Report: reward is paid, follow-up missions become available
      await setIron(userId, 1000);
      const before = await xpAndIron(userId);
      const reported = await questAction(cookie, { action: 'report', questId: 'c1_first_haul', contactId: 'vess' });
      const after = await xpAndIron(userId);

      expect(reported.status).toBe(200);
      expect(reported.data.notifications).toContainEqual({
        kind: 'questCompleted', questId: 'c1_first_haul', xp: 150, iron: 500, commander: false,
      });
      expect(after.xp).toBeGreaterThanOrEqual(before.xp + 150);
      expect(after.iron).toBe(before.iron + 500);
      const overview = await overviewOf(cookie);
      expect(overview.state.quests.c1_first_haul).toMatchObject({ status: 'completed', completions: 1 });
      expect(overview.state.counters.asteroidsCollected).toBe(3);
    });
  });

  it('quests_missionCargo_isStoredInTheInventoryAndHandedOverOnReport', async () => {
    await withTransaction(async () => {
      const { cookie, userId } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'accept', questId: 'c1_salvage_rights' });

      const first = await gameEvent(userId, { type: 'object_collected', objectType: 'shipwreck' });
      expect(first.notifications).toContainEqual({ kind: 'cargoFound', cargoId: 'hull_plating', current: 1, required: 2 });
      await gameEvent(userId, { type: 'object_collected', objectType: 'shipwreck' });
      // A third wreck brings nothing: the mission needs only two platings
      await gameEvent(userId, { type: 'object_collected', objectType: 'shipwreck' });
      expect(await cargoInInventory(cookie)).toEqual({ hull_plating: 2 });

      await adminAction(cookie, { action: 'jump', contactId: 'vess' });
      const reported = await questAction(cookie, { action: 'report', questId: 'c1_salvage_rights', contactId: 'vess' });

      expect(reported.status).toBe(200);
      expect(kinds(reported.data.notifications)).toContain('questCompleted');
      expect(await cargoInInventory(cookie)).toEqual({});
    });
  });

  it('quests_missionCargo_cannotBeDiscardedFromTheInventory', async () => {
    await withTransaction(async () => {
      const { cookie } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'accept', questId: 'c1_dispatch_to_meridian' });
      expect(await cargoInInventory(cookie)).toEqual({ sealed_dispatch: 1 });

      const inventory = await inventoryGET(createRequest(`${BASE}/inventory`, 'GET', undefined, cookie));
      const { grid } = (await inventory.json()) as { grid: (InventoryItemData | null)[][] };
      const row = grid.findIndex((slots) => slots.some((item) => item?.itemType === 'cargo'));
      const col = grid[row].findIndex((item) => item?.itemType === 'cargo');
      const response = await inventoryDELETE(createRequest(`${BASE}/inventory`, 'DELETE', { row, col }, cookie));

      expect(response.status).toBe(400);
      expect(await cargoInInventory(cookie)).toEqual({ sealed_dispatch: 1 });
    });
  });

  it('quests_abandonMissionWithGrantedCargo_removesTheCargoAndMakesTheMissionAvailableAgain', async () => {
    await withTransaction(async () => {
      const { cookie } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'accept', questId: 'c1_dispatch_to_meridian' });

      const abandoned = await questAction(cookie, { action: 'abandon', questId: 'c1_dispatch_to_meridian' });

      expect(abandoned.status).toBe(200);
      expect(kinds(abandoned.data.notifications)).toEqual(['questAbandoned']);
      expect(await cargoInInventory(cookie)).toEqual({});
      const overview = await overviewOf(cookie);
      expect(overview.state.quests.c1_dispatch_to_meridian?.status).not.toBe('active');
      // The prerequisites the test tool completed stay completed
      expect(overview.state.quests.c1_salvage_rights).toMatchObject({ status: 'completed' });
    });
  });

  it('quests_multiStageMission_advancesStageByStageUntilTheReward', async () => {
    await withTransaction(async () => {
      const { cookie, userId } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'accept', questId: 'c2_voices_of_the_dead' });

      // Stage 1 has no contact: visiting the graveyard advances the mission by itself
      const visited = await gameEvent(userId, { type: 'location_visited', locationId: 'anvil_graveyard' });
      expect(visited.notifications).toContainEqual({ kind: 'stageAdvanced', questId: 'c2_voices_of_the_dead', stage: 1 });

      // Stage 2: three flight recorders from wrecks, reported to Quill
      for (let i = 0; i < 3; i++) await gameEvent(userId, { type: 'object_collected', objectType: 'shipwreck' });
      expect(await cargoInInventory(cookie)).toEqual({ flight_recorder: 3 });
      await adminAction(cookie, { action: 'jump', contactId: 'quill' });
      const wrongContact = await questAction(cookie, { action: 'report', questId: 'c2_voices_of_the_dead', contactId: 'vess' });
      const reported = await questAction(cookie, { action: 'report', questId: 'c2_voices_of_the_dead', contactId: 'quill' });

      expect(wrongContact.status).toBe(400);
      expect(reported.status).toBe(200);
      expect(kinds(reported.data.notifications)).toContain('questCompleted');
      expect(await cargoInInventory(cookie)).toEqual({});
    });
  });

  it('quests_progressAfterServerRestart_isReadFromTheDatabase', async () => {
    await withTransaction(async () => {
      const { cookie, userId } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'accept', questId: 'c1_first_haul' });
      await gameEvent(userId, { type: 'object_collected', objectType: 'asteroid' });

      // A new service instance knows nothing from memory
      QuestService.resetInstance();

      expect((await overviewOf(cookie)).state.quests.c1_first_haul).toMatchObject({ status: 'active', progress: [1] });
    });
  });

  it('adminQuests_reset_deletesProgressAchievementsAndMissionCargo', async () => {
    await withTransaction(async () => {
      const { cookie, userId } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'accept', questId: 'c1_dispatch_to_meridian' });
      await gameEvent(userId, { type: 'object_collected', objectType: 'asteroid' });

      await adminAction(cookie, { action: 'reset' });

      const overview = await overviewOf(cookie);
      expect(overview.state.quests).toEqual({});
      expect(overview.state.counters).toEqual({});
      expect(await cargoInInventory(cookie)).toEqual({});
      const db = await getDatabase();
      expect((await db.query('SELECT 1 FROM quest_progress WHERE user_id = $1', [userId])).rowCount).toBe(0);
    });
  });

  it('adminQuests_reportOfTheLastStage_completesTheMissionFromAnyDistance', async () => {
    await withTransaction(async () => {
      const { cookie } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'jump', locationId: 'azure_drift' });
      await adminAction(cookie, { action: 'accept', questId: 'c4_head_of_the_serpent' });

      const result = await adminAction(cookie, { action: 'report', questId: 'c4_head_of_the_serpent' });

      expect(result.notifications).toContainEqual(
        expect.objectContaining({ kind: 'questCompleted', questId: 'c4_head_of_the_serpent', commander: true })
      );
      expect((await overviewOf(cookie)).state.quests.c4_head_of_the_serpent).toMatchObject({ status: 'completed' });
    });
  });

  it('world_shipEntersAnUnknownLocation_discoversItOnceAndGrantsXp', async () => {
    await withTransaction(async () => {
      const { cookie, userId } = await loginAsDeveloper();
      await adminAction(cookie, { action: 'jump', locationId: 'azure_drift' });
      const before = await xpAndIron(userId);

      await worldGET(createRequest(`${BASE}/world`, 'GET', undefined, cookie));
      const afterFirst = await xpAndIron(userId);
      await worldGET(createRequest(`${BASE}/world`, 'GET', undefined, cookie));
      const afterSecond = await xpAndIron(userId);

      expect((await overviewOf(cookie)).state.discovered).toEqual(['azure_drift']);
      expect(afterFirst.xp).toBe(before.xp + LOCATION_DISCOVERY_XP);
      expect(afterSecond.xp).toBe(afterFirst.xp);
    });
  });

  it('world_shipComesCloseToAnAggressiveShip_isAttackedOnce', async () => {
    await withTransaction(async () => {
      const { cookie, userId } = await loginAsDeveloper();
      const marauder = HOSTILE_ARCHETYPES.marauder;
      await placeShip(userId, positionOnOrbit(hostileOrbit(marauder), marauder.spawns[0].startAngleDeg));

      const first = await (await worldGET(createRequest(`${BASE}/world`, 'GET', undefined, cookie))).json();
      const second = await (await worldGET(createRequest(`${BASE}/world`, 'GET', undefined, cookie))).json();

      expect(first.ambush?.enemyName).toContain(marauder.displayName);
      expect(second.ambush).toBeUndefined();
      const user = await UserCache.getInstance2().getUserById(createLockContext(), userId);
      expect(user?.inBattle).toBe(true);
      const attackers = NPCManager.getInstance()
        .getNpcsForPlayer(userId, user!.getLevel())
        .filter((npc) => npc.archetype === 'marauder');
      // The attacking ship is in battle and no longer part of the visible ships
      expect(attackers).toHaveLength(marauder.spawns.length - 1);
    });
  });
});
