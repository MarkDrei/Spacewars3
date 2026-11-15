import { describe, it, expect } from 'vitest';
import {
  abandonQuest,
  acceptQuest,
  applyQuestEvent,
  createInitialQuestState,
  debugFulfilStage,
  debugUnlockPrerequisites,
  getMissingPrerequisites,
  getObjectiveProgress,
  getQuestStatus,
  getVisitCandidates,
  getWantedArchetypes,
  reportQuest,
  type QuestContext,
} from '@/shared/quests/questEngine';
import { getQuest } from '@/shared/quests/questDefinitions';
import { LOCATIONS, LOCATION_DISCOVERY_XP } from '@/shared/quests/locations';
import { CONTACTS, type ContactId } from '@/shared/quests/npcArchetypes';
import type {
  CargoHold,
  PlayerQuestState,
  QuestEffects,
  QuestEngineResult,
  QuestEvent,
  QuestRuleErrorCode,
} from '@/shared/quests/questTypes';
import { QuestRuleError } from '@/shared/quests/questTypes';

const NOW = 1_800_000_000_000;
const ALL_CONTACTS: ContactId[] = CONTACTS.map((contact) => contact.id);

/** A player as the server sees them: quest state plus the cargo in the inventory. */
class TestPlayer {
  state: PlayerQuestState = createInitialQuestState();
  cargo: CargoHold = { counts: {}, freeSlots: 5 };
  level = 1;
  contactsInRange: ContactId[] = ALL_CONTACTS;
  rngValue = 0;
  xp = 0;
  iron = 0;
  commanders = 0;

  private ctx(): QuestContext {
    return {
      now: NOW,
      level: this.level,
      cargo: this.cargo,
      contactsInRange: this.contactsInRange,
      rng: () => this.rngValue,
    };
  }

  private apply(result: QuestEngineResult): QuestEffects {
    this.state = result.state;
    for (const stack of result.effects.cargoAdd) {
      if (!(stack.cargoId in this.cargo.counts)) this.cargo.freeSlots -= 1;
      this.cargo.counts[stack.cargoId] = (this.cargo.counts[stack.cargoId] ?? 0) + stack.quantity;
    }
    for (const stack of result.effects.cargoRemove) {
      this.cargo.counts[stack.cargoId] -= stack.quantity;
      if (this.cargo.counts[stack.cargoId] === 0) {
        delete this.cargo.counts[stack.cargoId];
        this.cargo.freeSlots += 1;
      }
    }
    this.cargo.freeSlots -= result.effects.commanders;
    this.xp += result.effects.xp;
    this.iron += result.effects.iron;
    this.commanders += result.effects.commanders;
    return result.effects;
  }

  accept(questId: string): QuestEffects {
    return this.apply(acceptQuest(this.state, questId, this.ctx()));
  }
  report(questId: string, contactId: ContactId): QuestEffects {
    return this.apply(reportQuest(this.state, questId, contactId, this.ctx()));
  }
  abandon(questId: string): QuestEffects {
    return this.apply(abandonQuest(this.state, questId, this.ctx()));
  }
  event(event: QuestEvent, times = 1): QuestEffects[] {
    return Array.from({ length: times }, () => this.apply(applyQuestEvent(this.state, event, this.ctx())));
  }
  fulfil(questId: string): QuestEffects {
    return this.apply(debugFulfilStage(this.state, questId, this.ctx()));
  }
  unlock(questId: string): QuestEffects {
    return this.apply(debugUnlockPrerequisites(this.state, questId, this.ctx()));
  }
  status(questId: string) {
    return getQuestStatus(this.state, getQuest(questId)!, this.level);
  }
  progress(questId: string): number[] {
    return getObjectiveProgress(this.state, getQuest(questId)!, this.cargo);
  }
}

