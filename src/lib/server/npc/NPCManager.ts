// ---
// NPCManager: Singleton managing per-player NPC state.
// NPCs are ephemeral (in-memory only), regenerated on server start and midnight reset.
// Follows globalThis singleton pattern like other caches.
// ---

import {
  NpcShip,
  PlayerNpcState,
  NPC_ANGULAR_VELOCITY_DEG_PER_SEC,
  NPC_START_ANGLES,
  NPCS_PER_PLAYER,
  calculateNpcId,
  calculateNpcPosition,
  calculateNpcFacingAngle,
} from './npcTypes';
import type { SpaceObject } from '@shared/types/gameTypes';

declare global {
  var npcManagerInstance: NPCManager | null;
}

/**
 * Get the start of today (midnight) in milliseconds since epoch
 */
function getTodayMidnightMs(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return midnight.getTime();
}

export class NPCManager {
  private playerStates: Map<number, PlayerNpcState> = new Map();

  private constructor() {}

  // ===== SINGLETON PATTERN =====

  private static get instance(): NPCManager | null {
    return globalThis.npcManagerInstance || null;
  }

  private static set instance(value: NPCManager | null) {
    globalThis.npcManagerInstance = value;
  }

  static getInstance(): NPCManager {
    if (!NPCManager.instance) {
      NPCManager.instance = new NPCManager();
    }
    return NPCManager.instance;
  }

  static resetInstance(): void {
    NPCManager.instance = null;
  }

  // ===== PUBLIC API =====

  /**
   * Get NPCs for a player. Generates them on first access.
   * If the player's level has changed, regenerates the NPCs.
   */
  getNpcsForPlayer(userId: number, playerLevel: number): NpcShip[] {
    let state = this.playerStates.get(userId);

    if (!state) {
      state = this.generateNpcsForPlayer(userId, playerLevel);
      this.playerStates.set(userId, state);
    } else if (state.lastGeneratedAtLevel !== playerLevel) {
      // Level changed — regenerate NPCs
      const existingNpcUserIds = state.npcUserIds;
      state = this.generateNpcsForPlayer(userId, playerLevel);
      state.npcUserIds = existingNpcUserIds; // Preserve NPC user mappings
      this.playerStates.set(userId, state);
    }

    return state.npcs;
  }

  /**
   * Update NPC positions based on elapsed time.
   * Also handles midnight respawn check.
   */
  updateNpcPositions(userId: number, nowMs: number): void {
    const state = this.playerStates.get(userId);
    if (!state) return;

    const deltaMs = nowMs - state.lastUpdateMs;
    if (deltaMs <= 0) return;

    const deltaSec = deltaMs / 1000;
    const todayMidnight = getTodayMidnightMs();

    for (const npc of state.npcs) {
      // Midnight respawn check
      if (npc.defeated && npc.defeatTime !== null && npc.defeatTime < todayMidnight) {
        npc.defeated = false;
        npc.defeatTime = null;
        npc.inBattle = false;
        // Reset position to starting angle
        npc.orbitAngleDeg = NPC_START_ANGLES[npc.index];
      }

      // Skip position update if defeated or in battle
      if (npc.defeated || npc.inBattle) continue;

      // Advance orbit angle (clockwise = decreasing angle)
      npc.orbitAngleDeg -= npc.angularVelocityDegPerSec * deltaSec;

      // Normalize angle to [0, 360)
      npc.orbitAngleDeg = ((npc.orbitAngleDeg % 360) + 360) % 360;
    }

    state.lastUpdateMs = nowMs;
  }

  /**
   * Convert NPCs to SpaceObject format for the world API response.
   * Only returns non-defeated NPCs.
   */
  getNpcSpaceObjects(userId: number, playerLevel: number, nowMs: number): SpaceObject[] {
    // Ensure NPCs exist and positions are updated
    this.getNpcsForPlayer(userId, playerLevel);
    this.updateNpcPositions(userId, nowMs);

    const state = this.playerStates.get(userId);
    if (!state) return [];

    return state.npcs
      .filter(npc => !npc.defeated)
      .map(npc => this.npcToSpaceObject(npc));
  }

