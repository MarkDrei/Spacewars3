// ---
// Rules of the mission system as pure functions: (state, action/event, context) → new state + effects.
// No I/O: the server applies the effects (XP, iron, cargo, notifications), see QuestService.
// ---

import { LOCATIONS, LOCATION_DISCOVERY_XP, type LocationId } from './locations';
import { HOSTILE_ARCHETYPES, type ContactId, type HostileArchetypeId } from './npcArchetypes';
import { ACHIEVEMENTS, CARGO, QUESTS, STORY_CHAPTERS, getCargo, getQuest } from './questDefinitions';
import {
  QuestRuleError,
  type CargoHold,
  type CounterId,
  type DefeatTarget,
  type PlayerQuestState,
  type QuestDefinition,
  type QuestEffects,
  type QuestEngineResult,
  type QuestEvent,
  type QuestObjective,
  type QuestProgress,
  type QuestStage,
  type QuestStatus,
} from './questTypes';

export interface QuestContext {
  now: number;
  /** Player level, for quests with a minimum level. */
  level: number;
  /** Quest cargo and free slots of the player's inventory. */
  cargo: CargoHold;
  /** Contacts within hail range of the player's ship. */
  contactsInRange: readonly ContactId[];
  /** Random number in [0, 1), decides cargo drops. */
  rng: () => number;
}