function expectRuleError(action: () => unknown, code: QuestRuleErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(QuestRuleError);
    expect((error as QuestRuleError).code).toBe(code);
    return;
  }
  throw new Error(`Expected QuestRuleError ${code}`);
}

function kinds(effects: QuestEffects): string[] {
  return effects.notifications.map((notification) => notification.kind);
}

describe('quest status and prerequisites', () => {
  it('getQuestStatus_newPlayer_firstQuestAvailableFollowUpLocked', () => {
    const player = new TestPlayer();

    expect(player.status('c1_first_haul')).toBe('available');
    expect(player.status('c1_salvage_rights')).toBe('locked');
    expect(player.status('side_tams_ore')).toBe('available');
  });

  it('getMissingPrerequisites_levelTooLow_reportsRequiredLevel', () => {
    const player = new TestPlayer();
    player.unlock('c3_thin_the_herd');

    const missing = getMissingPrerequisites(player.state, getQuest('c3_thin_the_herd')!, 1);

    expect(missing).toEqual({ quests: [], minLevel: 2 });
    expect(player.status('c3_thin_the_herd')).toBe('locked');
    player.level = 2;
    expect(player.status('c3_thin_the_herd')).toBe('available');
  });

  it('getMissingPrerequisites_openPrerequisites_listsOnlyUnfinishedQuests', () => {
    const player = new TestPlayer();
    player.unlock('c1_salvage_rights');

    const missing = getMissingPrerequisites(player.state, getQuest('c1_dispatch_to_meridian')!, 1);

    expect(missing.quests).toEqual(['c1_salvage_rights', 'c1_pirate_trouble']);
  });
});

describe('acceptQuest', () => {
  it('acceptQuest_giverInRange_questBecomesActive', () => {
    const player = new TestPlayer();

    const effects = player.accept('c1_first_haul');

    expect(player.status('c1_first_haul')).toBe('active');
    expect(kinds(effects)).toEqual(['questAccepted']);
    expect(player.state.revision).toBe(1);
  });

  it('acceptQuest_giverOutOfRange_throwsContactOutOfRange', () => {
    const player = new TestPlayer();
    player.contactsInRange = ['quill'];

    expectRuleError(() => player.accept('c1_first_haul'), 'contactOutOfRange');
  });

  it('acceptQuest_lockedQuest_throwsNotAvailable', () => {
    const player = new TestPlayer();

    expectRuleError(() => player.accept('c1_salvage_rights'), 'notAvailable');
  });

  it('acceptQuest_alreadyActive_throwsAlreadyActive', () => {
    const player = new TestPlayer();
    player.accept('c1_first_haul');

    expectRuleError(() => player.accept('c1_first_haul'), 'alreadyActive');
  });

  it('acceptQuest_unknownQuest_throwsUnknownQuest', () => {
    expectRuleError(() => new TestPlayer().accept('does_not_exist'), 'unknownQuest');
  });

  it('acceptQuest_stageGrantsCargo_cargoIsHandedOut', () => {
    const player = new TestPlayer();
    player.unlock('c1_dispatch_to_meridian');

    const effects = player.accept('c1_dispatch_to_meridian');

    expect(effects.cargoAdd).toEqual([{ cargoId: 'sealed_dispatch', quantity: 1 }]);
    expect(player.progress('c1_dispatch_to_meridian')).toEqual([1]);
  });

  it('acceptQuest_grantedCargoDoesNotFit_throwsCargoHoldFullAndLeavesStateUntouched', () => {
    const player = new TestPlayer();
    player.unlock('c1_dispatch_to_meridian');
    player.cargo.freeSlots = 0;
    const before = structuredClone(player.state);

    expectRuleError(() => player.accept('c1_dispatch_to_meridian'), 'cargoHoldFull');
    expect(player.state).toEqual(before);
  });
});

