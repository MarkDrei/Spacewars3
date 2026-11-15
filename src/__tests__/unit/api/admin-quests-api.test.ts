import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/admin/quests/route';
import { createMockSessionCookie, createRequest } from '../../helpers/apiTestHelpers';
import { QuestService } from '@/lib/server/quests/QuestService';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { World, type SpaceObject } from '@/lib/server/world/world';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { WORLD_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import type { DatabaseConnection } from '@/lib/server/database';
import { DEFAULT_WORLD_HEIGHT, DEFAULT_WORLD_WIDTH } from '@shared/worldConstants';
import { getLocation } from '@/shared/quests/locations';
import { getContact, HAIL_RANGE } from '@/shared/quests/npcArchetypes';
import { QuestRuleError, type QuestActionResult } from '@/shared/quests/questTypes';

const URL = 'http://localhost:3000/api/admin/quests';
const USER_ID = 42;
const SHIP_ID = 9;

const RESULT: QuestActionResult = { notifications: [], revision: 5 };

const service = {
  resetProgress: vi.fn(),
  forceAccept: vi.fn(),
  fulfilStage: vi.fn(),
  forceReport: vi.fn(),
};

interface FakeUser {
  username: string;
  inBattle: boolean;
  ship_id: number;
}

let user: FakeUser | null;

const createMockDb = () =>
  ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
  }) as unknown as DatabaseConnection;

function initializeWorld(spaceObjects: SpaceObject[]): void {
  const db = createMockDb();
  const world = new World({ width: DEFAULT_WORLD_WIDTH, height: DEFAULT_WORLD_HEIGHT }, spaceObjects, async () => {}, db);
  WorldCache.resetInstance();
  WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
}

async function shipInWorld(): Promise<SpaceObject | undefined> {
  return createLockContext().useLockWithAcquire(WORLD_LOCK, async (worldContext) =>
    WorldCache.getInstance().getWorldFromCache(worldContext).getSpaceObject(worldContext, SHIP_ID)
  );
}

const playerShip = (): SpaceObject => ({
  id: SHIP_ID, type: 'player_ship', x: 100, y: 100, speed: 20, angle: 0, last_position_update_ms: Date.now(), picture_id: 1,
});

async function post(body: unknown, authenticated = true): Promise<Response> {
  const cookie = authenticated ? await createMockSessionCookie(USER_ID) : undefined;
  return POST(createRequest(URL, 'POST', body, cookie));
}

beforeEach(() => {
  user = { username: 'a', inBattle: false, ship_id: SHIP_ID };
  vi.spyOn(QuestService, 'getInstance').mockReturnValue(service as unknown as QuestService);
  vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
    getUserById: vi.fn(async () => user),
    getUserByIdWithLock: vi.fn(async () => user),
  } as unknown as UserCache);
  NPCManager.resetInstance();
});

afterEach(async () => {
  try {
    await WorldCache.getInstance().shutdown();
  } catch {
    // no world was initialised in this test
  }
  WorldCache.resetInstance();
  NPCManager.resetInstance();
  vi.restoreAllMocks();
  for (const method of Object.values(service)) method.mockReset();
});

