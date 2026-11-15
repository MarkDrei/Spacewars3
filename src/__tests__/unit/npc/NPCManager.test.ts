import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import {
  NPC_IDS_PER_SLOT,
  NPC_IDS_PER_USER,
  NPC_MAX_LEVEL,
  NPC_USER_ID_OFFSET,
  isNpcId,
  npcUserId,
  parseNpcId,
} from '@/lib/server/npc/npcConstants';
import type { NpcShip } from '@/lib/server/npc/npcTypes';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { AMBUSH_GRACE_MS, HOSTILE_ARCHETYPES, type HostileArchetypeId } from '@/shared/quests/npcArchetypes';
import { getLocation } from '@/shared/quests/locations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Freeze Date.now to a deterministic value for predictable tests. */
function freezeTime(ms: number): void {
  vi.spyOn(Date, 'now').mockReturnValue(ms);
}

/** Start of a fixed day (UTC), so the tests do not depend on the wall clock. */
const MIDNIGHT = Date.UTC(2026, 0, 15);
const HOUR = 3_600_000;
const MINUTE = 60_000;

const PIRATE = HOSTILE_ARCHETYPES.pirate;
const MARAUDER = HOSTILE_ARCHETYPES.marauder;
const DRONE = HOSTILE_ARCHETYPES.drone;
const WARLORD = HOSTILE_ARCHETYPES.warlord;

/** Ships that are in the world without a mission asking for them. */
const FREE_SHIP_COUNT = PIRATE.spawns.length + MARAUDER.spawns.length + DRONE.spawns.length;

function ofArchetype(npcs: readonly NpcShip[], archetype: HostileArchetypeId): NpcShip[] {
  return npcs.filter((npc) => npc.archetype === archetype);
}

// ---------------------------------------------------------------------------
// Tests for npcConstants utility functions
// ---------------------------------------------------------------------------

