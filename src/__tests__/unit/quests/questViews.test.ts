import { describe, it, expect } from 'vitest';
import { buildAchievementViews, buildQuestView, buildQuestViews } from '@/shared/quests/questViews';
import { ACHIEVEMENTS, QUESTS, getQuest } from '@/shared/quests/questDefinitions';
import { createInitialQuestState } from '@/shared/quests/questEngine';
import type { CargoHold, PlayerQuestState, QuestDefinition, QuestProgress } from '@/shared/quests/questTypes';

const NOW = 1_800_000_000_000;
const EMPTY_HOLD: CargoHold = { counts: {}, freeSlots: 16 };

function quest(id: string): QuestDefinition {
  const definition = getQuest(id);
  if (!definition) throw new Error(`Unknown quest ${id}`);
  return definition;
}

const active = (stage: number, progress: number[], completions = 0): QuestProgress => ({
  status: 'active', stage, progress, acceptedAt: NOW, completedAt: null, completions,
});

const completed = (completions = 1): QuestProgress => ({
  status: 'completed', stage: 0, progress: [], acceptedAt: NOW, completedAt: NOW, completions,
});

function stateWith(quests: Record<string, QuestProgress>): PlayerQuestState {
  return { ...createInitialQuestState(), quests };
}

describe('buildQuestView', () => {
  it('buildQuestView_questWithoutPrerequisites_isAvailableWithoutObjectives', () => {
    const view = buildQuestView(createInitialQuestState(), quest('c1_first_haul'), 1, EMPTY_HOLD);

    expect(view).toMatchObject({
      status: 'available', stage: 0, objectives: [], reportTo: null, readyToReport: false, completions: 0,
    });
    expect(view.missing).toEqual({ quests: [], minLevel: null });
  });

  it('buildQuestView_lockedQuest_listsMissingQuestsAndLevel', () => {
    const view = buildQuestView(createInitialQuestState(), quest('c3_thin_the_herd'), 1, EMPTY_HOLD);

    expect(view.status).toBe('locked');
    expect(view.missing).toEqual({ quests: ['c2_the_trail'], minLevel: 2 });
  });

  it('buildQuestView_activeQuestInProgress_showsObjectiveProgressAndContact', () => {
    const state = stateWith({ c1_first_haul: active(0, [2]) });

    const view = buildQuestView(state, quest('c1_first_haul'), 1, EMPTY_HOLD);

    expect(view.status).toBe('active');
    expect(view.objectives).toEqual([
      { objective: { type: 'collect', objectType: 'asteroid', count: 3 }, current: 2, target: 3, done: false },
    ]);
    expect(view.reportTo).toBe('vess');
    expect(view.readyToReport).toBe(false);
  });

  it('buildQuestView_activeQuestWithAllObjectivesDone_isReadyToReport', () => {
    const state = stateWith({ c1_first_haul: active(0, [3]) });

    const view = buildQuestView(state, quest('c1_first_haul'), 1, EMPTY_HOLD);

    expect(view.objectives[0].done).toBe(true);
    expect(view.readyToReport).toBe(true);
  });

  it('buildQuestView_gatherObjective_readsProgressFromTheCargoHold', () => {
    const state = stateWith({ c1_first_haul: completed(), c1_salvage_rights: active(0, [0]) });

    const view = buildQuestView(state, quest('c1_salvage_rights'), 1, { counts: { hull_plating: 1 }, freeSlots: 15 });

    expect(view.objectives[0]).toMatchObject({ current: 1, target: 2, done: false });
  });

  it('buildQuestView_laterStageOfAMultiStageQuest_showsThatStage', () => {
    const state = stateWith({ c2_charting_the_dark: completed(), c2_voices_of_the_dead: active(1, [0]) });

    const view = buildQuestView(state, quest('c2_voices_of_the_dead'), 1, { counts: { flight_recorder: 3 }, freeSlots: 15 });

    expect(view.stage).toBe(1);
    expect(view.objectives.map((o) => o.objective.type)).toEqual(['gather']);
    expect(view.reportTo).toBe('quill');
    expect(view.readyToReport).toBe(true);
  });

  it('buildQuestView_stageWithoutContact_hasNoReportTarget', () => {
    const state = stateWith({ c2_charting_the_dark: completed(), c2_voices_of_the_dead: active(0, [0]) });

    const view = buildQuestView(state, quest('c2_voices_of_the_dead'), 1, EMPTY_HOLD);

    expect(view.reportTo).toBeNull();
    expect(view.readyToReport).toBe(false);
  });

  it('buildQuestView_completedQuest_reportsCompletions', () => {
    const view = buildQuestView(stateWith({ c1_first_haul: completed() }), quest('c1_first_haul'), 1, EMPTY_HOLD);

    expect(view).toMatchObject({ status: 'completed', objectives: [], completions: 1 });
  });

  it('buildQuestView_completedContract_isAvailableAgainAndKeepsItsCompletions', () => {
    const state = stateWith({
      c1_first_haul: completed(),
      c1_salvage_rights: completed(),
      contract_scrap_run: completed(4),
    });

    const view = buildQuestView(state, quest('contract_scrap_run'), 1, EMPTY_HOLD);

    expect(view).toMatchObject({ status: 'available', completions: 4 });
  });
});

describe('buildQuestViews', () => {
  it('buildQuestViews_newPlayer_hasOneViewPerQuestInDefinitionOrder', () => {
    const views = buildQuestViews(createInitialQuestState(), 1, EMPTY_HOLD);

    expect(views.map((view) => view.quest.id)).toEqual(QUESTS.map((definition) => definition.id));
    expect(views.filter((view) => view.status === 'available').map((view) => view.quest.id)).toEqual([
      'c1_first_haul',
      'side_tams_ore',
    ]);
  });
});

describe('buildAchievementViews', () => {
  it('buildAchievementViews_newPlayer_showsFirstTierAsNextGoal', () => {
    const views = buildAchievementViews(createInitialQuestState());

    expect(views).toHaveLength(ACHIEVEMENTS.length);
    expect(views.find((view) => view.achievement.id === 'rock_breaker')).toMatchObject({
      value: 0, unlockedTiers: 0, nextThreshold: 10,
    });
  });

  it('buildAchievementViews_someTiersUnlocked_showsCounterAndNextThreshold', () => {
    const state: PlayerQuestState = {
      ...createInitialQuestState(),
      counters: { asteroidsCollected: 12 },
      achievements: { rock_breaker: 1 },
    };

    expect(buildAchievementViews(state).find((view) => view.achievement.id === 'rock_breaker')).toMatchObject({
      value: 12, unlockedTiers: 1, nextThreshold: 50,
    });
  });

  it('buildAchievementViews_allTiersUnlocked_hasNoNextThreshold', () => {
    const state: PlayerQuestState = {
      ...createInitialQuestState(),
      counters: { warlordsDefeated: 2 },
      achievements: { kingslayer: 1 },
    };

    expect(buildAchievementViews(state).find((view) => view.achievement.id === 'kingslayer')).toMatchObject({
      value: 2, unlockedTiers: 1, nextThreshold: null,
    });
  });
});
