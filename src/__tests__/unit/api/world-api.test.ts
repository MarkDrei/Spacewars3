import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { GET as worldGET } from '@/app/api/world/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { WorldCache } from '@/lib/server/world/worldCache';
import { UserCache } from '@/lib/server/user/userCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { World } from '@/lib/server/world/world';
import type { DatabaseConnection } from '@/lib/server/database';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';
import { STARBASE_ID_OFFSET } from '@/shared/starbases';
import { QuestService } from '@/lib/server/quests/QuestService';
import { ambushPlayer } from '@/lib/server/npc/npcAmbush';
import { createInitialQuestState } from '@/shared/quests/questEngine';
import { CONTACTS, HOSTILE_ARCHETYPES, hostileOrbit, positionOnOrbit } from '@/shared/quests/npcArchetypes';
import { getLocation } from '@/shared/quests/locations';
import type { PlayerQuestState } from '@/shared/quests/questTypes';
import type { SpaceObject as ServerSpaceObject } from '@/lib/server/world/world';
import type { SpaceObject } from '@shared/types/gameTypes';

// The battle an ambush starts needs caches and the database; here only the call matters
vi.mock('@/lib/server/npc/npcAmbush', () => ({ ambushPlayer: vi.fn() }));

const USER_ID = 42;
const SHIP_ID = 9;

const createMockDb = () =>
  ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
  }) as unknown as DatabaseConnection;

/** The player as the world route sees them. */
let mockUser: { getLevel: () => number; ship_id: number; inBattle: boolean };

/** Mission state the mocked QuestService hands out. */
let questState: PlayerQuestState;
const recordVisits = vi.fn();

function initializeWorld(spaceObjects: ServerSpaceObject[]): void {
  const db = createMockDb();
  const world = new World({ width: DEFAULT_WORLD_WIDTH, height: DEFAULT_WORLD_HEIGHT }, spaceObjects, async () => {}, db);
  WorldCache.resetInstance();
  WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
}

/** Puts the player on a mission whose current step targets a ship kind (cargo dropped by marauders). */
function huntMarauders(): void {
  questState.quests.c3_colours_of_the_horde = {
    status: 'active', stage: 0, progress: [0], acceptedAt: 0, completedAt: null, completions: 0,
  };
}

const playerShipAt = (x: number, y: number): ServerSpaceObject => ({
  id: SHIP_ID, type: 'player_ship', x, y, speed: 0, angle: 0, last_position_update_ms: Date.now(), picture_id: 1,
});

async function getWorld(): Promise<{ status: number; data: { spaceObjects: SpaceObject[]; questRevision?: number; ambush?: unknown } }> {
  const request = createRequest('http://localhost:3000/api/world', 'GET', undefined, await createMockSessionCookie(USER_ID));
  const response = await worldGET(request);
  return { status: response.status, data: await response.json() };
}

const npcShips = (objects: SpaceObject[]): SpaceObject[] => objects.filter((object) => object.type === 'npc_ship');

