import { beforeAll, describe, it, expect } from 'vitest';
import { getServerT } from '@/lib/server/i18n/serverTranslations';
import { cargoSourceText, objectiveText, type QuestTranslate } from '@/shared/quests/questTexts';
import { questNotificationText } from '@/shared/quests/questMessages';
import { CARGO, QUESTS } from '@/shared/quests/questDefinitions';
import type { QuestNotification } from '@/shared/quests/questTypes';

// The texts are checked against the real English catalogue: a renamed key shows up here
let t: QuestTranslate;
let tGerman: QuestTranslate;

beforeAll(async () => {
  t = await getServerT('en', 'quests');
  tGerman = await getServerT('de', 'quests');
});

describe('objectiveText', () => {
  it('objectiveText_collect_namesTheObjectType', () => {
    expect(objectiveText(t, { type: 'collect', objectType: 'escape_pod', count: 2 })).toBe('Recover escape pods');
  });

  it('objectiveText_defeatArchetype_namesTheShip', () => {
    expect(objectiveText(t, { type: 'defeat', target: 'warlord', count: 1 })).toBe('Defeat: Warlord Krag');
  });

  it('objectiveText_defeatAny_usesTheGenericText', () => {
    expect(objectiveText(t, { type: 'defeat', target: 'any', count: 3 })).toBe('Defeat hostile ships of any kind');
  });

  it('objectiveText_visit_includesNameAndCoordinatesOfTheLocation', () => {
    expect(objectiveText(t, { type: 'visit', locationId: 'azure_drift' })).toBe('Fly to Azure Drift (300, 2700)');
  });

  it('objectiveText_gather_namesTheCargo', () => {
    expect(objectiveText(t, { type: 'gather', cargoId: 'hull_plating', count: 2 })).toBe('Have aboard: Hull Plating');
  });

  it('objectiveText_germanLocale_isTranslated', () => {
    const english = objectiveText(t, { type: 'visit', locationId: 'azure_drift' });
    const german = objectiveText(tGerman, { type: 'visit', locationId: 'azure_drift' });

    expect(german).toContain('(300, 2700)');
    expect(german).not.toBe(english);
  });

  it('objectiveText_everyObjectiveOfEveryQuest_resolvesToText', () => {
    for (const quest of QUESTS) {
      for (const stage of quest.stages) {
        for (const objective of stage.objectives) {
          const text = objectiveText(t, objective);
          // Unresolved keys come back as the key itself, unresolved parameters keep their braces
          expect(text, `${quest.id}: ${JSON.stringify(objective)}`).not.toMatch(/^objectives\.|[{}]/);
        }
      }
    }
  });
});

describe('cargoSourceText', () => {
  it('cargoSourceText_granted_saysItIsHandedOver', () => {
    expect(cargoSourceText(t, { type: 'granted' })).toBe('Handed over when the mission step starts.');
  });

  it('cargoSourceText_collect_showsChanceInPercent', () => {
    expect(cargoSourceText(t, { type: 'collect', objectType: 'asteroid', chance: 0.5 })).toBe(
      'Found when collecting asteroids (50% chance each).'
    );
  });

  it('cargoSourceText_defeatArchetype_namesTheShip', () => {
    expect(cargoSourceText(t, { type: 'defeat', target: 'marauder', chance: 1 })).toBe(
      'Dropped by: Iron Horde Marauder (100% chance each).'
    );
  });

  it('cargoSourceText_defeatAny_usesTheGenericText', () => {
    expect(cargoSourceText(t, { type: 'defeat', target: 'any', chance: 0.25 })).toBe(
      'Dropped by any hostile ship (25% chance each).'
    );
  });

  it('cargoSourceText_everyCargoDefinition_resolvesToText', () => {
    for (const cargo of CARGO) {
      expect(cargoSourceText(t, cargo.source), cargo.id).not.toMatch(/^cargoSource\.|[{}]/);
    }
  });
});

describe('questNotificationText', () => {
  const cases: [string, QuestNotification, string][] = [
    ['questAccepted', { kind: 'questAccepted', questId: 'c1_first_haul' }, 'P: 📜 Mission accepted: **First Haul**'],
    ['questAbandoned', { kind: 'questAbandoned', questId: 'c1_first_haul' }, 'N: 📜 Mission abandoned: **First Haul**'],
    [
      'readyToReport',
      { kind: 'readyToReport', questId: 'c1_first_haul', contactId: 'vess' },
      'P: 📜 **First Haul**: objectives fulfilled. Report to **Quartermaster Vess**.',
    ],
    [
      'questCompleted',
      { kind: 'questCompleted', questId: 'c1_first_haul', xp: 150, iron: 500, commander: false },
      'P: 🏅 Mission completed: **First Haul**! Reward: 150 XP and 500 iron.',
    ],
    [
      'questCompletedWithCommander',
      { kind: 'questCompleted', questId: 'c4_head_of_the_serpent', xp: 1500, iron: 10000, commander: true },
      'P: 🏅 Mission completed: **Head of the Serpent**! Reward: 1500 XP, 10000 iron and a new commander.',
    ],
    [
      'questCompletedWithoutIron',
      { kind: 'questCompleted', questId: 'c1_first_haul', xp: 150, iron: 0, commander: false },
      'P: 🏅 Mission completed: **First Haul**! Reward: 150 XP.',
    ],
    [
      'questCompletedWithCommanderWithoutIron',
      { kind: 'questCompleted', questId: 'side_tams_stash', xp: 350, iron: 0, commander: true },
      'P: 🏅 Mission completed: **Tam’s Stash**! Reward: 350 XP and a new commander.',
    ],
    [
      'cargoFound',
      { kind: 'cargoFound', cargoId: 'ore_sample', current: 2, required: 3 },
      'P: 📦 Mission cargo found: **Ore Sample** (2/3).',
    ],
    [
      'cargoHoldFull',
      { kind: 'cargoHoldFull', cargoId: 'ore_sample' },
      'A: 📦 You found **Ore Sample**, but your inventory is full. Free a slot — the next find will be stored.',
    ],
    [
      'locationDiscovered',
      { kind: 'locationDiscovered', locationId: 'azure_drift', xp: 25 },
      'P: 🧭 Location discovered: **Azure Drift** (+25 XP).',
    ],
    [
      'achievementUnlocked',
      { kind: 'achievementUnlocked', achievementId: 'rock_breaker', tier: 2, xp: 150 },
      'P: 🏆 Achievement unlocked: **Rock Breaker**, tier 2 (+150 XP).',
    ],
  ];

  it.each(cases)('questNotificationText_%s_buildsTheMessage', (_name, notification, expected) => {
    expect(questNotificationText(t, notification)).toBe(expected);
  });

  it('questNotificationText_stageAdvanced_quotesTheObjectiveOfTheNewStage', () => {
    // `stage` is the index of the new stage; the locale keys of the stages start at 1
    const text = questNotificationText(t, { kind: 'stageAdvanced', questId: 'c2_voices_of_the_dead', stage: 1 });

    expect(text).toBe(`P: 📜 **Voices of the Dead** — next step: ${t('quest.c2_voices_of_the_dead.stages.2')}`);
    expect(text).not.toContain('quest.c2_voices_of_the_dead');
  });

  it('questNotificationText_germanLocale_isTranslated', () => {
    const notification: QuestNotification = { kind: 'questAccepted', questId: 'c1_first_haul' };

    expect(questNotificationText(tGerman, notification)).not.toBe(questNotificationText(t, notification));
    expect(questNotificationText(tGerman, notification)).toMatch(/^P: /);
  });
});
