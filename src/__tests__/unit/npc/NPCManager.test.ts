import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import {
  NPC_USER_ID_OFFSET,
  NPC_IDS_PER_USER,
  NPC_COUNT,
  ORBIT_RADIUS,
  STARBASE_X,
  STARBASE_Y,
  BASE_ANGULAR_VELOCITY_DEG_PER_SEC,
  NPC_START_ANGLES,
  npcUserId,
  isNpcId,
  parseNpcId,
} from '@/lib/server/npc/npcConstants';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Freeze Date.now to a deterministic value for predictable tests. */
function freezeTime(ms: number): void {
  vi.spyOn(Date, 'now').mockReturnValue(ms);
}

// ---------------------------------------------------------------------------
// Tests for npcConstants utility functions
// ---------------------------------------------------------------------------

describe('npcConstants helpers', () => {
  describe('npcUserId', () => {
    it('npcUserId_zeroOwnerIndex0_returnsOffset', () => {
      expect(npcUserId(0, 0)).toBe(NPC_USER_ID_OFFSET);
    });

    it('npcUserId_owner1Index0_returnsOffsetPlus1000', () => {
      expect(npcUserId(1, 0)).toBe(NPC_USER_ID_OFFSET + NPC_IDS_PER_USER);
    });

    it('npcUserId_owner1Index3_returnsCorrectValue', () => {
      expect(npcUserId(1, 3)).toBe(NPC_USER_ID_OFFSET + NPC_IDS_PER_USER + 3);
    });

    it('npcUserId_largeOwner_staysInRange', () => {
      const id = npcUserId(999_999, 999);
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
    it('parseNpcId_validId_returnsOwnerAndIndex', () => {
      const id = npcUserId(7, 2);
      expect(parseNpcId(id)).toEqual({ ownerId: 7, npcIndex: 2 });
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
    it('getNpcsForPlayer_firstCall_generates4Npcs', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);

      expect(npcs).toHaveLength(NPC_COUNT);
    });

    it('getNpcsForPlayer_firstCall_npcLevelsMatchPlayerLevelPlusIndex', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 5);

      expect(npcs.map((n) => n.level)).toEqual([5, 6, 7, 8]);
    });

    it('getNpcsForPlayer_firstCall_npcsHaveCorrectOwnerAndIds', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(42, 1);

      for (let i = 0; i < NPC_COUNT; i++) {
        expect(npcs[i].ownerId).toBe(42);
        expect(npcs[i].npcIndex).toBe(i);
        expect(npcs[i].id).toBe(npcUserId(42, i));
      }
    });

    it('getNpcsForPlayer_firstCall_npcsStartAtQuadrantAngles', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 1);

      expect(npcs.map((n) => n.orbitAngleDeg)).toEqual([...NPC_START_ANGLES]);
    });

    it('getNpcsForPlayer_firstCall_npcsAreNotDefeated', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 1);

      for (const npc of npcs) {
        expect(npc.defeated).toBe(false);
        expect(npc.defeatTime).toBeNull();
        expect(npc.inBattle).toBe(false);
        expect(npc.npcUserCreated).toBe(false);
      }
    });

    it('getNpcsForPlayer_defeatedNpc_excludedFromResult', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();

      // First call generates NPCs
      const npcs = mgr.getNpcsForPlayer(1, 1);
      expect(npcs).toHaveLength(4);

      // Defeat one NPC
      mgr.markDefeated(npcs[0].id);

      // Fetch again — only 3 returned
      const npcs2 = mgr.getNpcsForPlayer(1, 1);
      expect(npcs2).toHaveLength(3);
      expect(npcs2.find((n) => n.id === npcs[0].id)).toBeUndefined();
    });

    it('getNpcsForPlayer_secondCallSameLevel_returnsCachedNpcs', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const first = mgr.getNpcsForPlayer(1, 5);
      const second = mgr.getNpcsForPlayer(1, 5);

      // Same object references (not regenerated)
      expect(first[0]).toBe(second[0]);
    });

    it('getNpcsForPlayer_differentPlayers_independentNpcs', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const player1Npcs = mgr.getNpcsForPlayer(1, 3);
      const player2Npcs = mgr.getNpcsForPlayer(2, 7);

      expect(player1Npcs[0].ownerId).toBe(1);
      expect(player2Npcs[0].ownerId).toBe(2);
      expect(player1Npcs[0].level).toBe(3);
      expect(player2Npcs[0].level).toBe(7);
    });
  });

  // ---------- level refresh ----------

  describe('level refresh', () => {
    it('getNpcsForPlayer_levelChanged_regeneratesNpcs', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const old = mgr.getNpcsForPlayer(1, 3);
      expect(old[0].level).toBe(3);

      // Player levels up
      const fresh = mgr.getNpcsForPlayer(1, 5);
      expect(fresh).toHaveLength(4);
      expect(fresh[0].level).toBe(5);
    });

    it('getNpcsForPlayer_levelChanged_resetsDefeatedStatus', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      const npcs = mgr.getNpcsForPlayer(1, 3);
      mgr.markDefeated(npcs[0].id);

      // Level change triggers full regeneration
      const fresh = mgr.getNpcsForPlayer(1, 5);
      expect(fresh).toHaveLength(4);
      for (const npc of fresh) {
        expect(npc.defeated).toBe(false);
      }
    });
  });

  // ---------- midnight respawn ----------

  describe('midnight respawn', () => {
    it('getNpcsForPlayer_defeatedBeforeMidnight_respawnsAfterMidnight', () => {
      const mgr = NPCManager.getInstance();

      // Defeat at 11pm yesterday
      const yesterday11pm = getMidnightUtcMs() - 3_600_000; // 1h before midnight
      freezeTime(yesterday11pm);
      mgr.getNpcsForPlayer(1, 1);
      mgr.markDefeated(npcUserId(1, 0));

      // Now it's after midnight
      const todayNoon = getMidnightUtcMs() + 12 * 3_600_000;
      freezeTime(todayNoon);

      const npcs = mgr.getNpcsForPlayer(1, 1);
      expect(npcs).toHaveLength(4); // All 4 back, including the one defeated yesterday
    });

    it('getNpcsForPlayer_defeatedAfterMidnight_remainsDefeated', () => {
      const mgr = NPCManager.getInstance();

      // Defeat at 1am today
      const today1am = getMidnightUtcMs() + 3_600_000;
      freezeTime(today1am);
      mgr.getNpcsForPlayer(1, 1);
      mgr.markDefeated(npcUserId(1, 0));

      // Still today, 2pm
      const today2pm = getMidnightUtcMs() + 14 * 3_600_000;
      freezeTime(today2pm);

      const npcs = mgr.getNpcsForPlayer(1, 1);
      expect(npcs).toHaveLength(3); // Still defeated
    });

    it('getNpcsForPlayer_respawnedNpc_resetsNpcUserCreated', () => {
      const mgr = NPCManager.getInstance();

      const yesterday = getMidnightUtcMs() - 3_600_000;
      freezeTime(yesterday);
      mgr.getNpcsForPlayer(1, 1);

      // Simulate having a DB user and then defeating
      const npc = mgr.getNpcById(npcUserId(1, 0))!;
      npc.npcUserCreated = true;
      mgr.markDefeated(npc.id);

      // After midnight
      freezeTime(getMidnightUtcMs() + 3_600_000);
      mgr.getNpcsForPlayer(1, 1);

      const respawned = mgr.getNpcById(npcUserId(1, 0))!;
      expect(respawned.npcUserCreated).toBe(false);
      expect(respawned.defeated).toBe(false);
    });

    it('getNpcsForPlayer_respawnedNpc_resetsToStartAngle', () => {
      const mgr = NPCManager.getInstance();

      const yesterday = getMidnightUtcMs() - 3_600_000;
      freezeTime(yesterday);
      mgr.getNpcsForPlayer(1, 1);

      // Move angle away from start
      const npc = mgr.getNpcById(npcUserId(1, 1))!;
      npc.orbitAngleDeg = 123.456;
      mgr.markDefeated(npc.id);

      // After midnight
      freezeTime(getMidnightUtcMs() + 3_600_000);
      mgr.getNpcsForPlayer(1, 1);

      const respawned = mgr.getNpcById(npcUserId(1, 1))!;
      expect(respawned.orbitAngleDeg).toBe(NPC_START_ANGLES[1]);
    });
  });

  // ---------- updateNpcPositions ----------

  describe('updateNpcPositions', () => {
    it('updateNpcPositions_elapsedTime_advancesAngle', () => {
      const baseTime = 1_000_000;
      freezeTime(baseTime);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      // Advance 10 seconds with multiplier = 1
      const futureMs = baseTime + 10_000;
      mgr.updateNpcPositions(1, futureMs);

      const npc = mgr.getNpcById(npcUserId(1, 0))!;
      const expectedAngle = (NPC_START_ANGLES[0] + BASE_ANGULAR_VELOCITY_DEG_PER_SEC * 10) % 360;
      expect(npc.orbitAngleDeg).toBeCloseTo(expectedAngle, 5);
    });

    it('updateNpcPositions_timeMultiplier_scalesAngleDelta', () => {
      const baseTime = 1_000_000;
      freezeTime(baseTime);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      // Set time multiplier to 5x
      TimeMultiplierService.getInstance().setMultiplier(5, 60);

      // Advance 10 seconds
      const futureMs = baseTime + 10_000;
      mgr.updateNpcPositions(1, futureMs);

      const npc = mgr.getNpcById(npcUserId(1, 0))!;
      const expectedAngle = (NPC_START_ANGLES[0] + BASE_ANGULAR_VELOCITY_DEG_PER_SEC * 10 * 5) % 360;
      expect(npc.orbitAngleDeg).toBeCloseTo(expectedAngle, 5);
    });

    it('updateNpcPositions_defeatedNpc_doesNotAdvance', () => {
      const baseTime = 1_000_000;
      freezeTime(baseTime);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      mgr.markDefeated(npcUserId(1, 0));
      const beforeAngle = mgr.getNpcById(npcUserId(1, 0))!.orbitAngleDeg;

      mgr.updateNpcPositions(1, baseTime + 10_000);

      expect(mgr.getNpcById(npcUserId(1, 0))!.orbitAngleDeg).toBe(beforeAngle);
    });

    it('updateNpcPositions_inBattleNpc_doesNotAdvance', () => {
      const baseTime = 1_000_000;
      freezeTime(baseTime);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      mgr.setInBattle(npcUserId(1, 1), true);
      const beforeAngle = mgr.getNpcById(npcUserId(1, 1))!.orbitAngleDeg;

      mgr.updateNpcPositions(1, baseTime + 10_000);

      expect(mgr.getNpcById(npcUserId(1, 1))!.orbitAngleDeg).toBe(beforeAngle);
    });

    it('updateNpcPositions_noPlayerState_doesNotThrow', () => {
      const mgr = NPCManager.getInstance();
      expect(() => mgr.updateNpcPositions(999, Date.now())).not.toThrow();
    });

    it('updateNpcPositions_wrapsAt360', () => {
      const baseTime = 1_000_000;
      freezeTime(baseTime);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      // Advance enough to wrap past 360 (NPC at 270° + 200° = 470° → 110°)
      const secondsFor200Deg = 200 / BASE_ANGULAR_VELOCITY_DEG_PER_SEC;
      mgr.updateNpcPositions(1, baseTime + secondsFor200Deg * 1000);

      const npc = mgr.getNpcById(npcUserId(1, 3))!; // starts at 270°
      expect(npc.orbitAngleDeg).toBeCloseTo(110, 1);
    });
  });

  // ---------- markDefeated ----------

  describe('markDefeated', () => {
    it('markDefeated_existingNpc_setsDefeatedAndTime', () => {
      const now = 5_000_000;
      freezeTime(now);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      mgr.markDefeated(npcUserId(1, 2));

      const npc = mgr.getNpcById(npcUserId(1, 2))!;
      expect(npc.defeated).toBe(true);
      expect(npc.defeatTime).toBe(now);
    });

    it('markDefeated_unknownNpc_doesNotThrow', () => {
      const mgr = NPCManager.getInstance();
      expect(() => mgr.markDefeated(npcUserId(999, 0))).not.toThrow();
    });
  });

  // ---------- setInBattle ----------

  describe('setInBattle', () => {
    it('setInBattle_true_setsFlag', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      mgr.setInBattle(npcUserId(1, 0), true);
      expect(mgr.getNpcById(npcUserId(1, 0))!.inBattle).toBe(true);
    });

    it('setInBattle_false_clearsFlag', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);

      mgr.setInBattle(npcUserId(1, 0), true);
      mgr.setInBattle(npcUserId(1, 0), false);
      expect(mgr.getNpcById(npcUserId(1, 0))!.inBattle).toBe(false);
    });

    it('setInBattle_unknownNpc_doesNotThrow', () => {
      const mgr = NPCManager.getInstance();
      expect(() => mgr.setInBattle(npcUserId(999, 0), true)).not.toThrow();
    });
  });

  // ---------- getNpcById ----------

  describe('getNpcById', () => {
    it('getNpcById_existingNpc_returnsNpc', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(10, 2);

      const npc = mgr.getNpcById(npcUserId(10, 3));
      expect(npc).not.toBeNull();
      expect(npc!.ownerId).toBe(10);
      expect(npc!.npcIndex).toBe(3);
    });

    it('getNpcById_noPlayerState_returnsNull', () => {
      const mgr = NPCManager.getInstance();
      expect(mgr.getNpcById(npcUserId(10, 0))).toBeNull();
    });

    it('getNpcById_nonNpcId_returnsNull', () => {
      freezeTime(1_000_000);
      const mgr = NPCManager.getInstance();
      mgr.getNpcsForPlayer(1, 1);
      expect(mgr.getNpcById(42)).toBeNull();
    });
  });

  // ---------- positionForAngle ----------

  describe('positionForAngle', () => {
    it('positionForAngle_0deg_returnsStarbaseXPlusRadius', () => {
      const pos = NPCManager.positionForAngle(0);
      expect(pos.x).toBeCloseTo(STARBASE_X + ORBIT_RADIUS, 5);
      expect(pos.y).toBeCloseTo(STARBASE_Y, 5);
    });

    it('positionForAngle_90deg_returnsStarbaseYPlusRadius', () => {
      const pos = NPCManager.positionForAngle(90);
      expect(pos.x).toBeCloseTo(STARBASE_X, 5);
      expect(pos.y).toBeCloseTo(STARBASE_Y + ORBIT_RADIUS, 5);
    });

    it('positionForAngle_180deg_returnsStarbaseXMinusRadius', () => {
      const pos = NPCManager.positionForAngle(180);
      expect(pos.x).toBeCloseTo(STARBASE_X - ORBIT_RADIUS, 5);
      expect(pos.y).toBeCloseTo(STARBASE_Y, 5);
    });

    it('positionForAngle_270deg_returnsStarbaseYMinusRadius', () => {
      const pos = NPCManager.positionForAngle(270);
      expect(pos.x).toBeCloseTo(STARBASE_X, 5);
      expect(pos.y).toBeCloseTo(STARBASE_Y - ORBIT_RADIUS, 5);
    });
  });
});

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/** Return epoch-ms for today's 00:00:00 UTC. */
function getMidnightUtcMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