describe('applyQuestEvent', () => {
  it('applyQuestEvent_collectObjective_countsMatchingObjectsUpToTarget', () => {
    const player = new TestPlayer();
    player.accept('c1_first_haul');

    player.event({ type: 'object_collected', objectType: 'shipwreck' });
    expect(player.progress('c1_first_haul')).toEqual([0]);

    const effects = player.event({ type: 'object_collected', objectType: 'asteroid' }, 4);

    expect(player.progress('c1_first_haul')).toEqual([3]);
    expect(kinds(effects[1])).toEqual([]);
    expect(kinds(effects[2])).toEqual(['readyToReport']);
    expect(kinds(effects[3])).toEqual([]);
    expect(player.status('c1_first_haul')).toBe('active');
  });

  it('applyQuestEvent_noActiveQuest_onlyCountersChange', () => {
    const player = new TestPlayer();

    player.event({ type: 'object_collected', objectType: 'asteroid' });

    expect(player.state.counters.asteroidsCollected).toBe(1);
    expect(player.state.quests).toEqual({});
  });

  it('applyQuestEvent_cargoDropWhileStageNeedsIt_addsCargoUntilRequiredAmount', () => {
    const player = new TestPlayer();
    player.unlock('c1_salvage_rights');
    player.accept('c1_salvage_rights');

    const effects = player.event({ type: 'object_collected', objectType: 'shipwreck' }, 3);

    expect(player.cargo.counts.hull_plating).toBe(2);
    expect(effects[0].notifications).toEqual([{ kind: 'cargoFound', cargoId: 'hull_plating', current: 1, required: 2 }]);
    expect(kinds(effects[1])).toEqual(['cargoFound', 'readyToReport']);
    expect(effects[2].cargoAdd).toEqual([]);
  });

  it('applyQuestEvent_cargoQuestNotActive_dropsNothing', () => {
    const player = new TestPlayer();

    const [effects] = player.event({ type: 'object_collected', objectType: 'shipwreck' });

    expect(effects.cargoAdd).toEqual([]);
    expect(player.cargo.counts).toEqual({});
  });

  it('applyQuestEvent_dropChanceMissed_dropsNothing', () => {
    const player = new TestPlayer();
    player.accept('side_tams_ore');
    player.rngValue = 0.5; // ore sample chance is 0.5: rng must be below

    player.event({ type: 'object_collected', objectType: 'asteroid' });
    expect(player.cargo.counts.ore_sample).toBeUndefined();

    player.rngValue = 0.49;
    player.event({ type: 'object_collected', objectType: 'asteroid' });
    expect(player.cargo.counts.ore_sample).toBe(1);
  });

  it('applyQuestEvent_inventoryFull_notifiesAndDropsNothing', () => {
    const player = new TestPlayer();
    player.accept('side_tams_ore');
    player.cargo.freeSlots = 0;

    const [effects] = player.event({ type: 'object_collected', objectType: 'asteroid' });

    expect(effects.notifications).toEqual([{ kind: 'cargoHoldFull', cargoId: 'ore_sample' }]);
    expect(player.cargo.counts).toEqual({});
  });

  it('applyQuestEvent_stageWithoutContact_advancesAutomatically', () => {
    const player = new TestPlayer();
    player.unlock('c2_voices_of_the_dead');
    player.accept('c2_voices_of_the_dead');

    // Flight recorders belong to stage 2: nothing drops before the graveyard has been visited
    player.event({ type: 'object_collected', objectType: 'shipwreck' });
    expect(player.cargo.counts.flight_recorder).toBeUndefined();

    const [effects] = player.event({ type: 'location_visited', locationId: 'anvil_graveyard' });

    expect(effects.notifications).toContainEqual({ kind: 'stageAdvanced', questId: 'c2_voices_of_the_dead', stage: 1 });
    expect(player.state.quests.c2_voices_of_the_dead.stage).toBe(1);
    player.event({ type: 'object_collected', objectType: 'shipwreck' });
    expect(player.cargo.counts.flight_recorder).toBe(1);
  });

  it('applyQuestEvent_defeatAnyObjective_countsEveryArchetype', () => {
    const player = new TestPlayer();
    player.level = 2;
    player.unlock('contract_standing_bounty');
    player.accept('contract_standing_bounty');

    player.event({ type: 'npc_defeated', archetype: 'pirate' });
    player.event({ type: 'npc_defeated', archetype: 'drone' });

    expect(player.progress('contract_standing_bounty')).toEqual([2]);
  });

  it('applyQuestEvent_defeatSpecificTarget_ignoresOtherArchetypes', () => {
    const player = new TestPlayer();
    player.unlock('c1_pirate_trouble');
    player.accept('c1_pirate_trouble');

    player.event({ type: 'npc_defeated', archetype: 'drone' });
    expect(player.progress('c1_pirate_trouble')).toEqual([0]);

    player.event({ type: 'npc_defeated', archetype: 'pirate' });
    expect(player.progress('c1_pirate_trouble')).toEqual([1]);
  });

  it('applyQuestEvent_npcDefeated_updatesCombatCounters', () => {
    const player = new TestPlayer();

    player.event({ type: 'npc_defeated', archetype: 'pirate' });
    player.event({ type: 'npc_defeated', archetype: 'marauder' });
    player.event({ type: 'npc_defeated', archetype: 'warlord' });
    player.event({ type: 'pvp_won' });

    expect(player.state.counters).toMatchObject({
      npcsDefeated: 3,
      aggressorsDefeated: 1,
      warlordsDefeated: 1,
      pvpWins: 1,
    });
  });

  it('applyQuestEvent_firstVisitOfLocation_discoversItOnce', () => {
    const player = new TestPlayer();

    const [first, second] = player.event({ type: 'location_visited', locationId: 'azure_drift' }, 2);

    expect(first.notifications).toEqual([{ kind: 'locationDiscovered', locationId: 'azure_drift', xp: LOCATION_DISCOVERY_XP }]);
    expect(first.xp).toBe(LOCATION_DISCOVERY_XP);
    expect(second.notifications).toEqual([]);
    expect(player.state.discovered).toEqual(['azure_drift']);
    expect(player.state.revision).toBe(1);
  });

  it('applyQuestEvent_nothingChanges_reportsUnchangedAndKeepsRevision', () => {
    const player = new TestPlayer();
    player.event({ type: 'location_visited', locationId: 'azure_drift' });

    const result = applyQuestEvent(
      player.state,
      { type: 'location_visited', locationId: 'azure_drift' },
      { now: NOW, level: 1, cargo: player.cargo, contactsInRange: [], rng: () => 0 }
    );

    expect(result.changed).toBe(false);
    expect(result.state.revision).toBe(player.state.revision);
  });

  it('applyQuestEvent_inputState_isNotMutated', () => {
    const player = new TestPlayer();
    player.accept('c1_first_haul');
    const before = structuredClone(player.state);
    const cargoBefore = structuredClone(player.cargo);

    applyQuestEvent(
      player.state,
      { type: 'object_collected', objectType: 'asteroid' },
      { now: NOW, level: 1, cargo: player.cargo, contactsInRange: [], rng: () => 0 }
    );

    expect(player.state).toEqual(before);
    expect(player.cargo).toEqual(cargoBefore);
  });
});

