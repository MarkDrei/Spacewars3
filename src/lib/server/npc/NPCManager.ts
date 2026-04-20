/**
 * NPCManager — in-memory singleton managing per-player NPC ships.
 *
 * Uses the globalThis singleton pattern (consistent with TimeMultiplierService,
 * WorldCache, UserCache, etc.). NPC orbit state is ephemeral; it is regenerated
 * on server restart or when the player's level changes.
 */

import type { NpcShip } from './npcTypes';
import {
  NPC_COUNT,
  ORBIT_RADIUS,
  STARBASE_X,
  STARBASE_Y,
  BASE_ANGULAR_VELOCITY_DEG_PER_SEC,
  NPC_START_ANGLES,
  parseNpcId,
  npcUserId,
} from './npcConstants';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';

/** Per-player NPC state stored inside the manager. */
interface PlayerNpcState {
  npcs: NpcShip[];
  lastGeneratedAtLevel: number;
}

// Global singleton storage
declare global {
  var npcManagerInstance: NPCManager | undefined;
}

export class NPCManager {
  private playerNpcs: Map<number, PlayerNpcState> = new Map();

  private constructor() {}

  // ------- singleton lifecycle -------

  static getInstance(): NPCManager {
    if (!globalThis.npcManagerInstance) {
      globalThis.npcManagerInstance = new NPCManager();
    }
    return globalThis.npcManagerInstance;
  }

  static resetInstance(): void {
    globalThis.npcManagerInstance = undefined;
  }

  // ------- public API -------

  /**
   * Return the active (non-defeated) NPCs for a player.
   * On first call for a player, or when their level changes, NPCs are (re-)generated.
   * Also performs lazy midnight-respawn checks.
   */
  getNpcsForPlayer(userId: number, playerLevel: number): NpcShip[] {
    let state = this.playerNpcs.get(userId);

    // Generate on first access or when level has changed
    if (!state || state.lastGeneratedAtLevel !== playerLevel) {
      state = this.generateNpcs(userId, playerLevel);
      this.playerNpcs.set(userId, state);
    }

    // Lazy midnight respawn check
    this.checkMidnightRespawn(state);

    return state.npcs.filter((npc) => !npc.defeated);
  }

  /**
   * Advance orbit angles for the given player's NPCs.
   * Defeated or in-battle NPCs are skipped.
   */
  updateNpcPositions(userId: number, nowMs: number): void {
    const state = this.playerNpcs.get(userId);
    if (!state) return;

    const multiplier = TimeMultiplierService.getInstance().getMultiplier();

    for (const npc of state.npcs) {
      if (npc.defeated || npc.inBattle) continue;

      const elapsedMs = nowMs - npc.lastUpdateMs;
      if (elapsedMs <= 0) continue;

      const elapsedSec = elapsedMs / 1000;
      const deltaAngle =
        BASE_ANGULAR_VELOCITY_DEG_PER_SEC * elapsedSec * multiplier;
      npc.orbitAngleDeg = (npc.orbitAngleDeg + deltaAngle) % 360;
      npc.lastUpdateMs = nowMs;
    }
  }

  /** Mark an NPC as defeated by its user ID. */
  markDefeated(npcId: number): void {
    const npc = this.getNpcById(npcId);
    if (npc) {
      npc.defeated = true;
      npc.defeatTime = Date.now();
    }
  }

  /** Set (or clear) the in-battle flag for an NPC. */
  setInBattle(npcId: number, value: boolean): void {
    const npc = this.getNpcById(npcId);
    if (npc) {
      npc.inBattle = value;
    }
  }

  /** Look up an NPC by its user ID across all players. */
  getNpcById(npcId: number): NpcShip | null {
    const parsed = parseNpcId(npcId);
    if (!parsed) return null;

    const state = this.playerNpcs.get(parsed.ownerId);
    if (!state) return null;

    return state.npcs.find((n) => n.id === npcId) ?? null;
  }

  // ------- helpers -------

  /**
   * Compute the world-space position for a given orbit angle.
   */
  static positionForAngle(angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: STARBASE_X + ORBIT_RADIUS * Math.cos(rad),
      y: STARBASE_Y + ORBIT_RADIUS * Math.sin(rad),
    };
  }

  // ------- private -------

  private generateNpcs(userId: number, playerLevel: number): PlayerNpcState {
    const nowMs = Date.now();
    const npcs: NpcShip[] = [];

    for (let i = 0; i < NPC_COUNT; i++) {
      npcs.push({
        id: npcUserId(userId, i),
        ownerId: userId,
        npcIndex: i,
        level: playerLevel + i,
        orbitAngleDeg: NPC_START_ANGLES[i],
        defeated: false,
        defeatTime: null,
        npcUserCreated: false,
        inBattle: false,
        lastUpdateMs: nowMs,
      });
    }

    return { npcs, lastGeneratedAtLevel: playerLevel };
  }

  /**
   * If a defeated NPC's defeatTime is before today's midnight UTC,
   * reset it so it reappears in the world.
   */
  private checkMidnightRespawn(state: PlayerNpcState): void {
    const todayMidnightUtc = getMidnightUtcMs();

    for (const npc of state.npcs) {
      if (!npc.defeated || npc.defeatTime === null) continue;

      if (npc.defeatTime < todayMidnightUtc) {
        npc.defeated = false;
        npc.defeatTime = null;
        npc.npcUserCreated = false;
        npc.inBattle = false;
        // Re-place on starting orbit position
        npc.orbitAngleDeg = NPC_START_ANGLES[npc.npcIndex];
        npc.lastUpdateMs = Date.now();
      }
    }
  }
}

/**
 * Return the epoch-millisecond timestamp for the start of today (00:00:00 UTC).
 */
function getMidnightUtcMs(): number {
  const now = new Date(Date.now());
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