export function createInitialQuestState(): PlayerQuestState {
  return { quests: {}, counters: {}, achievements: {}, discovered: [], revision: 0 };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function isCompletedOnce(state: PlayerQuestState, questId: string): boolean {
  return (state.quests[questId]?.completions ?? 0) > 0;
}

export interface MissingPrerequisites {
  /** Quests that have to be completed first. */
  quests: string[];
  /** Required level, or null when the player's level is sufficient. */
  minLevel: number | null;
}

export function getMissingPrerequisites(
  state: PlayerQuestState,
  quest: QuestDefinition,
  level: number
): MissingPrerequisites {
  const minLevel = quest.prerequisites.minLevel;
  return {
    quests: quest.prerequisites.quests.filter((questId) => !isCompletedOnce(state, questId)),
    minLevel: minLevel !== undefined && level < minLevel ? minLevel : null,
  };
}

export function getQuestStatus(state: PlayerQuestState, quest: QuestDefinition, level: number): QuestStatus {
  const progress = state.quests[quest.id];
  if (progress?.status === 'active') return 'active';
  if (progress?.status === 'completed' && !quest.repeatable) return 'completed';
  const missing = getMissingPrerequisites(state, quest, level);
  return missing.quests.length === 0 && missing.minLevel === null ? 'available' : 'locked';
}

/** Amount an objective asks for (1 for visiting a location). */
export function objectiveTarget(objective: QuestObjective): number {
  return objective.type === 'visit' ? 1 : objective.count;
}

/** Current stage of an active quest, or null. */
export function getActiveStage(state: PlayerQuestState, quest: QuestDefinition): QuestStage | null {
  const progress = state.quests[quest.id];
  if (progress?.status !== 'active') return null;
  return quest.stages[progress.stage] ?? null;
}

/** Progress per objective of the current stage (capped at the objective's target). */
export function getObjectiveProgress(state: PlayerQuestState, quest: QuestDefinition, cargo: CargoHold): number[] {
  const stage = getActiveStage(state, quest);
  if (!stage) return [];
  const progress = state.quests[quest.id].progress;
  return stage.objectives.map((objective, index) => {
    const current = objective.type === 'gather' ? (cargo.counts[objective.cargoId] ?? 0) : (progress[index] ?? 0);
    return Math.min(current, objectiveTarget(objective));
  });
}

export function isStageComplete(state: PlayerQuestState, quest: QuestDefinition, cargo: CargoHold): boolean {
  const stage = getActiveStage(state, quest);
  if (!stage) return false;
  const progress = getObjectiveProgress(state, quest, cargo);
  return stage.objectives.every((objective, index) => progress[index] >= objectiveTarget(objective));
}

/** Locations whose visit changes the state: undiscovered ones and open visit objectives. */
export function getVisitCandidates(state: PlayerQuestState): LocationId[] {
  const candidates = new Set<LocationId>(
    LOCATIONS.map((location) => location.id).filter((id) => !state.discovered.includes(id))
  );
  for (const quest of QUESTS) {
    const stage = getActiveStage(state, quest);
    if (!stage) continue;
    const progress = state.quests[quest.id].progress;
    stage.objectives.forEach((objective, index) => {
      if (objective.type === 'visit' && (progress[index] ?? 0) < 1) candidates.add(objective.locationId);
    });
  }
  return [...candidates];
}

function matchesDefeatTarget(target: DefeatTarget, archetype: HostileArchetypeId): boolean {
  return target === 'any' || target === archetype;
}

/**
 * Hostile archetypes that the current stage of an active quest names explicitly (as target to
 * defeat or as source of cargo to gather). Quest-bound ships exist only while they are wanted,
 * and aggressive ships attack only while they are wanted.
 */
export function getWantedArchetypes(state: PlayerQuestState): HostileArchetypeId[] {
  const wanted = new Set<HostileArchetypeId>();
  for (const quest of QUESTS) {
    const stage = getActiveStage(state, quest);
    if (!stage) continue;
    for (const objective of stage.objectives) {
      if (objective.type === 'defeat' && objective.target !== 'any') {
        wanted.add(objective.target);
      } else if (objective.type === 'gather') {
        const source = getCargo(objective.cargoId)?.source;
        if (source?.type === 'defeat' && source.target !== 'any') wanted.add(source.target);
      }
    }
  }
  return [...wanted];
}

// ---------------------------------------------------------------------------
// Working copy: the engine mutates clones of state and cargo hold, never its inputs
// ---------------------------------------------------------------------------

interface Working {
  state: PlayerQuestState;
  cargo: CargoHold;
  effects: QuestEffects;
  ctx: QuestContext;
  changed: boolean;
}

function begin(state: PlayerQuestState, ctx: QuestContext): Working {
  return {
    state: structuredClone(state),
    cargo: { counts: { ...ctx.cargo.counts }, freeSlots: ctx.cargo.freeSlots },
    effects: { xp: 0, iron: 0, commanders: 0, cargoAdd: [], cargoRemove: [], notifications: [] },
    ctx,
    changed: false,
  };
}

function finish(w: Working): QuestEngineResult {
  unlockAchievements(w);
  if (w.changed) w.state.revision += 1;
  return { state: w.state, effects: w.effects, changed: w.changed };
}

function pushStack(stacks: { cargoId: string; quantity: number }[], cargoId: string, quantity: number): void {
  const existing = stacks.find((stack) => stack.cargoId === cargoId);
  if (existing) existing.quantity += quantity;
  else stacks.push({ cargoId, quantity });
}

/** Adds cargo to the hold. Returns false when a new stack is needed but no slot is free. */
function addCargo(w: Working, cargoId: string, quantity: number): boolean {
  const current = w.cargo.counts[cargoId] ?? 0;
  if (current === 0) {
    if (w.cargo.freeSlots < 1) return false;
    w.cargo.freeSlots -= 1;
  }
  w.cargo.counts[cargoId] = current + quantity;
  pushStack(w.effects.cargoAdd, cargoId, quantity);
  w.changed = true;
  return true;
}

function removeCargo(w: Working, cargoId: string, quantity: number): void {
  const current = w.cargo.counts[cargoId] ?? 0;
  const removed = Math.min(current, quantity);
  if (removed === 0) return;
  if (current === removed) {
    delete w.cargo.counts[cargoId];
    w.cargo.freeSlots += 1;
  } else {
    w.cargo.counts[cargoId] = current - removed;
  }
  pushStack(w.effects.cargoRemove, cargoId, removed);
  w.changed = true;
}

function incrementCounter(w: Working, counter: CounterId, amount = 1): void {
  w.state.counters[counter] = (w.state.counters[counter] ?? 0) + amount;
  w.changed = true;
}

function countCompletedChapters(state: PlayerQuestState): number {
  return STORY_CHAPTERS.filter((chapter) =>
    QUESTS.filter((quest) => quest.chapter === chapter).every((quest) => isCompletedOnce(state, quest.id))
  ).length;
}

function unlockAchievements(w: Working): void {
  for (const achievement of ACHIEVEMENTS) {
    const value = w.state.counters[achievement.counter] ?? 0;
    const unlockedBefore = w.state.achievements[achievement.id] ?? 0;
    const unlockedNow = achievement.tiers.filter((tier) => value >= tier.threshold).length;
    for (let tier = unlockedBefore; tier < unlockedNow; tier++) {
      const xp = achievement.tiers[tier].xp;
      w.effects.xp += xp;
      w.effects.notifications.push({ kind: 'achievementUnlocked', achievementId: achievement.id, tier: tier + 1, xp });
    }
    if (unlockedNow > unlockedBefore) {
      w.state.achievements[achievement.id] = unlockedNow;
      w.changed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Stage transitions
// ---------------------------------------------------------------------------

/** Starts a stage: resets the objective progress and hands out the stage's cargo. */
function startStage(w: Working, quest: QuestDefinition, progress: QuestProgress, stageIndex: number): void {
  const stage = quest.stages[stageIndex];
  progress.stage = stageIndex;
  progress.progress = stage.objectives.map(() => 0);
  for (const grant of stage.grants ?? []) {
    if (!addCargo(w, grant.cargoId, grant.quantity)) throw new QuestRuleError('cargoHoldFull');
  }
  w.changed = true;
}

function completeQuest(w: Working, quest: QuestDefinition, progress: QuestProgress): void {
  if (quest.rewards.commander) {
    // The commander needs an inventory slot; the quest stays reportable until one is free
    if (w.cargo.freeSlots < 1) throw new QuestRuleError('cargoHoldFull');
    w.cargo.freeSlots -= 1;
    w.effects.commanders += 1;
  }
  progress.status = 'completed';
  progress.stage = 0;
  progress.progress = [];
  progress.completedAt = w.ctx.now;
  progress.completions += 1;

  w.effects.xp += quest.rewards.xp;
  w.effects.iron += quest.rewards.iron;
  w.effects.notifications.push({
    kind: 'questCompleted',
    questId: quest.id,
    xp: quest.rewards.xp,
    iron: quest.rewards.iron,
    commander: quest.rewards.commander === true,
  });

  if (progress.completions === 1) incrementCounter(w, 'questsCompleted');
  if (quest.repeatable) incrementCounter(w, 'contractsCompleted');
  w.state.counters.chaptersCompleted = countCompletedChapters(w.state);
  w.changed = true;
}

/** Hands over the stage's gathered cargo and moves on to the next stage or completes the quest. */
function finishStage(w: Working, quest: QuestDefinition, progress: QuestProgress): void {
  const stage = quest.stages[progress.stage];
  for (const objective of stage.objectives) {
    if (objective.type === 'gather') removeCargo(w, objective.cargoId, objective.count);
  }
  const nextStage = progress.stage + 1;
  if (nextStage >= quest.stages.length) {
    completeQuest(w, quest, progress);
    return;
  }
  startStage(w, quest, progress, nextStage);
  w.effects.notifications.push({ kind: 'stageAdvanced', questId: quest.id, stage: nextStage });
}

function isComplete(w: Working, quest: QuestDefinition): boolean {
  return isStageComplete(w.state, quest, w.cargo);
}

/**
 * Finishes stages that need no report as soon as their objectives are fulfilled.
 * `completeBefore` tells whether the stage was already complete before the current event, so the
 * "report to …" notification is sent once.
 */
function settleQuest(w: Working, quest: QuestDefinition, completeBefore: boolean): void {
  const progress = w.state.quests[quest.id];
  let wasComplete = completeBefore;
  while (progress.status === 'active' && isComplete(w, quest)) {
    const stage = quest.stages[progress.stage];
    if (stage.reportTo) {
      if (!wasComplete) {
        w.effects.notifications.push({ kind: 'readyToReport', questId: quest.id, contactId: stage.reportTo });
      }
      return;
    }
    finishStage(w, quest, progress);
    wasComplete = false;
  }
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

function requireQuest(questId: string): QuestDefinition {
  const quest = getQuest(questId);
  if (!quest) throw new QuestRuleError('unknownQuest');
  return quest;
}

/** Accepts a quest from its giver. Throws QuestRuleError when the rules do not allow it. */
export function acceptQuest(state: PlayerQuestState, questId: string, ctx: QuestContext): QuestEngineResult {
  const quest = requireQuest(questId);
  const status = getQuestStatus(state, quest, ctx.level);
  if (status === 'active') throw new QuestRuleError('alreadyActive');
  if (status !== 'available') throw new QuestRuleError('notAvailable');
  if (!ctx.contactsInRange.includes(quest.giver)) throw new QuestRuleError('contactOutOfRange');

  const w = begin(state, ctx);
  const progress: QuestProgress = {
    status: 'active',
    stage: 0,
    progress: [],
    acceptedAt: ctx.now,
    completedAt: null,
    completions: state.quests[questId]?.completions ?? 0,
  };
  w.state.quests[questId] = progress;
  startStage(w, quest, progress, 0);
  w.effects.notifications.push({ kind: 'questAccepted', questId });
  settleQuest(w, quest, true);
  return finish(w);
}

/** Reports the current stage to a contact: hands over gathered cargo and advances the quest. */
export function reportQuest(
  state: PlayerQuestState,
  questId: string,
  contactId: ContactId,
  ctx: QuestContext
): QuestEngineResult {
  const quest = requireQuest(questId);
  const stage = getActiveStage(state, quest);
  if (!stage) throw new QuestRuleError('notActive');
  if (stage.reportTo !== contactId) throw new QuestRuleError('wrongContact');
  if (!ctx.contactsInRange.includes(contactId)) throw new QuestRuleError('contactOutOfRange');
  if (!isStageComplete(state, quest, ctx.cargo)) throw new QuestRuleError('objectivesIncomplete');

  const w = begin(state, ctx);
  finishStage(w, quest, w.state.quests[questId]);
  settleQuest(w, quest, false);
  return finish(w);
}

/** Gives up an active quest; its cargo is removed and its progress is lost. */
export function abandonQuest(state: PlayerQuestState, questId: string, ctx: QuestContext): QuestEngineResult {
  const quest = requireQuest(questId);
  if (!getActiveStage(state, quest)) throw new QuestRuleError('notActive');

  const w = begin(state, ctx);
  for (const cargo of CARGO) {
    if (cargo.questId === questId) removeCargo(w, cargo.id, w.cargo.counts[cargo.id] ?? 0);
  }
  const progress = w.state.quests[questId];
  if (progress.completions > 0) {
    // A repeated contract falls back to "completed"
    progress.status = 'completed';
    progress.stage = 0;
    progress.progress = [];
  } else {
    delete w.state.quests[questId];
  }
  w.changed = true;
  w.effects.notifications.push({ kind: 'questAbandoned', questId });
  return finish(w);
}

// ---------------------------------------------------------------------------
// Game events
// ---------------------------------------------------------------------------

const COLLECT_COUNTERS: Record<string, CounterId> = {
  asteroid: 'asteroidsCollected',
  shipwreck: 'shipwrecksCollected',
  escape_pod: 'escapePodsCollected',
};

function countEvent(w: Working, event: QuestEvent): void {
  switch (event.type) {
    case 'object_collected':
      incrementCounter(w, COLLECT_COUNTERS[event.objectType]);
      break;
    case 'npc_defeated':
      incrementCounter(w, 'npcsDefeated');
      if (HOSTILE_ARCHETYPES[event.archetype].aggressive) incrementCounter(w, 'aggressorsDefeated');
      if (event.archetype === 'warlord') incrementCounter(w, 'warlordsDefeated');
      break;
    case 'pvp_won':
      incrementCounter(w, 'pvpWins');
      break;
    case 'location_visited':
      if (!w.state.discovered.includes(event.locationId)) {
        w.state.discovered.push(event.locationId);
        incrementCounter(w, 'locationsDiscovered');
        w.effects.xp += LOCATION_DISCOVERY_XP;
        w.effects.notifications.push({
          kind: 'locationDiscovered',
          locationId: event.locationId,
          xp: LOCATION_DISCOVERY_XP,
        });
      }
      break;
  }
}

function objectiveMatchesEvent(objective: QuestObjective, event: QuestEvent): boolean {
  switch (objective.type) {
    case 'collect':
      return event.type === 'object_collected' && event.objectType === objective.objectType;
    case 'defeat':
      return event.type === 'npc_defeated' && matchesDefeatTarget(objective.target, event.archetype);
    case 'visit':
      return event.type === 'location_visited' && event.locationId === objective.locationId;
    case 'gather':
      return false;
  }
}

/** Cargo found by the event: only while the current stage of the cargo's quest still needs it. */
function dropCargo(w: Working, event: QuestEvent): void {
  for (const cargo of CARGO) {
    const source = cargo.source;
    if (source.type === 'granted') continue;
    const matches =
      (source.type === 'collect' && event.type === 'object_collected' && event.objectType === source.objectType) ||
      (source.type === 'defeat' && event.type === 'npc_defeated' && matchesDefeatTarget(source.target, event.archetype));
    if (!matches) continue;

    const quest = getQuest(cargo.questId);
    const stage = quest ? getActiveStage(w.state, quest) : null;
    const objective = stage?.objectives.find((o) => o.type === 'gather' && o.cargoId === cargo.id);
    if (!objective || objective.type !== 'gather') continue;

    const current = w.cargo.counts[cargo.id] ?? 0;
    if (current >= objective.count || w.ctx.rng() >= source.chance) continue;

    if (addCargo(w, cargo.id, 1)) {
      w.effects.notifications.push({ kind: 'cargoFound', cargoId: cargo.id, current: current + 1, required: objective.count });
    } else {
      w.effects.notifications.push({ kind: 'cargoHoldFull', cargoId: cargo.id });
    }
  }
}

/** Applies a game event: counters, discoveries, objective progress, cargo drops, achievements. */
export function applyQuestEvent(state: PlayerQuestState, event: QuestEvent, ctx: QuestContext): QuestEngineResult {
  const w = begin(state, ctx);
  const activeQuests = QUESTS.filter((quest) => w.state.quests[quest.id]?.status === 'active');
  const completeBefore = new Map(activeQuests.map((quest) => [quest.id, isComplete(w, quest)]));

  countEvent(w, event);

  for (const quest of activeQuests) {
    const progress = w.state.quests[quest.id];
    quest.stages[progress.stage].objectives.forEach((objective, index) => {
      const current = progress.progress[index] ?? 0;
      if (objectiveMatchesEvent(objective, event) && current < objectiveTarget(objective)) {
        progress.progress[index] = current + 1;
        w.changed = true;
      }
    });
  }

  dropCargo(w, event);

  for (const quest of activeQuests) {
    settleQuest(w, quest, completeBefore.get(quest.id) === true);
  }
  return finish(w);
}

// ---------------------------------------------------------------------------
// Test tools (admin only): shortcuts for testing quests without playing them
// ---------------------------------------------------------------------------

/**
 * Fulfils all objectives of the current stage: sets the counters to their target and adds the
 * cargo that is still missing. The stage must still be reported if it has a contact.
 */
export function debugFulfilStage(state: PlayerQuestState, questId: string, ctx: QuestContext): QuestEngineResult {
  const quest = requireQuest(questId);
  const stage = getActiveStage(state, quest);
  if (!stage) throw new QuestRuleError('notActive');

  const w = begin(state, ctx);
  const progress = w.state.quests[questId];
  stage.objectives.forEach((objective, index) => {
    if (objective.type === 'gather') {
      const missing = objective.count - (w.cargo.counts[objective.cargoId] ?? 0);
      if (missing > 0 && !addCargo(w, objective.cargoId, missing)) throw new QuestRuleError('cargoHoldFull');
    } else if ((progress.progress[index] ?? 0) < objectiveTarget(objective)) {
      progress.progress[index] = objectiveTarget(objective);
      w.changed = true;
    }
  });
  settleQuest(w, quest, false);
  return finish(w);
}

/** Marks all (transitive) prerequisites of a quest as completed, without rewards. */
export function debugUnlockPrerequisites(state: PlayerQuestState, questId: string, ctx: QuestContext): QuestEngineResult {
  const w = begin(state, ctx);
  const visit = (id: string): void => {
    for (const prerequisiteId of requireQuest(id).prerequisites.quests) {
      visit(prerequisiteId);
      const existing = w.state.quests[prerequisiteId];
      if (existing && existing.completions > 0) continue;
      if (existing?.status === 'active') {
        for (const cargo of CARGO) {
          if (cargo.questId === prerequisiteId) removeCargo(w, cargo.id, w.cargo.counts[cargo.id] ?? 0);
        }
      }
      w.state.quests[prerequisiteId] = {
        status: 'completed',
        stage: 0,
        progress: [],
        acceptedAt: existing?.acceptedAt ?? ctx.now,
        completedAt: ctx.now,
        completions: 1,
      };
      incrementCounter(w, 'questsCompleted');
    }
  };
  visit(questId);
  w.state.counters.chaptersCompleted = countCompletedChapters(w.state);
  return finish(w);
}