describe('reportQuest', () => {
  it('reportQuest_objectivesComplete_completesQuestAndPaysRewards', () => {
    const player = new TestPlayer();
    player.accept('c1_first_haul');
    player.event({ type: 'object_collected', objectType: 'asteroid' }, 3);
    const xpBefore = player.xp;

    const effects = player.report('c1_first_haul', 'vess');

    expect(player.status('c1_first_haul')).toBe('completed');
    expect(effects.notifications).toContainEqual({
      kind: 'questCompleted',
      questId: 'c1_first_haul',
      xp: 150,
      iron: 500,
      commander: false,
    });
    expect(effects.iron).toBe(500);
    // 150 XP for the quest + 50 XP for the first tier of the "trusted hand" achievement
    expect(player.xp - xpBefore).toBe(200);
    expect(player.status('c1_salvage_rights')).toBe('available');
  });

  it('reportQuest_objectivesIncomplete_throwsObjectivesIncomplete', () => {
    const player = new TestPlayer();
    player.accept('c1_first_haul');

    expectRuleError(() => player.report('c1_first_haul', 'vess'), 'objectivesIncomplete');
  });

  it('reportQuest_wrongContact_throwsWrongContact', () => {
    const player = new TestPlayer();
    player.accept('c1_first_haul');
    player.fulfil('c1_first_haul');

    expectRuleError(() => player.report('c1_first_haul', 'quill'), 'wrongContact');
  });

  it('reportQuest_contactOutOfRange_throwsContactOutOfRange', () => {
    const player = new TestPlayer();
    player.accept('c1_first_haul');
    player.fulfil('c1_first_haul');
    player.contactsInRange = [];

    expectRuleError(() => player.report('c1_first_haul', 'vess'), 'contactOutOfRange');
  });

  it('reportQuest_questNotActive_throwsNotActive', () => {
    expectRuleError(() => new TestPlayer().report('c1_first_haul', 'vess'), 'notActive');
  });

  it('reportQuest_gatherStage_handsOverCargoAndFreesSlot', () => {
    const player = new TestPlayer();
    player.unlock('c1_salvage_rights');
    player.accept('c1_salvage_rights');
    player.event({ type: 'object_collected', objectType: 'shipwreck' }, 2);
    const freeBefore = player.cargo.freeSlots;

    const effects = player.report('c1_salvage_rights', 'vess');

    expect(effects.cargoRemove).toEqual([{ cargoId: 'hull_plating', quantity: 2 }]);
    expect(player.cargo.counts).toEqual({});
    expect(player.cargo.freeSlots).toBe(freeBefore + 1);
  });

  it('reportQuest_deliveryToOtherContact_completesAtRecipient', () => {
    const player = new TestPlayer();
    player.unlock('c1_dispatch_to_meridian');
    player.accept('c1_dispatch_to_meridian');

    expectRuleError(() => player.report('c1_dispatch_to_meridian', 'vess'), 'wrongContact');
    player.report('c1_dispatch_to_meridian', 'quill');

    expect(player.status('c1_dispatch_to_meridian')).toBe('completed');
    expect(player.cargo.counts).toEqual({});
  });

  it('reportQuest_multiStageQuest_grantsCargoOfNextStage', () => {
    const player = new TestPlayer();
    player.unlock('c2_the_trail');
    player.accept('c2_the_trail');
    player.event({ type: 'location_visited', locationId: 'hordes_reach' });

    const effects = player.report('c2_the_trail', 'quill');

    expect(effects.cargoAdd).toEqual([{ cargoId: 'decoded_coordinates', quantity: 1 }]);
    expect(effects.notifications).toContainEqual({ kind: 'stageAdvanced', questId: 'c2_the_trail', stage: 1 });
    expect(player.status('c2_the_trail')).toBe('active');

    player.report('c2_the_trail', 'halden');
    expect(player.status('c2_the_trail')).toBe('completed');
  });

  it('reportQuest_commanderRewardWithoutFreeSlot_throwsCargoHoldFullAndKeepsQuestActive', () => {
    const player = new TestPlayer();
    player.unlock('side_tams_stash');
    player.accept('side_tams_stash');
    player.event({ type: 'location_visited', locationId: 'azure_drift' });
    player.event({ type: 'location_visited', locationId: 'listening_post_tau' });
    player.cargo.freeSlots = 0;

    expectRuleError(() => player.report('side_tams_stash', 'tam'), 'cargoHoldFull');
    expect(player.status('side_tams_stash')).toBe('active');

    player.cargo.freeSlots = 1;
    const effects = player.report('side_tams_stash', 'tam');
    expect(effects.commanders).toBe(1);
    expect(player.status('side_tams_stash')).toBe('completed');
  });

  it('reportQuest_repeatableContract_canBeAcceptedAgainAndCountsCompletions', () => {
    const player = new TestPlayer();
    player.unlock('contract_scrap_run');

    for (let run = 0; run < 2; run++) {
      player.accept('contract_scrap_run');
      player.fulfil('contract_scrap_run');
      player.report('contract_scrap_run', 'vess');
    }

    expect(player.status('contract_scrap_run')).toBe('available');
    expect(player.state.quests.contract_scrap_run.completions).toBe(2);
    expect(player.state.counters.contractsCompleted).toBe(2);
    // Distinct quests: two unlocked prerequisites + the contract itself
    expect(player.state.counters.questsCompleted).toBe(3);
  });
});

