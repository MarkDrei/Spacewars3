import { describe, test, expect, beforeEach } from 'vitest';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import {
  NPC_ID_OFFSET,
  NPCS_PER_PLAYER,
  NPC_START_ANGLES,
  NPC_ORBIT_RADIUS,
  NPC_ANGULAR_VELOCITY_DEG_PER_SEC,
  STARBASE_CENTER_X,
  STARBASE_CENTER_Y,
  calculateNpcId,
  calculateNpcPosition,
  calculateNpcFacingAngle,
  isNpcId,
  parseNpcId,
} from '@/lib/server/npc/npcTypes';

describe('NPCManager', () => {
  beforeEach(() => {
    NPCManager.resetInstance();
  });

  describe('getNpcsForPlayer', () => {
    test('getNpcsForPlayer_firstAccess_generates4Npcs', () => {
      const manager = NPCManager.getInstance();
      const npcs = manager.getNpcsForPlayer(1, 1);

      expect(npcs).toHaveLength(NPCS_PER_PLAYER);
    });

    test('getNpcsForPlayer_firstAccess_npcLevelsArePlayerLevelPlusIndex', () => {
      const manager = NPCManager.getInstance();
      const npcs = manager.getNpcsForPlayer(1, 3);

      expect(npcs[0].level).toBe(3);
      expect(npcs[1].level).toBe(4);
      expect(npcs[2].level).toBe(5);
      expect(npcs[3].level).toBe(6);
    });

    test('getNpcsForPlayer_firstAccess_npcIdsUseOffsetScheme', () => {
      const manager = NPCManager.getInstance();
      const npcs = manager.getNpcsForPlayer(5, 1);

      expect(npcs[0].id).toBe(NPC_ID_OFFSET + 5 * 10 + 0);
      expect(npcs[1].id).toBe(NPC_ID_OFFSET + 5 * 10 + 1);
      expect(npcs[2].id).toBe(NPC_ID_OFFSET + 5 * 10 + 2);
      expect(npcs[3].id).toBe(NPC_ID_OFFSET + 5 * 10 + 3);
    });

    test('getNpcsForPlayer_firstAccess_npcsStartAtDifferentQuadrants', () => {
      const manager = NPCManager.getInstance();
      const npcs = manager.getNpcsForPlayer(1, 1);

      expect(npcs[0].orbitAngleDeg).toBe(NPC_START_ANGLES[0]);
      expect(npcs[1].orbitAngleDeg).toBe(NPC_START_ANGLES[1]);
      expect(npcs[2].orbitAngleDeg).toBe(NPC_START_ANGLES[2]);
      expect(npcs[3].orbitAngleDeg).toBe(NPC_START_ANGLES[3]);
    });

    test('getNpcsForPlayer_secondAccess_returnsSameNpcs', () => {
      const manager = NPCManager.getInstance();
      const first = manager.getNpcsForPlayer(1, 1);
      const second = manager.getNpcsForPlayer(1, 1);

      expect(first).toBe(second);
    });

    test('getNpcsForPlayer_differentPlayers_differentNpcs', () => {
      const manager = NPCManager.getInstance();
      const player1Npcs = manager.getNpcsForPlayer(1, 1);
      const player2Npcs = manager.getNpcsForPlayer(2, 1);

      expect(player1Npcs[0].id).not.toBe(player2Npcs[0].id);
      expect(player1Npcs[0].ownerId).toBe(1);
      expect(player2Npcs[0].ownerId).toBe(2);
    });
  });

  describe('level refresh', () => {
    test('getNpcsForPlayer_levelChanged_regeneratesNpcs', () => {
      const manager = NPCManager.getInstance();
      const npcsLevel1 = manager.getNpcsForPlayer(1, 1);
      expect(npcsLevel1[0].level).toBe(1);

      const npcsLevel3 = manager.getNpcsForPlayer(1, 3);
      expect(npcsLevel3[0].level).toBe(3);
      expect(npcsLevel3[1].level).toBe(4);
    });

    test('getNpcsForPlayer_levelChanged_preservesNpcUserIdMappings', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);

      // Simulate an NPC user being created
      const npcId = calculateNpcId(1, 0);
      manager.setNpcUserId(npcId, 999);

      // Level up triggers regeneration
      manager.getNpcsForPlayer(1, 2);

      // NPC user mapping should be preserved
      expect(manager.getNpcUserId(npcId)).toBe(999);
    });
  });

  describe('updateNpcPositions', () => {
    test('updateNpcPositions_elapsed1Second_advancesAngle', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const state = manager.getPlayerState(1)!;
      const initialAngle = state.npcs[0].orbitAngleDeg; // 0 degrees
      const startTime = state.lastUpdateMs;

      // Advance by 1 second
      manager.updateNpcPositions(1, startTime + 1000);

      // Clockwise = decreasing angle. Starting from 0, subtracting 0.5 normalizes to 359.5
      const expectedAngle = ((initialAngle - NPC_ANGULAR_VELOCITY_DEG_PER_SEC) % 360 + 360) % 360;
      expect(state.npcs[0].orbitAngleDeg).toBeCloseTo(expectedAngle, 5);
    });

    test('updateNpcPositions_npcDefeated_doesNotAdvance', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const state = manager.getPlayerState(1)!;
      const npc = state.npcs[0];
      npc.defeated = true;
      const angleBeforeUpdate = npc.orbitAngleDeg;
      const startTime = state.lastUpdateMs;

      manager.updateNpcPositions(1, startTime + 5000);

      expect(npc.orbitAngleDeg).toBe(angleBeforeUpdate);
    });

    test('updateNpcPositions_npcInBattle_doesNotAdvance', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const state = manager.getPlayerState(1)!;
      const npc = state.npcs[0];
      npc.inBattle = true;
      const angleBeforeUpdate = npc.orbitAngleDeg;
      const startTime = state.lastUpdateMs;

      manager.updateNpcPositions(1, startTime + 5000);

      expect(npc.orbitAngleDeg).toBe(angleBeforeUpdate);
    });

    test('updateNpcPositions_angleWrapsAround', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const state = manager.getPlayerState(1)!;
      const npc = state.npcs[0];
      npc.orbitAngleDeg = 0.1; // Almost at 0
      const startTime = state.lastUpdateMs;

      // Advance by 1 second at 0.5 deg/s (clockwise = subtract)
      manager.updateNpcPositions(1, startTime + 1000);

      // Should wrap to ~359.6
      expect(npc.orbitAngleDeg).toBeGreaterThan(359);
      expect(npc.orbitAngleDeg).toBeLessThan(360);
    });
  });

  describe('midnight respawn', () => {
    test('updateNpcPositions_defeatedBeforeMidnight_respawns', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const state = manager.getPlayerState(1)!;
      const npc = state.npcs[0];

      // Defeat the NPC yesterday
      npc.defeated = true;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      npc.defeatTime = yesterday.getTime();

      // Update positions with a positive delta (triggers midnight check)
      manager.updateNpcPositions(1, state.lastUpdateMs + 1000);

      expect(npc.defeated).toBe(false);
      expect(npc.defeatTime).toBeNull();
      expect(npc.inBattle).toBe(false);
    });

    test('updateNpcPositions_defeatedToday_staysDefeated', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const state = manager.getPlayerState(1)!;
      const npc = state.npcs[0];

      // Defeat the NPC just now
      npc.defeated = true;
      npc.defeatTime = Date.now();

      manager.updateNpcPositions(1, state.lastUpdateMs + 1000);

      expect(npc.defeated).toBe(true);
    });
  });

  describe('getNpcSpaceObjects', () => {
    test('getNpcSpaceObjects_noDefeatedNpcs_returns4SpaceObjects', () => {
      const manager = NPCManager.getInstance();
      const objects = manager.getNpcSpaceObjects(1, 1, Date.now());

      expect(objects).toHaveLength(4);
      expect(objects[0].type).toBe('npc_ship');
    });

    test('getNpcSpaceObjects_oneDefeated_returns3SpaceObjects', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const state = manager.getPlayerState(1)!;
      state.npcs[0].defeated = true;

      const objects = manager.getNpcSpaceObjects(1, 1, Date.now());
      expect(objects).toHaveLength(3);
    });

    test('getNpcSpaceObjects_includesOrbitDataForInterpolation', () => {
      const manager = NPCManager.getInstance();
      const objects = manager.getNpcSpaceObjects(1, 1, Date.now());

      expect(objects[0].orbitAngleDeg).toBeDefined();
      expect(objects[0].angularVelocityDegPerSec).toBeDefined();
      expect(objects[0].username).toContain('NPC');
    });
  });

  describe('markDefeated', () => {
    test('markDefeated_existingNpc_setsDefeatedTrue', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const npcId = calculateNpcId(1, 0);

      manager.markDefeated(npcId);

      const npc = manager.getNpcById(npcId);
      expect(npc!.defeated).toBe(true);
      expect(npc!.defeatTime).not.toBeNull();
      expect(npc!.inBattle).toBe(false);
    });
  });

  describe('setNpcInBattle', () => {
    test('setNpcInBattle_setsFlag', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const npcId = calculateNpcId(1, 0);

      manager.setNpcInBattle(npcId, true);

      const npc = manager.getNpcById(npcId);
      expect(npc!.inBattle).toBe(true);
    });
  });

  describe('getNpcByUserId', () => {
    test('getNpcByUserId_mappingExists_returnsNpc', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);
      const npcId = calculateNpcId(1, 0);
      manager.setNpcUserId(npcId, 999);

      const npc = manager.getNpcByUserId(999);
      expect(npc).not.toBeNull();
      expect(npc!.id).toBe(npcId);
    });

    test('getNpcByUserId_noMapping_returnsNull', () => {
      const manager = NPCManager.getInstance();
      manager.getNpcsForPlayer(1, 1);

      const npc = manager.getNpcByUserId(999);
      expect(npc).toBeNull();
    });
  });
});

