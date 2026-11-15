// ---
// Types of the mission ("quest") system. Definitions are data; the rules live in questEngine.ts.
// ---

import type { LocationId } from './locations';
import type { ContactId, HostileArchetypeId } from './npcArchetypes';

export type CollectibleType = 'asteroid' | 'shipwreck' | 'escape_pod';

/** 'any' matches every hostile NPC ship. */
export type DefeatTarget = HostileArchetypeId | 'any';

export type QuestObjective =
  /** Collect space objects of a type. */
  | { type: 'collect'; objectType: CollectibleType; count: number }
  /** Win battles against hostile NPC ships. */
  | { type: 'defeat'; target: DefeatTarget; count: number }
  /** Fly to a location (after the stage has started). */
  | { type: 'visit'; locationId: LocationId }
  /** Have cargo items in the inventory; they are handed over when the stage is reported. */
  | { type: 'gather'; cargoId: string; count: number };

export interface CargoStack {
  cargoId: string;
  quantity: number;
}

export interface QuestStage {
  /** All objectives must be fulfilled. Empty = the stage only consists of reporting to a contact. */
  objectives: readonly QuestObjective[];
  /**
   * Contact the player has to hail to finish the stage. Without it the stage finishes
   * as soon as all objectives are fulfilled.
   */
  reportTo?: ContactId;
  /** Cargo handed to the player when the stage starts. */
  grants?: readonly CargoStack[];
}

export interface QuestRewards {
  xp: number;
  iron: number;
  /** A random commander is added to the inventory; reporting needs a free inventory slot. */
  commander?: boolean;
}

export interface QuestDefinition {
  id: string;
  /** Contact who offers the quest; the player must be in hail range to accept it. */
  giver: ContactId;
  /** Story chapter (1–4); side quests and contracts have none. */
  chapter?: number;
  /** Repeatable quests ("contracts") can be accepted again after completion. */
  repeatable?: boolean;
  prerequisites: {
    /** Quests that must be completed first. */
    quests: readonly string[];
    minLevel?: number;
  };
  stages: readonly QuestStage[];
  rewards: QuestRewards;
}

export type CargoSource =
  /** Only handed out by a quest stage (`grants`). */
  | { type: 'granted' }
  /** Found when collecting a space object of the type. */
  | { type: 'collect'; objectType: CollectibleType; chance: number }
  /** Dropped by a defeated hostile NPC ship. */
  | { type: 'defeat'; target: DefeatTarget; chance: number };

export interface CargoDefinition {
  id: string;
  /** Each cargo type belongs to exactly one quest. */
  questId: string;
  source: CargoSource;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export type CounterId =
  | 'asteroidsCollected'
  | 'shipwrecksCollected'
  | 'escapePodsCollected'
  | 'npcsDefeated'
  | 'aggressorsDefeated'
  | 'warlordsDefeated'
  | 'pvpWins'
  | 'questsCompleted'
  | 'contractsCompleted'
  | 'chaptersCompleted'
  | 'locationsDiscovered';

export interface AchievementTier {
  /** Counter value that unlocks the tier. */
  threshold: number;
  xp: number;
}

export interface AchievementDefinition {
  id: string;
  counter: CounterId;
  tiers: readonly AchievementTier[];
}

// ---------------------------------------------------------------------------
// Player state (persisted as JSON)
// ---------------------------------------------------------------------------

export interface QuestProgress {
  status: 'active' | 'completed';
  /** Index of the current stage (active quests). */
  stage: number;
  /** Progress per objective of the current stage; gather objectives are read from the inventory. */
  progress: number[];
  acceptedAt: number;
  completedAt: number | null;
  /** How often the quest has been completed (> 1 only for repeatable quests). */
  completions: number;
}

export interface PlayerQuestState {
  quests: Record<string, QuestProgress>;
  counters: Partial<Record<CounterId, number>>;
  /** Achievement id → number of unlocked tiers. */
  achievements: Record<string, number>;
  discovered: LocationId[];
  /** Incremented with every change; lets clients notice that they have to reload. */
  revision: number;
}

/** Quest cargo in the player's inventory, as far as the rules need to know it. */
export interface CargoHold {
  counts: Record<string, number>;
  /** Empty inventory slots; a new cargo type needs one, existing stacks grow in place. */
  freeSlots: number;
}

export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

// ---------------------------------------------------------------------------
// Events and results
// ---------------------------------------------------------------------------

export type QuestEvent =
  | { type: 'object_collected'; objectType: CollectibleType }
  | { type: 'npc_defeated'; archetype: HostileArchetypeId }
  | { type: 'pvp_won' }
  | { type: 'location_visited'; locationId: LocationId };

export type QuestNotification =
  | { kind: 'questAccepted'; questId: string }
  | { kind: 'questAbandoned'; questId: string }
  | { kind: 'readyToReport'; questId: string; contactId: ContactId }
  /** `stage` is the index of the stage that starts now (as in `QuestProgress.stage`). */
  | { kind: 'stageAdvanced'; questId: string; stage: number }
  | { kind: 'questCompleted'; questId: string; xp: number; iron: number; commander: boolean }
  | { kind: 'cargoFound'; cargoId: string; current: number; required: number }
  | { kind: 'cargoHoldFull'; cargoId: string }
  | { kind: 'locationDiscovered'; locationId: LocationId; xp: number }
  | { kind: 'achievementUnlocked'; achievementId: string; tier: number; xp: number };

export interface QuestEffects {
  xp: number;
  iron: number;
  /** Number of random commanders to add to the inventory. */
  commanders: number;
  cargoAdd: CargoStack[];
  cargoRemove: CargoStack[];
  notifications: QuestNotification[];
}

export interface QuestEngineResult {
  state: PlayerQuestState;
  effects: QuestEffects;
  /** False when the event or action did not change the state. */
  changed: boolean;
}

// ---------------------------------------------------------------------------
// API (GET / POST /api/quests)
// ---------------------------------------------------------------------------

/** What the mission page needs to know about a player. */
export interface QuestOverview {
  state: PlayerQuestState;
  level: number;
  cargo: CargoHold;
  contactsInRange: ContactId[];
}

export interface QuestActionResult {
  /** What happened, in order; the client shows it and the player gets it as messages. */
  notifications: QuestNotification[];
  revision: number;
}

export type QuestRuleErrorCode =
  | 'unknownQuest'
  | 'notAvailable'
  | 'alreadyActive'
  | 'notActive'
  | 'contactOutOfRange'
  | 'wrongContact'
  | 'objectivesIncomplete'
  | 'cargoHoldFull';

/** A quest action that the rules do not allow. */
export class QuestRuleError extends Error {
  constructor(public readonly code: QuestRuleErrorCode) {
    super(`Quest rule violated: ${code}`);
    this.name = 'QuestRuleError';
  }
}