describe('abandonQuest', () => {
  it('abandonQuest_activeQuest_removesProgressAndQuestCargo', () => {
    const player = new TestPlayer();
    player.unlock('c1_salvage_rights');
    player.accept('c1_salvage_rights');
    player.event({ type: 'object_collected', objectType: 'shipwreck' });

    const effects = player.abandon('c1_salvage_rights');

    expect(effects.cargoRemove).toEqual([{ cargoId: 'hull_plating', quantity: 1 }]);
    expect(kinds(effects)).toEqual(['questAbandoned']);
    expect(player.status('c1_salvage_rights')).toBe('available');
    expect(player.state.quests.c1_salvage_rights).toBeUndefined();
  });

  it('abandonQuest_repeatedContract_keepsCompletions', () => {
    const player = new TestPlayer();
    player.unlock('contract_scrap_run');
    player.accept('contract_scrap_run');
    player.fulfil('contract_scrap_run');
    player.report('contract_scrap_run', 'vess');
    player.accept('contract_scrap_run');

    player.abandon('contract_scrap_run');

    expect(player.state.quests.contract_scrap_run).toMatchObject({ status: 'completed', completions: 1 });
  });

  it('abandonQuest_questNotActive_throwsNotActive', () => {
    expectRuleError(() => new TestPlayer().abandon('c1_first_haul'), 'notActive');
  });
});