  /**
   * Mark an NPC as defeated
   */
  markDefeated(npcId: number): void {
    for (const state of this.playerStates.values()) {
      const npc = state.npcs.find(n => n.id === npcId);
      if (npc) {
        npc.defeated = true;
        npc.defeatTime = Date.now();
        npc.inBattle = false;
        return;
      }
    }
  }

  /**
   * Set an NPC's battle state
   */
  setNpcInBattle(npcId: number, inBattle: boolean): void {
    for (const state of this.playerStates.values()) {
      const npc = state.npcs.find(n => n.id === npcId);
      if (npc) {
        npc.inBattle = inBattle;
        return;
      }
    }
  }

  /**
   * Get NPC by ID (searches all players)
   */
  getNpcById(npcId: number): NpcShip | null {
    for (const state of this.playerStates.values()) {
      const npc = state.npcs.find(n => n.id === npcId);
      if (npc) return npc;
    }
    return null;
  }

  /**
   * Get the NPC user ID mapping for an NPC
   */
  getNpcUserId(npcId: number): number | null {
    for (const state of this.playerStates.values()) {
      if (state.npcUserIds.has(npcId)) {
        return state.npcUserIds.get(npcId)!;
      }
    }
    return null;
  }

  /**
   * Set the NPC user ID mapping
   */
  setNpcUserId(npcId: number, userId: number): void {
    for (const state of this.playerStates.values()) {
      const npc = state.npcs.find(n => n.id === npcId);
      if (npc) {
        state.npcUserIds.set(npcId, userId);
        return;
      }
    }
  }

  /**
   * Find NPC by its associated database user ID
   * Returns the NPC ship if found, null otherwise
   */
  getNpcByUserId(userId: number): NpcShip | null {
    for (const state of this.playerStates.values()) {
      for (const [npcId, npcUserId] of state.npcUserIds.entries()) {
        if (npcUserId === userId) {
          return state.npcs.find(n => n.id === npcId) ?? null;
        }
      }
    }
    return null;
  }

  /**
   * Get player state (for testing)
   */
  getPlayerState(userId: number): PlayerNpcState | undefined {
    return this.playerStates.get(userId);
  }

  // ===== PRIVATE HELPERS =====

  private generateNpcsForPlayer(userId: number, playerLevel: number): PlayerNpcState {
    const npcs: NpcShip[] = [];

    for (let i = 0; i < NPCS_PER_PLAYER; i++) {
      npcs.push({
        id: calculateNpcId(userId, i),
        ownerId: userId,
        level: playerLevel + i,
        orbitAngleDeg: NPC_START_ANGLES[i],
        angularVelocityDegPerSec: NPC_ANGULAR_VELOCITY_DEG_PER_SEC,
        defeated: false,
        defeatTime: null,
        inBattle: false,
        index: i,
      });
    }

    return {
      npcs,
      lastGeneratedAtLevel: playerLevel,
      lastUpdateMs: Date.now(),
      npcUserIds: new Map(),
    };
  }

  private npcToSpaceObject(npc: NpcShip): SpaceObject {
    const pos = calculateNpcPosition(npc.orbitAngleDeg);
    const facingAngle = calculateNpcFacingAngle(npc.orbitAngleDeg);

    return {
      id: npc.id,
      type: 'npc_ship',
      x: pos.x,
      y: pos.y,
      speed: 0, // NPCs don't use linear speed; they orbit
      angle: facingAngle,
      last_position_update_ms: Date.now(),
      picture_id: 1,
      username: `NPC L${npc.level}`,
      level: npc.level,
      // Extra fields for client-side interpolation
      orbitAngleDeg: npc.orbitAngleDeg,
      angularVelocityDegPerSec: npc.angularVelocityDegPerSec,
    } as SpaceObject;
  }
}
