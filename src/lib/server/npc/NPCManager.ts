/**
 * NPCManager — in-memory singleton managing the hostile NPC ships of each player.
 *
 * Every player has their own set of hostile ships (see HOSTILE_ARCHETYPES): passive pirates
 * around Ironstrike Station, marauders and drones around their lairs that attack while a mission
 * of the player hunts them, and quest-bound ships that only appear while a mission asks for them.
 *
 * Uses the globalThis singleton pattern (consistent with TimeMultiplierService,
 * WorldCache, UserCache, etc.). NPC orbit state is ephemeral; it is regenerated
 * on server restart or when the player's level changes.
 */

import type { NpcShip } from './npcTypes';
import { NPC_MAX_LEVEL, parseNpcId, npcUserId } from './npcConstants';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import {
  HOSTILE_ARCHETYPES,
  HOSTILE_ARCHETYPE_IDS,
  hostileLevel,
  hostileOrbit,
  positionOnOrbit,
  type HostileArchetypeId,
} from '@/shared/quests/npcArchetypes';
import { calculateToroidalDistance } from '@shared/physics';
import { DEFAULT_WORLD_BOUNDS } from '@shared/worldConstants';

/** Per-player NPC state stored inside the manager. */
interface PlayerNpcState {
  npcs: NpcShip[];
  lastGeneratedAtLevel: number;
  /** Aggressive ships leave the player alone until this time (ms). */
  noAmbushBeforeMs: number;
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
   * Return the NPCs a player can currently see: not defeated, not in battle, and — for
   * quest-bound archetypes — wanted by an active mission.
   * On first call for a player, or when their level changes, NPCs are (re-)generated.
   * Also respawns defeated NPCs whose respawn time has come.
   */
  getNpcsForPlayer(
    userId: number,
    playerLevel: number,
    wantedArchetypes: readonly HostileArchetypeId[] = [],
  ): NpcShip[] {
    let state = this.playerNpcs.get(userId);

    // Generate on first access or when the level has changed. A running battle keeps its NPC:
    // regeneration waits until the battle is over.
    if (!state || (state.lastGeneratedAtLevel !== playerLevel && !state.npcs.some((npc) => npc.inBattle))) {
      state = {
        npcs: generateNpcs(userId, playerLevel),
        lastGeneratedAtLevel: playerLevel,
        noAmbushBeforeMs: state?.noAmbushBeforeMs ?? 0,
      };
      this.playerNpcs.set(userId, state);
    }

    respawnDefeated(state);

    return state.npcs.filter(
      (npc) => !npc.defeated && !npc.inBattle && NPCManager.isPresent(npc, wantedArchetypes),
    );
  }