describe('npcConstants helpers', () => {
  describe('npcUserId', () => {
    it('npcUserId_zeroOwnerLevel0_returnsOffset', () => {
      expect(npcUserId(0, 0)).toBe(NPC_USER_ID_OFFSET);
    });

    it('npcUserId_owner1Level0_returnsOffsetPlus1000', () => {
      expect(npcUserId(1, 0)).toBe(NPC_USER_ID_OFFSET + NPC_IDS_PER_USER);
    });

    it('npcUserId_owner1Level3_returnsCorrectValue', () => {
      expect(npcUserId(1, 3)).toBe(NPC_USER_ID_OFFSET + NPC_IDS_PER_USER + 3);
    });

    it('npcUserId_withSlot_addsSlotBlock', () => {
      expect(npcUserId(1, 3, 4)).toBe(NPC_USER_ID_OFFSET + NPC_IDS_PER_USER + 4 * NPC_IDS_PER_SLOT + 3);
    });

    it('npcUserId_largeOwnerHighestSlotAndLevel_staysInRange', () => {
      const id = npcUserId(999_999, NPC_MAX_LEVEL, 9);
      expect(id).toBeLessThan(2_000_000_000);
      expect(id).toBeGreaterThanOrEqual(NPC_USER_ID_OFFSET);
    });
  });

  describe('isNpcId', () => {
    it('isNpcId_belowOffset_returnsFalse', () => {
      expect(isNpcId(NPC_USER_ID_OFFSET - 1)).toBe(false);
    });

    it('isNpcId_atOffset_returnsTrue', () => {
      expect(isNpcId(NPC_USER_ID_OFFSET)).toBe(true);
    });

    it('isNpcId_atStarbaseOffset_returnsFalse', () => {
      expect(isNpcId(2_000_000_000)).toBe(false);
    });

    it('isNpcId_regularPlayerId_returnsFalse', () => {
      expect(isNpcId(42)).toBe(false);
    });

    it('isNpcId_validNpcId_returnsTrue', () => {
      expect(isNpcId(npcUserId(5, 2))).toBe(true);
    });
  });

  describe('parseNpcId', () => {
    it('parseNpcId_slotZero_returnsOwnerSlotAndLevel', () => {
      expect(parseNpcId(npcUserId(7, 2))).toEqual({ ownerId: 7, slot: 0, npcLevel: 2 });
    });

    it('parseNpcId_otherSlot_returnsOwnerSlotAndLevel', () => {
      expect(parseNpcId(npcUserId(7, 12, 6))).toEqual({ ownerId: 7, slot: 6, npcLevel: 12 });
    });

    it('parseNpcId_nonNpcId_returnsNull', () => {
      expect(parseNpcId(42)).toBeNull();
    });

    it('parseNpcId_starbaseId_returnsNull', () => {
      expect(parseNpcId(2_000_000_001)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests for NPCManager
// ---------------------------------------------------------------------------

describe('NPCManager', () => {
  beforeEach(() => {
    NPCManager.resetInstance();
    TimeMultiplierService.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    NPCManager.resetInstance();
    TimeMultiplierService.resetInstance();
  });

  // ---------- singleton ----------

  describe('singleton', () => {
    it('getInstance_multipleCalls_returnsSameInstance', () => {
      const a = NPCManager.getInstance();
      const b = NPCManager.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance_thenGetInstance_returnsNewInstance', () => {
      const a = NPCManager.getInstance();
      NPCManager.resetInstance();
      const b = NPCManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---------- getNpcsForPlayer ----------

  describe('getNpcsForPlayer', () => {
    it('getNpcsForPlayer_firstCall_generatesAllFreeArchetypes', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, 5);

      expect(npcs).toHaveLength(FREE_SHIP_COUNT);
      expect(ofArchetype(npcs, 'pirate')).toHaveLength(4);
      expect(ofArchetype(npcs, 'marauder')).toHaveLength(3);
      expect(ofArchetype(npcs, 'drone')).toHaveLength(2);
    });

    it('getNpcsForPlayer_firstCall_levelsFollowPlayerLevelAndSpawnOffset', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, 5);

      expect(ofArchetype(npcs, 'pirate').map((n) => n.level)).toEqual([5, 6, 7, 8]);
      expect(ofArchetype(npcs, 'marauder').map((n) => n.level)).toEqual([4, 5, 6]);
      expect(ofArchetype(npcs, 'drone').map((n) => n.level)).toEqual([4, 5]);
    });

    it('getNpcsForPlayer_levelOnePlayer_npcLevelIsAtLeastOne', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, 1);

      expect(ofArchetype(npcs, 'marauder').map((n) => n.level)).toEqual([1, 1, 2]);
      expect(ofArchetype(npcs, 'drone').map((n) => n.level)).toEqual([1, 1]);
    });

    it('getNpcsForPlayer_firstCall_npcsHaveOwnerAndUniqueIdsFromSlotAndLevel', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(42, 1);

      for (const npc of npcs) {
        expect(npc.ownerId).toBe(42);
        expect(npc.id).toBe(npcUserId(42, npc.level, npc.spawn.slot));
      }
      expect(new Set(npcs.map((n) => n.id)).size).toBe(npcs.length);
    });

    it('getNpcsForPlayer_levelAtCap_spawnsOfOneSlotCollapse', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, NPC_MAX_LEVEL);

      // The four pirates share slot 0; all would be level 99, so only one ID remains
      expect(ofArchetype(npcs, 'pirate')).toHaveLength(1);
      expect(new Set(npcs.map((n) => n.id)).size).toBe(npcs.length);
      expect(Math.max(...npcs.map((n) => n.level))).toBe(NPC_MAX_LEVEL);
    });

    it('getNpcsForPlayer_firstCall_npcsStartAtSpawnAngles', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, 1);

      expect(ofArchetype(npcs, 'pirate').map((n) => n.orbitAngleDeg)).toEqual(
        PIRATE.spawns.map((spawn) => spawn.startAngleDeg),
      );
      expect(ofArchetype(npcs, 'marauder').map((n) => n.orbitAngleDeg)).toEqual(
        MARAUDER.spawns.map((spawn) => spawn.startAngleDeg),
      );
    });

    it('getNpcsForPlayer_firstCall_npcsAreNotDefeated', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, 1);

      for (const npc of npcs) {
        expect(npc.defeated).toBe(false);
        expect(npc.defeatTime).toBeNull();
        expect(npc.inBattle).toBe(false);
        expect(npc.npcUserCreated).toBe(false);
      }
    });

    it('getNpcsForPlayer_defeatedNpc_excludedFromResult', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 1);

      mgr.markDefeated(npcs[0].id);

      const npcs2 = mgr.getNpcsForPlayer(1, 1);
      expect(npcs2).toHaveLength(FREE_SHIP_COUNT - 1);
      expect(npcs2.find((n) => n.id === npcs[0].id)).toBeUndefined();
    });

    it('getNpcsForPlayer_inBattleNpc_excludedFromResult', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 1);

      mgr.setInBattle(npcs[1].id, true);

      const npcs2 = mgr.getNpcsForPlayer(1, 1);
      expect(npcs2).toHaveLength(FREE_SHIP_COUNT - 1);
      expect(npcs2.find((n) => n.id === npcs[1].id)).toBeUndefined();
    });

    it('getNpcsForPlayer_inBattleClearedNpc_includedInResult', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      mgr.setInBattle(npcUserId(1, 2), true);
      expect(mgr.getNpcsForPlayer(1, 1)).toHaveLength(FREE_SHIP_COUNT - 1);

      mgr.setInBattle(npcUserId(1, 2), false);
      expect(mgr.getNpcsForPlayer(1, 1)).toHaveLength(FREE_SHIP_COUNT);
    });

    it('getNpcsForPlayer_secondCallSameLevel_returnsCachedNpcs', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const first = mgr.getNpcsForPlayer(1, 5);
      const second = mgr.getNpcsForPlayer(1, 5);

      // Same object references (not regenerated)
      expect(first[0]).toBe(second[0]);
    });

    it('getNpcsForPlayer_differentPlayers_independentNpcs', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const player1Npcs = mgr.getNpcsForPlayer(1, 3);
      const player2Npcs = mgr.getNpcsForPlayer(2, 7);

      expect(player1Npcs[0].ownerId).toBe(1);
      expect(player2Npcs[0].ownerId).toBe(2);
      expect(player1Npcs[0].level).toBe(3);
      expect(player2Npcs[0].level).toBe(7);
    });
  });

  // ---------- quest-bound ships ----------

  describe('quest-bound ships', () => {
    it('getNpcsForPlayer_noMissionWantsWarlord_warlordIsHidden', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, 5);

      expect(ofArchetype(npcs, 'warlord')).toHaveLength(0);
    });

    it('getNpcsForPlayer_missionWantsWarlord_warlordIsVisible', () => {
      freezeTime(MIDNIGHT);
      const npcs = NPCManager.getInstance().getNpcsForPlayer(1, 5, ['warlord']);

      const warlords = ofArchetype(npcs, 'warlord');
      expect(warlords).toHaveLength(1);
      expect(warlords[0].level).toBe(5 + WARLORD.spawns[0].levelOffset);
      expect(npcs).toHaveLength(FREE_SHIP_COUNT + 1);
    });

    it('getNpcsForPlayer_missionNoLongerWantsWarlord_warlordIsHiddenAgain', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 5, ['warlord']);

      expect(ofArchetype(mgr.getNpcsForPlayer(1, 5), 'warlord')).toHaveLength(0);
    });

    it('isPresent_freeArchetype_trueWithoutMission', () => {
      freezeTime(MIDNIGHT);
      const pirate = NPCManager.getInstance().getNpcsForPlayer(1, 5)[0];

      expect(NPCManager.isPresent(pirate, [])).toBe(true);
    });
  });

  // ---------- level refresh ----------

  describe('level refresh', () => {
    it('getNpcsForPlayer_levelChanged_regeneratesNpcs', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const old = mgr.getNpcsForPlayer(1, 3);
      expect(old[0].level).toBe(3);

      const fresh = mgr.getNpcsForPlayer(1, 5);
      expect(fresh).toHaveLength(FREE_SHIP_COUNT);
      expect(fresh[0].level).toBe(5);
    });

    it('getNpcsForPlayer_levelChanged_resetsDefeatedStatus', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 3);
      mgr.markDefeated(npcs[0].id);

      const fresh = mgr.getNpcsForPlayer(1, 5);
      expect(fresh).toHaveLength(FREE_SHIP_COUNT);
      for (const npc of fresh) {
        expect(npc.defeated).toBe(false);
      }
    });

    it('getNpcsForPlayer_levelChangedDuringBattle_keepsNpcsUntilBattleEnds', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 3);
      const fighting = npcs[0];
      mgr.setInBattle(fighting.id, true);

      // The battle's NPC must stay addressable by its ID
      mgr.getNpcsForPlayer(1, 4);
      expect(mgr.getNpcById(fighting.id)).toBe(fighting);

      mgr.setInBattle(fighting.id, false);
      const fresh = mgr.getNpcsForPlayer(1, 4);
      expect(fresh[0].level).toBe(4);
    });
  });

  // ---------- respawn ----------

  describe('respawn', () => {
    it('getNpcsForPlayer_pirateDefeatedBeforeMidnight_respawnsAfterMidnight', () => {
      const mgr = NPCManager.getInstance();

      freezeTime(MIDNIGHT - HOUR);
      mgr.getNpcsForPlayer(1, 1);
      mgr.markDefeated(npcUserId(1, 1));

      freezeTime(MIDNIGHT + 12 * HOUR);
      expect(mgr.getNpcsForPlayer(1, 1)).toHaveLength(FREE_SHIP_COUNT);
    });

    it('getNpcsForPlayer_pirateDefeatedAfterMidnight_remainsDefeated', () => {
      const mgr = NPCManager.getInstance();

      freezeTime(MIDNIGHT + HOUR);
      mgr.getNpcsForPlayer(1, 1);
      mgr.markDefeated(npcUserId(1, 1));

      freezeTime(MIDNIGHT + 14 * HOUR);
      expect(mgr.getNpcsForPlayer(1, 1)).toHaveLength(FREE_SHIP_COUNT - 1);
    });

    it('getNpcsForPlayer_marauderDefeated_respawnsAfterItsRespawnTime', () => {
      const mgr = NPCManager.getInstance();

      freezeTime(MIDNIGHT + HOUR);
      const marauder = ofArchetype(mgr.getNpcsForPlayer(1, 5), 'marauder')[0];
      mgr.markDefeated(marauder.id);

      freezeTime(MIDNIGHT + HOUR + MARAUDER.respawnMinutes! * MINUTE - 1);
      expect(ofArchetype(mgr.getNpcsForPlayer(1, 5), 'marauder')).toHaveLength(2);

      freezeTime(MIDNIGHT + HOUR + MARAUDER.respawnMinutes! * MINUTE);
      expect(ofArchetype(mgr.getNpcsForPlayer(1, 5), 'marauder')).toHaveLength(3);
    });

    it('getNpcsForPlayer_respawnedNpc_resetsNpcUserCreated', () => {
      const mgr = NPCManager.getInstance();

      freezeTime(MIDNIGHT - HOUR);
      mgr.getNpcsForPlayer(1, 1);

      // Simulate having a DB user and then defeating
      const npc = mgr.getNpcById(npcUserId(1, 1))!;
      npc.npcUserCreated = true;
      mgr.markDefeated(npc.id);

      freezeTime(MIDNIGHT + HOUR);
      mgr.getNpcsForPlayer(1, 1);

      const respawned = mgr.getNpcById(npcUserId(1, 1))!;
      expect(respawned.npcUserCreated).toBe(false);
      expect(respawned.defeated).toBe(false);
    });

    it('getNpcsForPlayer_respawnedNpc_resetsToStartAngle', () => {
      const mgr = NPCManager.getInstance();

      freezeTime(MIDNIGHT - HOUR);
      mgr.getNpcsForPlayer(1, 1);

      // Move angle away from start
      const npc = mgr.getNpcById(npcUserId(1, 2))!;
      npc.orbitAngleDeg = 123.456;
      mgr.markDefeated(npc.id);

      freezeTime(MIDNIGHT + HOUR);
      mgr.getNpcsForPlayer(1, 1);

      expect(mgr.getNpcById(npcUserId(1, 2))!.orbitAngleDeg).toBe(PIRATE.spawns[1].startAngleDeg);
    });
  });

  // ---------- updateNpcPositions ----------

  describe('updateNpcPositions', () => {
    it('updateNpcPositions_elapsedTime_advancesAngleByArchetypeVelocity', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);

      mgr.updateNpcPositions(1, MIDNIGHT + 10_000);

      const pirate = ofArchetype(npcs, 'pirate')[0];
      expect(pirate.orbitAngleDeg).toBeCloseTo(PIRATE.spawns[0].startAngleDeg + PIRATE.angularVelocityDegPerSec * 10);
      expect(pirate.lastUpdateMs).toBe(MIDNIGHT + 10_000);
    });

    it('updateNpcPositions_negativeVelocity_movesClockwiseAndStaysInRange', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const marauder = ofArchetype(mgr.getNpcsForPlayer(1, 5), 'marauder')[0];

      // 30° start, −1.5°/s for 40 s = −30° → wraps below 0
      mgr.updateNpcPositions(1, MIDNIGHT + 40_000);

      expect(MARAUDER.angularVelocityDegPerSec).toBeLessThan(0);
      expect(marauder.orbitAngleDeg).toBeCloseTo(330);
    });

    it('updateNpcPositions_timeMultiplier_scalesAngleDelta', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const pirate = mgr.getNpcsForPlayer(1, 5)[0];
      TimeMultiplierService.getInstance().setMultiplier(10, 5);

      mgr.updateNpcPositions(1, MIDNIGHT + 1000);

      expect(pirate.orbitAngleDeg).toBeCloseTo(PIRATE.angularVelocityDegPerSec * 10);
    });

    it('updateNpcPositions_defeatedNpc_doesNotAdvance', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npc = mgr.getNpcsForPlayer(1, 5)[0];
      mgr.markDefeated(npc.id);

      mgr.updateNpcPositions(1, MIDNIGHT + 10_000);

      expect(npc.orbitAngleDeg).toBe(PIRATE.spawns[0].startAngleDeg);
    });

    it('updateNpcPositions_inBattleNpc_doesNotAdvance', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npc = mgr.getNpcsForPlayer(1, 5)[0];
      mgr.setInBattle(npc.id, true);

      mgr.updateNpcPositions(1, MIDNIGHT + 10_000);

      expect(npc.orbitAngleDeg).toBe(PIRATE.spawns[0].startAngleDeg);
    });

    it('updateNpcPositions_noPlayerState_doesNotThrow', () => {
      expect(() => NPCManager.getInstance().updateNpcPositions(999, MIDNIGHT)).not.toThrow();
    });

    it('updateNpcPositions_wrapsAt360', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npc = mgr.getNpcsForPlayer(1, 5)[0];
      npc.orbitAngleDeg = 359;

      mgr.updateNpcPositions(1, MIDNIGHT + 1000);

      expect(npc.orbitAngleDeg).toBeCloseTo(359 + PIRATE.angularVelocityDegPerSec - 360);
    });
  });

  // ---------- markDefeated ----------

  describe('markDefeated', () => {
    it('markDefeated_existingNpc_setsDefeatedAndTime', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npc = mgr.getNpcsForPlayer(1, 1)[0];

      mgr.markDefeated(npc.id);

      expect(npc.defeated).toBe(true);
      expect(npc.defeatTime).toBe(MIDNIGHT);
    });

    it('markDefeated_unknownNpc_doesNotThrow', () => {
      expect(() => NPCManager.getInstance().markDefeated(npcUserId(999, 1))).not.toThrow();
    });
  });

  // ---------- setInBattle ----------

  describe('setInBattle', () => {
    it('setInBattle_true_setsFlag', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npc = mgr.getNpcsForPlayer(1, 1)[0];

      mgr.setInBattle(npc.id, true);

      expect(npc.inBattle).toBe(true);
    });

    it('setInBattle_false_clearsFlag', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npc = mgr.getNpcsForPlayer(1, 1)[0];
      mgr.setInBattle(npc.id, true);

      mgr.setInBattle(npc.id, false);

      expect(npc.inBattle).toBe(false);
    });

    it('setInBattle_unknownNpc_doesNotThrow', () => {
      expect(() => NPCManager.getInstance().setInBattle(npcUserId(999, 1), true)).not.toThrow();
    });
  });

  // ---------- getNpcById ----------

  describe('getNpcById', () => {
    it('getNpcById_existingNpc_returnsNpc', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(3, 5);
      const drone = ofArchetype(npcs, 'drone')[1];

      expect(mgr.getNpcById(drone.id)).toBe(drone);
    });

    it('getNpcById_hiddenQuestBoundNpc_returnsNpc', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(3, 5);

      const warlord = mgr.getNpcById(npcUserId(3, 5 + WARLORD.spawns[0].levelOffset, WARLORD.spawns[0].slot));
      expect(warlord?.archetype).toBe('warlord');
    });

    it('getNpcById_noPlayerState_returnsNull', () => {
      expect(NPCManager.getInstance().getNpcById(npcUserId(1, 1))).toBeNull();
    });

    it('getNpcById_nonNpcId_returnsNull', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      expect(mgr.getNpcById(42)).toBeNull();
    });
  });

  // ---------- positionOf ----------

  describe('positionOf', () => {
    const station = getLocation('ironstrike_station');

    it('positionOf_pirateAt0deg_isEastOfTheStation', () => {
      const pos = NPCManager.positionOf({ archetype: 'pirate', orbitAngleDeg: 0 });
      expect(pos.x).toBeCloseTo(station.x + PIRATE.orbitRadius);
      expect(pos.y).toBeCloseTo(station.y);
    });

    it('positionOf_pirateAt90deg_isSouthOfTheStation', () => {
      const pos = NPCManager.positionOf({ archetype: 'pirate', orbitAngleDeg: 90 });
      expect(pos.x).toBeCloseTo(station.x);
      expect(pos.y).toBeCloseTo(station.y + PIRATE.orbitRadius);
    });

    it('positionOf_marauder_orbitsItsLair', () => {
      const lair = getLocation('hordes_reach');
      const pos = NPCManager.positionOf({ archetype: 'marauder', orbitAngleDeg: 180 });
      expect(pos.x).toBeCloseTo(lair.x - MARAUDER.orbitRadius);
      expect(pos.y).toBeCloseTo(lair.y);
    });
  });

  // ---------- ambush ----------

  describe('findAmbusher', () => {
    const lair = getLocation('hordes_reach');

    /** Position at the given distance outside (positive) or inside the marauder's start position. */
    function nearFirstMarauder(mgr: NPCManager, offset: number): { x: number; y: number } {
      const marauder = mgr.getNpcById(npcUserId(1, 4, MARAUDER.spawns[0].slot))!;
      const pos = NPCManager.positionOf(marauder);
      // Move away from the lair centre, so no other marauder comes closer
      const dx = (pos.x - lair.x) / MARAUDER.orbitRadius;
      const dy = (pos.y - lair.y) / MARAUDER.orbitRadius;
      return { x: pos.x + dx * offset, y: pos.y + dy * offset };
    }

    it('findAmbusher_playerInsideAggroRadius_returnsTheShip', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);

      const ambusher = mgr.findAmbusher(1, nearFirstMarauder(mgr, MARAUDER.aggroRadius - 1), npcs, MIDNIGHT);

      expect(ambusher?.archetype).toBe('marauder');
      expect(ambusher?.spawn.slot).toBe(MARAUDER.spawns[0].slot);
    });

    it('findAmbusher_playerOutsideAggroRadius_returnsNull', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);

      expect(mgr.findAmbusher(1, nearFirstMarauder(mgr, MARAUDER.aggroRadius + 1), npcs, MIDNIGHT)).toBeNull();
    });

    it('findAmbusher_playerNextToPassivePirate_returnsNull', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);
      const pirate = ofArchetype(npcs, 'pirate')[0];

      expect(mgr.findAmbusher(1, NPCManager.positionOf(pirate), npcs, MIDNIGHT)).toBeNull();
    });

    it('findAmbusher_twoShipsInRange_returnsTheNearest', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);
      const [first, second] = ofArchetype(npcs, 'marauder');
      // Put the second marauder next to the first one
      second.orbitAngleDeg = first.orbitAngleDeg + 5;
      const closeToSecond = NPCManager.positionOf(second);

      expect(mgr.findAmbusher(1, closeToSecond, npcs, MIDNIGHT)).toBe(second);
    });

    it('findAmbusher_defeatedShipNotInVisibleList_returnsNull', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const marauder = ofArchetype(mgr.getNpcsForPlayer(1, 5), 'marauder')[0];
      const position = nearFirstMarauder(mgr, 0);
      mgr.markDefeated(marauder.id);

      expect(mgr.findAmbusher(1, position, mgr.getNpcsForPlayer(1, 5), MIDNIGHT)).toBeNull();
    });

    it('findAmbusher_duringGracePeriod_returnsNull', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);
      const position = nearFirstMarauder(mgr, 0);
      mgr.setAmbushGrace(1, MIDNIGHT + AMBUSH_GRACE_MS);

      expect(mgr.findAmbusher(1, position, npcs, MIDNIGHT + AMBUSH_GRACE_MS - 1)).toBeNull();
      expect(mgr.findAmbusher(1, position, npcs, MIDNIGHT + AMBUSH_GRACE_MS)).not.toBeNull();
    });

    it('findAmbusher_gracePeriod_survivesLevelChange', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 5);
      mgr.setAmbushGrace(1, MIDNIGHT + AMBUSH_GRACE_MS);

      const npcs = mgr.getNpcsForPlayer(1, 6);
      const marauder = ofArchetype(npcs, 'marauder')[0];

      expect(mgr.findAmbusher(1, NPCManager.positionOf(marauder), npcs, MIDNIGHT + 1000)).toBeNull();
    });

    it('findAmbusher_unknownPlayer_returnsNull', () => {
      expect(NPCManager.getInstance().findAmbusher(999, { x: lair.x, y: lair.y }, [], MIDNIGHT)).toBeNull();
    });
  });

  // ---------- resetPlayer ----------

  describe('resetPlayer', () => {
    it('resetPlayer_defeatedNpcs_areAliveAgainOnNextAccess', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);
      mgr.markDefeated(npcs[0].id);

      expect(mgr.resetPlayer(1)).toBe(true);

      expect(mgr.getNpcsForPlayer(1, 5)).toHaveLength(FREE_SHIP_COUNT);
    });

    it('resetPlayer_npcInBattle_isRefused', () => {
      freezeTime(MIDNIGHT);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);
      mgr.setInBattle(npcs[0].id, true);

      expect(mgr.resetPlayer(1)).toBe(false);
      expect(mgr.getNpcById(npcs[0].id)).toBe(npcs[0]);
    });

    it('resetPlayer_unknownPlayer_returnsTrue', () => {
      expect(NPCManager.getInstance().resetPlayer(999)).toBe(true);
    });
  });
});