describe('achievements', () => {
  it('applyQuestEvent_counterReachesTier_unlocksAchievementOnce', () => {
    const player = new TestPlayer();

    const effects = player.event({ type: 'object_collected', objectType: 'asteroid' }, 11);

    expect(effects[8].notifications).toEqual([]);
    expect(effects[9].notifications).toEqual([{ kind: 'achievementUnlocked', achievementId: 'rock_breaker', tier: 1, xp: 50 }]);
    expect(effects[10].notifications).toEqual([]);
    expect(player.state.achievements.rock_breaker).toBe(1);
  });

  it('reportQuest_lastQuestOfChapter_countsChapterAndUnlocksSaga', () => {
    const player = new TestPlayer();
    player.unlock('c1_dispatch_to_meridian');
    expect(player.state.counters.chaptersCompleted).toBe(0);
    player.accept('c1_dispatch_to_meridian');

    const effects = player.report('c1_dispatch_to_meridian', 'quill');

    expect(player.state.counters.chaptersCompleted).toBe(1);
    expect(effects.notifications).toContainEqual({ kind: 'achievementUnlocked', achievementId: 'saga', tier: 1, xp: 100 });
  });
});

describe('queries for the world poll', () => {
  it('getVisitCandidates_newPlayer_containsAllLocations', () => {
    expect(getVisitCandidates(createInitialQuestState()).sort()).toEqual(LOCATIONS.map((l) => l.id).sort());
  });

  it('getVisitCandidates_discoveredLocationWithOpenVisitObjective_staysCandidateUntilVisited', () => {
    const player = new TestPlayer();
    for (const location of LOCATIONS) player.event({ type: 'location_visited', locationId: location.id });
    expect(getVisitCandidates(player.state)).toEqual([]);

    player.unlock('c2_charting_the_dark');
    player.accept('c2_charting_the_dark');
    expect(getVisitCandidates(player.state).sort()).toEqual(['azure_drift', 'listening_post_tau']);

    player.event({ type: 'location_visited', locationId: 'azure_drift' });
    expect(getVisitCandidates(player.state)).toEqual(['listening_post_tau']);
  });

  it('getWantedArchetypes_warlordQuestActive_containsWarlordUntilReported', () => {
    const player = new TestPlayer();
    player.level = 3;
    expect(getWantedArchetypes(player.state)).toEqual([]);
    player.unlock('c4_head_of_the_serpent');
    player.accept('c4_head_of_the_serpent');

    expect(getWantedArchetypes(player.state)).toEqual(['warlord']);

    const [effects] = player.event({ type: 'npc_defeated', archetype: 'warlord' });
    expect(effects.cargoAdd).toEqual([{ cargoId: 'warlord_cipher', quantity: 1 }]);
    expect(getWantedArchetypes(player.state)).toEqual(['warlord']);

    player.report('c4_head_of_the_serpent', 'halden');
    expect(getWantedArchetypes(player.state)).toEqual([]);
  });
});