  /** Quest-bound ships exist only while a mission of the player wants them. */
  static isPresent(npc: NpcShip, wantedArchetypes: readonly HostileArchetypeId[]): boolean {
    return !HOSTILE_ARCHETYPES[npc.archetype].questBound || wantedArchetypes.includes(npc.archetype);
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

      const deltaAngle = HOSTILE_ARCHETYPES[npc.archetype].angularVelocityDegPerSec * (elapsedMs / 1000) * multiplier;
      npc.orbitAngleDeg = (((npc.orbitAngleDeg + deltaAngle) % 360) + 360) % 360;
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

  /**
   * The aggressive NPC that attacks a player at the given position, or null.
   * `visibleNpcs` is the result of `getNpcsForPlayer` after `updateNpcPositions`.
   * `huntedArchetypes` are the ship kinds an active mission of the player targets
   * (`getWantedArchetypes`): only these attack. A ship moves on while its owner is offline, so
   * ships that attack everyone would put every returning player into a battle.
   * Returns the nearest hunted ship whose aggro radius the player is in, unless the player is in
   * the grace period after a battle.
   */
  findAmbusher(
    userId: number,
    playerPosition: { x: number; y: number },
    visibleNpcs: readonly NpcShip[],
    huntedArchetypes: readonly HostileArchetypeId[],
    nowMs: number,
  ): NpcShip | null {
    const state = this.playerNpcs.get(userId);
    if (!state || nowMs < state.noAmbushBeforeMs) return null;

    let nearest: NpcShip | null = null;
    let nearestDistance = Infinity;
    for (const npc of visibleNpcs) {
      const archetype = HOSTILE_ARCHETYPES[npc.archetype];
      if (!archetype.aggressive || !huntedArchetypes.includes(npc.archetype)) continue;
      const distance = calculateToroidalDistance(playerPosition, NPCManager.positionOf(npc), DEFAULT_WORLD_BOUNDS);
      if (distance <= archetype.aggroRadius && distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  /** Aggressive ships leave the player alone until `untilMs` (after a battle). */
  setAmbushGrace(userId: number, untilMs: number): void {
    const state = this.playerNpcs.get(userId);
    if (state) state.noAmbushBeforeMs = untilMs;
  }

  /**
   * Forget the NPCs of a player, so they are generated anew (all alive, at their start
   * positions) on the next access. Refused while one of them is in battle.
   */
  resetPlayer(userId: number): boolean {
    const state = this.playerNpcs.get(userId);
    if (state?.npcs.some((npc) => npc.inBattle)) return false;
    this.playerNpcs.delete(userId);
    return true;
  }

  // ------- helpers -------

  /** World-space position of an NPC on its orbit. */
  static positionOf(npc: Pick<NpcShip, 'archetype' | 'orbitAngleDeg'>): { x: number; y: number } {
    return positionOnOrbit(hostileOrbit(HOSTILE_ARCHETYPES[npc.archetype]), npc.orbitAngleDeg);
  }
}

function generateNpcs(userId: number, playerLevel: number): NpcShip[] {
  const nowMs = Date.now();
  const npcs: NpcShip[] = [];

  for (const archetypeId of HOSTILE_ARCHETYPE_IDS) {
    for (const spawn of HOSTILE_ARCHETYPES[archetypeId].spawns) {
      const level = Math.min(hostileLevel(playerLevel, spawn), NPC_MAX_LEVEL);
      const id = npcUserId(userId, level, spawn.slot);
      // Spawns of one slot collapse at the level cap; the ID must stay unique
      if (npcs.some((npc) => npc.id === id)) continue;
      npcs.push({
        id,
        ownerId: userId,
        archetype: archetypeId,
        spawn,
        level,
        orbitAngleDeg: spawn.startAngleDeg,
        defeated: false,
        defeatTime: null,
        npcUserCreated: false,
        inBattle: false,
        lastUpdateMs: nowMs,
      });
    }
  }

  return npcs;
}

/**
 * Bring back defeated NPCs: after the archetype's respawn time, or — for archetypes
 * without one — when the defeat happened before today's midnight (UTC).
 */
function respawnDefeated(state: PlayerNpcState): void {
  const nowMs = Date.now();
  const todayMidnightUtc = getMidnightUtcMs(nowMs);

  for (const npc of state.npcs) {
    if (!npc.defeated || npc.defeatTime === null) continue;

    const respawnMinutes = HOSTILE_ARCHETYPES[npc.archetype].respawnMinutes;
    const due =
      respawnMinutes === null
        ? npc.defeatTime < todayMidnightUtc
        : nowMs >= npc.defeatTime + respawnMinutes * 60_000;

    if (due) {
      npc.defeated = false;
      npc.defeatTime = null;
      npc.npcUserCreated = false;
      npc.inBattle = false;
      // Re-place on starting orbit position
      npc.orbitAngleDeg = npc.spawn.startAngleDeg;
      npc.lastUpdateMs = nowMs;
    }
  }
}

/**
 * Return the epoch-millisecond timestamp for the start of the day (00:00:00 UTC) of `nowMs`.
 */
function getMidnightUtcMs(nowMs: number): number {
  const now = new Date(nowMs);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