describe('POST /api/admin/quests', () => {
  it('adminQuests_notAuthenticated_returns401', async () => {
    const response = await post({ action: 'reset' }, false);

    expect(response.status).toBe(401);
    expect(service.resetProgress).not.toHaveBeenCalled();
  });

  it('adminQuests_userIsNoDeveloper_returns403', async () => {
    user = { username: 'pilot', inBattle: false, ship_id: SHIP_ID };

    const response = await post({ action: 'reset' });

    expect(response.status).toBe(403);
    expect(service.resetProgress).not.toHaveBeenCalled();
  });

  it('adminQuests_userUnknown_returns404', async () => {
    user = null;

    expect((await post({ action: 'reset' })).status).toBe(404);
  });

  it('adminQuests_unknownAction_returns400', async () => {
    const response = await post({ action: 'win' });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid action');
  });

  it('adminQuests_reset_deletesTheProgressOfTheCaller', async () => {
    const response = await post({ action: 'reset' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(service.resetProgress).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });

  it.each([
    ['accept', 'forceAccept'],
    ['fulfil', 'fulfilStage'],
    ['report', 'forceReport'],
  ] as const)('adminQuests_%s_callsTheServiceAndReturnsItsResult', async (action, method) => {
    service[method].mockResolvedValue(RESULT);

    const response = await post({ action, questId: 'c4_war_council' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(RESULT);
    expect(service[method]).toHaveBeenCalledWith(expect.anything(), USER_ID, 'c4_war_council');
  });

  it.each(['accept', 'fulfil', 'report'])('adminQuests_%sWithoutQuestId_returns400', async (action) => {
    const response = await post({ action });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Missing or invalid quest ID');
  });

  it('adminQuests_ruleViolation_returns400WithCode', async () => {
    service.fulfilStage.mockRejectedValue(new QuestRuleError('notActive'));

    const response = await post({ action: 'fulfil', questId: 'c1_first_haul' });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('notActive');
  });

  it('adminQuests_respawnNpcs_bringsDefeatedShipsBack', async () => {
    const npcManager = NPCManager.getInstance();
    const [pirate] = npcManager.getNpcsForPlayer(USER_ID, 1);
    npcManager.markDefeated(pirate.id);
    expect(npcManager.getNpcsForPlayer(USER_ID, 1).some((npc) => npc.id === pirate.id)).toBe(false);

    const response = await post({ action: 'respawnNpcs' });

    expect(response.status).toBe(200);
    expect(npcManager.getNpcsForPlayer(USER_ID, 1).some((npc) => npc.id === pirate.id)).toBe(true);
  });

  it('adminQuests_respawnNpcsWhileAShipIsInBattle_returns400', async () => {
    const npcManager = NPCManager.getInstance();
    const [pirate] = npcManager.getNpcsForPlayer(USER_ID, 1);
    npcManager.setInBattle(pirate.id, true);

    const response = await post({ action: 'respawnNpcs' });

    expect(response.status).toBe(400);
    expect(npcManager.getNpcById(pirate.id)?.inBattle).toBe(true);
  });

  it('adminQuests_jumpWithoutTarget_returns400', async () => {
    const response = await post({ action: 'jump', locationId: 'nowhere' });

    expect(response.status).toBe(400);
  });

  it('adminQuests_jumpToLocation_putsTheShipIntoItsCentreAndStopsIt', async () => {
    initializeWorld([playerShip()]);
    const location = getLocation('azure_drift');

    const response = await post({ action: 'jump', locationId: 'azure_drift' });

    expect(response.status).toBe(200);
    expect(await shipInWorld()).toMatchObject({ x: location.x, y: location.y, speed: 0 });
  });

  it('adminQuests_jumpToContact_putsTheShipIntoHailRange', async () => {
    initializeWorld([playerShip()]);
    const contact = getContact('quill');
    const home = getLocation(contact.home);

    const response = await post({ action: 'jump', contactId: 'quill' });
    const ship = await shipInWorld();

    expect(response.status).toBe(200);
    // The contact circles its home: the ship ends on that orbit, where the contact is right now
    expect(Math.hypot(ship!.x - home.x, ship!.y - home.y)).toBeCloseTo(contact.orbitRadius, 3);
    expect(contact.orbitRadius).toBeLessThan(HAIL_RANGE);
  });

  it('adminQuests_jumpWhileInBattle_returns400AndKeepsThePosition', async () => {
    initializeWorld([playerShip()]);
    user = { username: 'a', inBattle: true, ship_id: SHIP_ID };

    const response = await post({ action: 'jump', locationId: 'azure_drift' });

    expect(response.status).toBe(400);
    expect(await shipInWorld()).toMatchObject({ speed: 20 });
  });

  it('adminQuests_jumpWithoutShipInTheWorld_returns404', async () => {
    initializeWorld([]);

    expect((await post({ action: 'jump', locationId: 'azure_drift' })).status).toBe(404);
  });
});