describe('test tools', () => {
  it('debugFulfilStage_gatherObjective_addsMissingCargo', () => {
    const player = new TestPlayer();
    player.accept('side_tams_ore');
    player.event({ type: 'object_collected', objectType: 'asteroid' });

    const effects = player.fulfil('side_tams_ore');

    expect(effects.cargoAdd).toEqual([{ cargoId: 'ore_sample', quantity: 2 }]);
    expect(kinds(effects)).toEqual(['readyToReport']);
  });

  it('debugUnlockPrerequisites_storyQuest_completesAllTransitivePrerequisitesWithoutQuestRewards', () => {
    const player = new TestPlayer();

    const effects = player.unlock('c2_the_trail');

    expect(player.status('c1_first_haul')).toBe('completed');
    expect(player.status('c2_voices_of_the_dead')).toBe('completed');
    expect(player.status('c2_the_trail')).toBe('available');
    expect(effects.iron).toBe(0);
    expect(player.state.counters.questsCompleted).toBe(7);
  });
});

describe('full story', () => {
  it('story_playedInOrder_completesAllChaptersAndQuests', () => {
    const player = new TestPlayer();
    player.level = 3;
    const story = [
      'c1_first_haul', 'c1_salvage_rights', 'c1_pirate_trouble', 'c1_dispatch_to_meridian',
      'c2_charting_the_dark', 'c2_lost_and_found', 'c2_voices_of_the_dead', 'c2_the_trail',
      'c3_thin_the_herd', 'c3_colours_of_the_horde', 'c3_rogue_signals',
      'c4_war_council', 'c4_head_of_the_serpent', 'c4_a_quiet_sky',
    ];

    for (const questId of story) {
      expect(player.status(questId), questId).toBe('available');
      player.accept(questId);
      // Fulfil and report stage by stage until the quest is completed
      for (let step = 0; step < 10 && player.status(questId) === 'active'; step++) {
        const stageIndex = player.state.quests[questId].stage;
        player.fulfil(questId);
        // Stages without a contact have advanced on their own
        const reportTo = getQuest(questId)!.stages[stageIndex].reportTo;
        if (reportTo) player.report(questId, reportTo);
      }
      expect(player.status(questId), questId).toBe('completed');
    }

    expect(player.state.counters.chaptersCompleted).toBe(4);
    expect(player.state.achievements.saga).toBe(4);
    expect(player.commanders).toBe(1);
    expect(player.cargo.counts).toEqual({});
  });
});
