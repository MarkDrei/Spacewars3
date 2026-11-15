// ---
// Read model of the mission system for the UI and the quest document: what a player sees of
// each quest, derived from the definitions and the player's state. Pure functions.
// ---

import type { ContactId } from './npcArchetypes';
import { ACHIEVEMENTS, QUESTS } from './questDefinitions';
import {
  getMissingPrerequisites,
  getObjectiveProgress,
  getQuestStatus,
  isStageComplete,
  objectiveTarget,
  type MissingPrerequisites,
} from './questEngine';
import type {
  AchievementDefinition,
  CargoHold,
  PlayerQuestState,
  QuestDefinition,
  QuestObjective,
  QuestStatus,
} from './questTypes';

export interface ObjectiveView {
  objective: QuestObjective;
  current: number;
  target: number;
  done: boolean;
}

export interface QuestView {
  quest: QuestDefinition;
  status: QuestStatus;
  /** Index of the current stage (active quests), otherwise 0. */
  stage: number;
  /** Objectives of the current stage with progress (active quests only). */
  objectives: ObjectiveView[];
  /** Contact who finishes the current stage, if it needs a report. */
  reportTo: ContactId | null;
  /** Active, all objectives of the current stage fulfilled, waiting for the report. */
  readyToReport: boolean;
  /** What a locked quest still needs. */
  missing: MissingPrerequisites;
  completions: number;
}

export interface AchievementView {
  achievement: AchievementDefinition;
  /** Current value of the achievement's counter. */
  value: number;
  /** Number of unlocked tiers. */
  unlockedTiers: number;
  /** Threshold of the next tier, or null when all tiers are unlocked. */
  nextThreshold: number | null;
}

export function buildQuestView(
  state: PlayerQuestState,
  quest: QuestDefinition,
  level: number,
  cargo: CargoHold
): QuestView {
  const status = getQuestStatus(state, quest, level);
  const progress = state.quests[quest.id];
  const active = status === 'active';
  const stage = active ? progress.stage : 0;
  const current = active ? getObjectiveProgress(state, quest, cargo) : [];
  const objectives = active
    ? quest.stages[stage].objectives.map((objective, index) => {
        const target = objectiveTarget(objective);
        return { objective, current: current[index], target, done: current[index] >= target };
      })
    : [];
  return {
    quest,
    status,
    stage,
    objectives,
    reportTo: active ? (quest.stages[stage].reportTo ?? null) : null,
    readyToReport: active && isStageComplete(state, quest, cargo),
    missing: getMissingPrerequisites(state, quest, level),
    completions: progress?.completions ?? 0,
  };
}

export function buildQuestViews(state: PlayerQuestState, level: number, cargo: CargoHold): QuestView[] {
  return QUESTS.map((quest) => buildQuestView(state, quest, level, cargo));
}

export function buildAchievementViews(state: PlayerQuestState): AchievementView[] {
  return ACHIEVEMENTS.map((achievement) => {
    const unlockedTiers = state.achievements[achievement.id] ?? 0;
    return {
      achievement,
      value: state.counters[achievement.counter] ?? 0,
      unlockedTiers,
      nextThreshold: achievement.tiers[unlockedTiers]?.threshold ?? null,
    };
  });
}