describe('NPC Type Utilities', () => {
  test('calculateNpcId_correctFormula', () => {
    expect(calculateNpcId(1, 0)).toBe(NPC_ID_OFFSET + 10);
    expect(calculateNpcId(1, 3)).toBe(NPC_ID_OFFSET + 13);
    expect(calculateNpcId(5, 2)).toBe(NPC_ID_OFFSET + 52);
  });

  test('isNpcId_npcRange_returnsTrue', () => {
    expect(isNpcId(NPC_ID_OFFSET)).toBe(true);
    expect(isNpcId(NPC_ID_OFFSET + 100)).toBe(true);
  });

  test('isNpcId_belowRange_returnsFalse', () => {
    expect(isNpcId(0)).toBe(false);
    expect(isNpcId(9001)).toBe(false);
    expect(isNpcId(19999)).toBe(false);
  });

  test('parseNpcId_validId_returnsOwnerAndIndex', () => {
    const result = parseNpcId(calculateNpcId(3, 2));
    expect(result).toEqual({ ownerId: 3, index: 2 });
  });

  test('parseNpcId_invalidId_returnsNull', () => {
    expect(parseNpcId(100)).toBeNull();
  });

  test('calculateNpcPosition_angle0_positionAtRightOfStarbase', () => {
    const pos = calculateNpcPosition(0);
    expect(pos.x).toBeCloseTo(STARBASE_CENTER_X + NPC_ORBIT_RADIUS);
    expect(pos.y).toBeCloseTo(STARBASE_CENTER_Y);
  });

  test('calculateNpcPosition_angle90_positionBelowStarbase', () => {
    const pos = calculateNpcPosition(90);
    expect(pos.x).toBeCloseTo(STARBASE_CENTER_X);
    expect(pos.y).toBeCloseTo(STARBASE_CENTER_Y + NPC_ORBIT_RADIUS);
  });

  test('calculateNpcFacingAngle_clockwiseTangent', () => {
    // At angle 0, clockwise tangent is -90 (pointing down)
    expect(calculateNpcFacingAngle(0)).toBe(-90);
    // At angle 90, clockwise tangent is 0 (pointing right)
    expect(calculateNpcFacingAngle(90)).toBe(0);
  });
});