describe('World API', () => {
  test('world_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/world', 'GET');

    const response = await worldGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  describe('authenticated requests', () => {
    beforeEach(() => {
      initializeWorld([]);
      NPCManager.resetInstance();
      mockUser = { getLevel: () => 1, ship_id: SHIP_ID, inBattle: false };
      questState = createInitialQuestState();
      recordVisits.mockReset();
      vi.mocked(ambushPlayer).mockReset();

      // Mock UserCache so the world route can resolve the player's level
      vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
        getUserById: vi.fn(async () => mockUser),
      } as unknown as UserCache);
      // Mock QuestService: the real one reads the mission state from the database
      vi.spyOn(QuestService, 'getInstance').mockReturnValue({
        getState: vi.fn(async () => questState),
        recordVisits,
      } as unknown as QuestService);
    });

    afterEach(async () => {
      try {
        await WorldCache.getInstance().shutdown();
      } catch {
        // ignore if already torn down
      }
      WorldCache.resetInstance();
      NPCManager.resetInstance();
      vi.restoreAllMocks();
    });

    test('world_authenticated_returnsStarbasesInSpaceObjects', async () => {
      const sessionCookie = await createMockSessionCookie();
      const request = createRequest('http://localhost:3000/api/world', 'GET', undefined, sessionCookie);

      const response = await worldGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.spaceObjects).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'starbase', id: STARBASE_ID_OFFSET + 1 })]),
      );
    });

    test('world_authenticated_containsEveryContactAsFriendlyOrbitingShip', async () => {
      const { data } = await getWorld();

      const friendly = npcShips(data.spaceObjects).filter((object) => object.npcDisposition === 'friendly');
      expect(friendly.map((object) => object.contactId)).toEqual(CONTACTS.map((contact) => contact.id));
      for (const contact of CONTACTS) {
        const home = getLocation(contact.home);
        const object = friendly.find((candidate) => candidate.contactId === contact.id)!;
        expect(object).toMatchObject({
          id: contact.objectId,
          username: contact.shipName,
          orbitCenterX: home.x,
          orbitCenterY: home.y,
          orbitRadius: contact.orbitRadius,
          angularVelocityDegPerSec: contact.angularVelocityDegPerSec,
        });
        expect(Math.hypot(object.x - home.x, object.y - home.y)).toBeCloseTo(contact.orbitRadius, 3);
        // Friendly ships cannot be attacked: they carry no user id
        expect(object.userId).toBeUndefined();
      }
    });

    const dispositionOf = (objects: SpaceObject[], archetype: string): string[] => [
      ...new Set(
        npcShips(objects)
          .filter((object) => object.npcArchetype === archetype)
          .map((object) => object.npcDisposition as string)
      ),
    ];

    test('world_playerWithoutMission_showsNoShipAsAggressive', async () => {
      const { data } = await getWorld();

      expect(dispositionOf(data.spaceObjects, 'pirate')).toEqual(['hostile']);
      expect(dispositionOf(data.spaceObjects, 'marauder')).toEqual(['hostile']);
      expect(dispositionOf(data.spaceObjects, 'drone')).toEqual(['hostile']);
    });

    test('world_missionHuntsMarauders_showsOnlyMaraudersAsAggressive', async () => {
      huntMarauders();

      const { data } = await getWorld();

      expect(dispositionOf(data.spaceObjects, 'pirate')).toEqual(['hostile']);
      expect(dispositionOf(data.spaceObjects, 'marauder')).toEqual(['aggressive']);
      expect(dispositionOf(data.spaceObjects, 'drone')).toEqual(['hostile']);
    });

    test('world_hostileShip_carriesNameLevelAndUserIdForTheAttack', async () => {
      const { data } = await getWorld();

      const pirate = npcShips(data.spaceObjects).find((object) => object.npcArchetype === 'pirate')!;
      expect(pirate.userId).toBe(pirate.id);
      expect(pirate.level).toBeGreaterThanOrEqual(1);
      expect(pirate.username).toContain(HOSTILE_ARCHETYPES.pirate.displayName);
    });

    test('world_noMissionWantsTheWarlord_warlordIsNotInTheWorld', async () => {
      const { data } = await getWorld();

      expect(npcShips(data.spaceObjects).some((object) => object.npcArchetype === 'warlord')).toBe(false);
    });

    test('world_activeMissionWantsTheWarlord_warlordIsInTheWorld', async () => {
      questState = {
        ...createInitialQuestState(),
        quests: {
          c4_head_of_the_serpent: { status: 'active', stage: 0, progress: [0, 0], acceptedAt: 1, completedAt: null, completions: 0 },
        },
      };

      const { data } = await getWorld();

      expect(npcShips(data.spaceObjects).filter((object) => object.npcArchetype === 'warlord')).toHaveLength(1);
    });

    test('world_authenticated_returnsTheRevisionOfTheMissionState', async () => {
      questState = { ...createInitialQuestState(), revision: 17 };

      const { data } = await getWorld();

      expect(data.questRevision).toBe(17);
    });

    test('world_shipInTheWorld_recordsItsPositionForMissions', async () => {
      initializeWorld([playerShipAt(300, 2700)]);

      await getWorld();

      expect(recordVisits).toHaveBeenCalledWith(expect.anything(), USER_ID, { x: 300, y: 2700 });
    });

    test('world_noShipInTheWorld_recordsNoVisitAndStartsNoAmbush', async () => {
      const { status, data } = await getWorld();

      expect(status).toBe(200);
      expect(recordVisits).not.toHaveBeenCalled();
      expect(ambushPlayer).not.toHaveBeenCalled();
      expect(data.ambush).toBeUndefined();
    });

    test('world_shipFarFromAggressiveShips_startsNoAmbush', async () => {
      initializeWorld([playerShipAt(300, 2700)]);

      const { data } = await getWorld();

      expect(ambushPlayer).not.toHaveBeenCalled();
      expect(data.ambush).toBeUndefined();
    });

    test('world_shipNextToAMarauderWithoutMissionAgainstThem_startsNoAmbush', async () => {
      const marauder = HOSTILE_ARCHETYPES.marauder;
      const position = positionOnOrbit(hostileOrbit(marauder), marauder.spawns[0].startAngleDeg);
      initializeWorld([playerShipAt(position.x, position.y)]);

      const { data } = await getWorld();

      expect(ambushPlayer).not.toHaveBeenCalled();
      expect(data.ambush).toBeUndefined();
    });

    test('world_shipNextToAHuntedMarauder_isAmbushedAndTheResponseSaysSo', async () => {
      const marauder = HOSTILE_ARCHETYPES.marauder;
      const position = positionOnOrbit(hostileOrbit(marauder), marauder.spawns[0].startAngleDeg);
      initializeWorld([playerShipAt(position.x, position.y)]);
      huntMarauders();
      vi.mocked(ambushPlayer).mockResolvedValue({ enemyName: 'Iron Horde Marauder' });

      const { data } = await getWorld();

      expect(ambushPlayer).toHaveBeenCalledTimes(1);
      const [userId, attacker] = vi.mocked(ambushPlayer).mock.calls[0];
      expect(userId).toBe(USER_ID);
      expect(attacker.archetype).toBe('marauder');
      expect(data.ambush).toEqual({ enemyName: 'Iron Horde Marauder' });
    });

    test('world_playerAlreadyInBattle_recordsNoVisitAndStartsNoAmbush', async () => {
      const marauder = HOSTILE_ARCHETYPES.marauder;
      const position = positionOnOrbit(hostileOrbit(marauder), marauder.spawns[0].startAngleDeg);
      initializeWorld([playerShipAt(position.x, position.y)]);
      huntMarauders();
      mockUser.inBattle = true;

      await getWorld();

      expect(recordVisits).not.toHaveBeenCalled();
      expect(ambushPlayer).not.toHaveBeenCalled();
    });

    test('world_recordingTheVisitFails_stillDeliversTheWorld', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      initializeWorld([playerShipAt(300, 2700)]);
      recordVisits.mockRejectedValue(new Error('database unavailable'));

      const { status, data } = await getWorld();

      expect(status).toBe(200);
      expect(data.spaceObjects.some((object) => object.type === 'player_ship')).toBe(true);
      expect(data.ambush).toBeUndefined();
    });

    test('world_ambushFails_stillDeliversTheWorld', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const marauder = HOSTILE_ARCHETYPES.marauder;
      const position = positionOnOrbit(hostileOrbit(marauder), marauder.spawns[0].startAngleDeg);
      initializeWorld([playerShipAt(position.x, position.y)]);
      huntMarauders();
      vi.mocked(ambushPlayer).mockRejectedValue(new Error('battle could not be created'));

      const { status, data } = await getWorld();

      expect(status).toBe(200);
      expect(data.ambush).toBeUndefined();
    });
  });
});
