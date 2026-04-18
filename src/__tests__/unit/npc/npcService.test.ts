import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateNpcsForPlayer,
  calculateNpcPosition,
  calculateNpcFacingAngle,
  calculateNpcSpeed,
  calculateNpcOrbitAngle,
  getNpcLevel,
  generateNpcUsername,
  markNpcDefeated,
  isNpcDefeated,
  resetDefeatedNpcs,
  createNpcTechCounts,
  createNpcTechTree,
  resolveNpcUserId,
} from '@/lib/server/npc/npcService';
import {
  NPC_COUNT_PER_PLAYER,
  NPC_ORBIT_RADIUS,
  NPC_ORBIT_CENTER,
  getNpcUserId,
  getNpcSpaceObjectId,
  isNpcUserId,
  isNpcSpaceObjectId,
} from '@/shared/npcConstants';

describe('NPC Service', () => {
  beforeEach(() => {
    resetDefeatedNpcs();
  });

  describe('getNpcLevel', () => {
    it('getNpcLevel_firstNpc_returnsPlayerLevel', () => {
      expect(getNpcLevel(3, 0)).toBe(3);
    });

    it('getNpcLevel_lastNpc_returnsPlayerLevelPlus3', () => {
      expect(getNpcLevel(1, 3)).toBe(4);
    });

    it('getNpcLevel_highLevel_scalesCorrectly', () => {
      expect(getNpcLevel(10, 2)).toBe(12);
    });
  });

  describe('generateNpcUsername', () => {
    it('generateNpcUsername_level1_returnsFormattedName', () => {
      expect(generateNpcUsername(1)).toBe('Pirate Lv.1');
    });

    it('generateNpcUsername_highLevel_includesLevel', () => {
      expect(generateNpcUsername(42)).toBe('Pirate Lv.42');
    });
  });

  describe('calculateNpcOrbitAngle', () => {
    it('calculateNpcOrbitAngle_firstNpcAtTimeZero_returnsZero', () => {
      const angle = calculateNpcOrbitAngle(0, 0);
      expect(angle).toBeCloseTo(0);
    });

    it('calculateNpcOrbitAngle_secondNpcAtTimeZero_returns90Degrees', () => {
      const angle = calculateNpcOrbitAngle(1, 0);
      expect(angle).toBeCloseTo(Math.PI / 2); // 90°
    });

    it('calculateNpcOrbitAngle_thirdNpcAtTimeZero_returns180Degrees', () => {
      const angle = calculateNpcOrbitAngle(2, 0);
      expect(angle).toBeCloseTo(Math.PI); // 180°
    });

    it('calculateNpcOrbitAngle_fourthNpcAtTimeZero_returns270Degrees', () => {
      const angle = calculateNpcOrbitAngle(3, 0);
      expect(angle).toBeCloseTo((3 * Math.PI) / 2); // 270°
    });

    it('calculateNpcOrbitAngle_clockwiseRotation_angleDecreases', () => {
      const angle0 = calculateNpcOrbitAngle(0, 0);
      const angle1 = calculateNpcOrbitAngle(0, 1000); // 1 second later
      // Clockwise means angle decreases
      expect(angle1).toBeLessThan(angle0);
    });
  });

  describe('calculateNpcPosition', () => {
    it('calculateNpcPosition_firstNpcAtTimeZero_isOnOrbitRadius', () => {
      const pos = calculateNpcPosition(0, 0);
      const dx = pos.x - NPC_ORBIT_CENTER.x;
      const dy = pos.y - NPC_ORBIT_CENTER.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeCloseTo(NPC_ORBIT_RADIUS);
    });

    it('calculateNpcPosition_allNpcsAtTimeZero_areEvenlySpaced', () => {
      const positions = [];
      for (let i = 0; i < NPC_COUNT_PER_PLAYER; i++) {
        positions.push(calculateNpcPosition(i, 0));
      }

      // Check that consecutive NPCs are 90° apart
      for (let i = 0; i < positions.length - 1; i++) {
        const angle1 = Math.atan2(
          positions[i].y - NPC_ORBIT_CENTER.y,
          positions[i].x - NPC_ORBIT_CENTER.x
        );
        const angle2 = Math.atan2(
          positions[i + 1].y - NPC_ORBIT_CENTER.y,
          positions[i + 1].x - NPC_ORBIT_CENTER.x
        );
        let diff = angle2 - angle1;
        // Normalize to [0, 2π)
        if (diff < 0) diff += 2 * Math.PI;
        expect(diff).toBeCloseTo(Math.PI / 2, 3); // ~90°
      }
    });

    it('calculateNpcPosition_overTime_positionChanges', () => {
      const pos1 = calculateNpcPosition(0, 0);
      const pos2 = calculateNpcPosition(0, 10000); // 10 seconds later
      // Position should have changed
      expect(pos1.x).not.toBeCloseTo(pos2.x, 0);
    });

    it('calculateNpcPosition_firstNpcAtTimeZero_isAtExpectedPosition', () => {
      // At time 0, NPC 0 starts at angle 0 → (center.x + radius, center.y)
      const pos = calculateNpcPosition(0, 0);
      expect(pos.x).toBeCloseTo(NPC_ORBIT_CENTER.x + NPC_ORBIT_RADIUS);
      expect(pos.y).toBeCloseTo(NPC_ORBIT_CENTER.y);
    });
  });

  describe('calculateNpcFacingAngle', () => {
    it('calculateNpcFacingAngle_returnsAngleInValidRange', () => {
      const angle = calculateNpcFacingAngle(0, 0);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
    });

    it('calculateNpcFacingAngle_firstNpcAtTimeZero_facesTangentToOrbit', () => {
      // NPC 0 at time 0 is at angle 0° (right of center)
      // Clockwise tangent would be facing downward (270° or equivalent)
      const angle = calculateNpcFacingAngle(0, 0);
      expect(angle).toBeCloseTo(270, 0);
    });
  });

  describe('calculateNpcSpeed', () => {
    it('calculateNpcSpeed_returnsPositiveValue', () => {
      expect(calculateNpcSpeed()).toBeGreaterThan(0);
    });

    it('calculateNpcSpeed_isConsistentWithOrbitParameters', () => {
      // speed = angular_velocity_rad * radius
      const angularVelocityRad = (2 * Math.PI) / 180; // 2 deg/sec in radians
      const expectedSpeed = angularVelocityRad * NPC_ORBIT_RADIUS;
      expect(calculateNpcSpeed()).toBeCloseTo(expectedSpeed);
    });
  });

  describe('generateNpcsForPlayer', () => {
    it('generateNpcsForPlayer_standardCase_returnsFourNpcs', () => {
      const npcs = generateNpcsForPlayer(1, 1, 0);
      expect(npcs).toHaveLength(4);
    });

    it('generateNpcsForPlayer_correctLevels_matchesPlayerLevelProgression', () => {
      const npcs = generateNpcsForPlayer(1, 5, 0);
      expect(npcs[0].level).toBe(5);
      expect(npcs[1].level).toBe(6);
      expect(npcs[2].level).toBe(7);
      expect(npcs[3].level).toBe(8);
    });

    it('generateNpcsForPlayer_correctType_allArePlayerShips', () => {
      const npcs = generateNpcsForPlayer(1, 1, 0);
      npcs.forEach(npc => {
        expect(npc.type).toBe('player_ship');
      });
    });

    it('generateNpcsForPlayer_correctIds_useNpcIdOffset', () => {
      const npcs = generateNpcsForPlayer(1, 1, 0);
      npcs.forEach((npc, i) => {
        expect(npc.id).toBe(getNpcSpaceObjectId(1, i));
      });
    });

    it('generateNpcsForPlayer_correctUserIds_areNegative', () => {
      const npcs = generateNpcsForPlayer(1, 1, 0);
      npcs.forEach((npc, i) => {
        expect(npc.userId).toBe(getNpcUserId(1, i));
        expect(npc.userId!).toBeLessThan(0);
      });
    });

    it('generateNpcsForPlayer_usernames_containLevelInfo', () => {
      const npcs = generateNpcsForPlayer(1, 3, 0);
      expect(npcs[0].username).toBe('Pirate Lv.3');
      expect(npcs[1].username).toBe('Pirate Lv.4');
    });

    it('generateNpcsForPlayer_withDefeatedNpc_excludesDefeatedNpcs', () => {
      markNpcDefeated(1, 1); // Defeat NPC index 1
      const npcs = generateNpcsForPlayer(1, 1, 0);
      expect(npcs).toHaveLength(3);
      // NPC index 1 should be missing
      const npcUserIds = npcs.map(n => n.userId);
      expect(npcUserIds).not.toContain(getNpcUserId(1, 1));
    });

    it('generateNpcsForPlayer_allDefeated_returnsEmptyArray', () => {
      for (let i = 0; i < NPC_COUNT_PER_PLAYER; i++) {
        markNpcDefeated(1, i);
      }
      const npcs = generateNpcsForPlayer(1, 1, 0);
      expect(npcs).toHaveLength(0);
    });

    it('generateNpcsForPlayer_differentPlayers_seeDifferentNpcs', () => {
      const npcs1 = generateNpcsForPlayer(1, 1, 0);
      const npcs2 = generateNpcsForPlayer(2, 5, 0);
      // Different IDs
      expect(npcs1[0].id).not.toBe(npcs2[0].id);
      // Different levels
      expect(npcs1[0].level).not.toBe(npcs2[0].level);
    });

    it('generateNpcsForPlayer_allOnOrbit_correctDistanceFromStarbase', () => {
      const npcs = generateNpcsForPlayer(1, 1, 12345);
      npcs.forEach(npc => {
        const dx = npc.x - NPC_ORBIT_CENTER.x;
        const dy = npc.y - NPC_ORBIT_CENTER.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeCloseTo(NPC_ORBIT_RADIUS, 1);
      });
    });
  });

  describe('defeat tracking', () => {
    it('isNpcDefeated_noDefeats_returnsFalse', () => {
      expect(isNpcDefeated(1, 0)).toBe(false);
    });

    it('markNpcDefeated_thenCheck_returnsTrue', () => {
      markNpcDefeated(1, 2);
      expect(isNpcDefeated(1, 2)).toBe(true);
    });

    it('markNpcDefeated_differentPlayer_doesNotAffectOtherPlayers', () => {
      markNpcDefeated(1, 0);
      expect(isNpcDefeated(2, 0)).toBe(false);
    });

    it('resetDefeatedNpcs_clearsAllDefeats', () => {
      markNpcDefeated(1, 0);
      markNpcDefeated(2, 1);
      resetDefeatedNpcs();
      expect(isNpcDefeated(1, 0)).toBe(false);
      expect(isNpcDefeated(2, 1)).toBe(false);
    });
  });

  describe('createNpcTechCounts', () => {
    it('createNpcTechCounts_level1_has100DefenseEach', () => {
      const tc = createNpcTechCounts(1, 0);
      expect(tc.ship_hull).toBe(100);
      expect(tc.kinetic_armor).toBe(100);
      expect(tc.energy_shield).toBe(100);
    });

    it('createNpcTechCounts_level1_has10Weapons', () => {
      const tc = createNpcTechCounts(1, 0);
      // Weapon index 0 = pulse_laser
      expect(tc.pulse_laser).toBe(10);
      // Other weapons should be 0
      expect(tc.auto_turret).toBe(0);
    });

    it('createNpcTechCounts_level2_hasX5ScaledStats', () => {
      const tc = createNpcTechCounts(2, 0);
      expect(tc.ship_hull).toBe(500);
      expect(tc.kinetic_armor).toBe(500);
      expect(tc.energy_shield).toBe(500);
      expect(tc.pulse_laser).toBe(50);
    });

    it('createNpcTechCounts_level3_hasX25ScaledStats', () => {
      const tc = createNpcTechCounts(3, 0);
      expect(tc.ship_hull).toBe(2500);
      expect(tc.kinetic_armor).toBe(2500);
      expect(tc.energy_shield).toBe(2500);
      expect(tc.pulse_laser).toBe(250);
    });

    it('createNpcTechCounts_missileJammer_alwaysZero', () => {
      const tc = createNpcTechCounts(3, 0);
      expect(tc.missile_jammer).toBe(0);
    });

    it('createNpcTechCounts_differentWeaponIndex_assignsDifferentWeapon', () => {
      const tc = createNpcTechCounts(1, 3); // index 3 = gauss_rifle
      expect(tc.gauss_rifle).toBe(10);
      expect(tc.pulse_laser).toBe(0);
    });
  });

  describe('createNpcTechTree', () => {
    it('createNpcTechTree_level1_allResearchesAtLevel1', () => {
      const tree = createNpcTechTree(1);
      expect(tree.ironHarvesting).toBe(1);
      expect(tree.shipSpeed).toBe(1);
      expect(tree.hullStrength).toBe(1);
    });

    it('createNpcTechTree_level5_allResearchesAtLevel5', () => {
      const tree = createNpcTechTree(5);
      expect(tree.ironHarvesting).toBe(5);
      expect(tree.shipSpeed).toBe(5);
      expect(tree.hullStrength).toBe(5);
      expect(tree.armorEffectiveness).toBe(5);
      expect(tree.shieldEffectiveness).toBe(5);
      expect(tree.projectileDamage).toBe(5);
      expect(tree.energyDamage).toBe(5);
    });
  });

  describe('NPC ID utilities', () => {
    it('getNpcUserId_returnsNegativeId', () => {
      expect(getNpcUserId(1, 0)).toBeLessThan(0);
    });

    it('isNpcUserId_negativeId_returnsTrue', () => {
      expect(isNpcUserId(-1)).toBe(true);
      expect(isNpcUserId(getNpcUserId(1, 0))).toBe(true);
    });

    it('isNpcUserId_positiveId_returnsFalse', () => {
      expect(isNpcUserId(1)).toBe(false);
      expect(isNpcUserId(0)).toBe(false);
    });

    it('isNpcSpaceObjectId_npcId_returnsTrue', () => {
      expect(isNpcSpaceObjectId(getNpcSpaceObjectId(1, 0))).toBe(true);
    });

    it('isNpcSpaceObjectId_regularId_returnsFalse', () => {
      expect(isNpcSpaceObjectId(1)).toBe(false);
      expect(isNpcSpaceObjectId(9001)).toBe(false); // Starbase
    });

    it('resolveNpcUserId_validNpcId_returnsPlayerAndIndex', () => {
      const npcUserId = getNpcUserId(5, 2);
      const resolved = resolveNpcUserId(npcUserId);
      expect(resolved).not.toBeNull();
      expect(resolved!.playerUserId).toBe(5);
      expect(resolved!.npcIndex).toBe(2);
    });

    it('resolveNpcUserId_positiveId_returnsNull', () => {
      expect(resolveNpcUserId(1)).toBeNull();
    });

    it('resolveNpcUserId_roundTrip_allIndices', () => {
      for (let player = 1; player <= 5; player++) {
        for (let npc = 0; npc < NPC_COUNT_PER_PLAYER; npc++) {
          const id = getNpcUserId(player, npc);
          const resolved = resolveNpcUserId(id);
          expect(resolved).not.toBeNull();
          expect(resolved!.playerUserId).toBe(player);
          expect(resolved!.npcIndex).toBe(npc);
        }
      }
    });
  });
});
