import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, CARGO, QUESTS, STORY_CHAPTERS, getCargo, getQuest } from '@/shared/quests/questDefinitions';
import { LOCATIONS } from '@/shared/quests/locations';
import { CONTACTS, HOSTILE_ARCHETYPES, HOSTILE_ARCHETYPE_IDS, contactOrbit, hostileOrbit } from '@/shared/quests/npcArchetypes';
import { STARBASES } from '@/shared/starbases';
import { DEFAULT_WORLD_BOUNDS } from '@shared/worldConstants';
import en from '@/locales/en.json';
import de from '@/locales/de.json';

function ids<T extends { id: string }>(items: readonly T[]): string[] {
  return items.map((item) => item.id);
}

describe('quest definitions', () => {
  it('quests_ids_areUnique', () => {
    expect(new Set(ids(QUESTS)).size).toBe(QUESTS.length);
  });

  it('quests_prerequisites_referToExistingQuestsWithoutCycles', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (questId: string): void => {
      if (done.has(questId)) return;
      expect(visiting.has(questId), `cycle through ${questId}`).toBe(false);
      visiting.add(questId);
      const quest = getQuest(questId);
      expect(quest, `quest ${questId}`).toBeDefined();
      quest!.prerequisites.quests.forEach(visit);
      visiting.delete(questId);
      done.add(questId);
    };

    QUESTS.forEach((quest) => visit(quest.id));
  });

  it('quests_prerequisites_neverDependOnRepeatableContracts', () => {
    for (const quest of QUESTS) {
      for (const prerequisiteId of quest.prerequisites.quests) {
        expect(getQuest(prerequisiteId)?.repeatable ?? false, `${quest.id} → ${prerequisiteId}`).toBe(false);
      }
    }
  });

  it('quests_lastStage_isReportedToAContact', () => {
    // Completion happens in a report, so a missing inventory slot for rewards can be refused
    for (const quest of QUESTS) {
      expect(quest.stages.length, quest.id).toBeGreaterThan(0);
      expect(quest.stages[quest.stages.length - 1].reportTo, quest.id).toBeDefined();
    }
  });

  it('quests_stagesWithoutContact_haveObjectivesAndNoGathering', () => {
    for (const quest of QUESTS) {
      for (const stage of quest.stages) {
        if (stage.reportTo) continue;
        expect(stage.objectives.length, quest.id).toBeGreaterThan(0);
        expect(stage.objectives.some((objective) => objective.type === 'gather'), quest.id).toBe(false);
      }
    }
  });

  it('quests_grants_onlyInFirstStageOrAfterAReportedStage', () => {
    // Handing out cargo can fail (inventory full); that must happen in a player action, not in an event
    for (const quest of QUESTS) {
      quest.stages.forEach((stage, index) => {
        if (!stage.grants?.length || index === 0) return;
        expect(quest.stages[index - 1].reportTo, `${quest.id} stage ${index + 1}`).toBeDefined();
      });
    }
  });

  it('quests_cargoReferences_belongToTheQuest', () => {
    for (const quest of QUESTS) {
      for (const stage of quest.stages) {
        const cargoIds = [
          ...stage.objectives.flatMap((objective) => (objective.type === 'gather' ? [objective.cargoId] : [])),
          ...(stage.grants ?? []).map((grant) => grant.cargoId),
        ];
        for (const cargoId of cargoIds) {
          expect(getCargo(cargoId)?.questId, `${quest.id} → ${cargoId}`).toBe(quest.id);
        }
      }
    }
  });

  it('quests_grantedCargo_isHandedOutBeforeItIsGathered', () => {
    for (const cargo of CARGO.filter((c) => c.source.type === 'granted')) {
      const quest = getQuest(cargo.questId)!;
      const grantStage = quest.stages.findIndex((stage) => stage.grants?.some((grant) => grant.cargoId === cargo.id));
      const gatherStage = quest.stages.findIndex((stage) =>
        stage.objectives.some((objective) => objective.type === 'gather' && objective.cargoId === cargo.id)
      );
      expect(grantStage, cargo.id).toBeGreaterThanOrEqual(0);
      expect(gatherStage, cargo.id).toBeGreaterThanOrEqual(grantStage);
    }
  });

  it('quests_storyChapters_haveQuests', () => {
    for (const chapter of STORY_CHAPTERS) {
      expect(QUESTS.some((quest) => quest.chapter === chapter), `chapter ${chapter}`).toBe(true);
    }
    for (const quest of QUESTS) {
      if (quest.chapter !== undefined) expect(STORY_CHAPTERS).toContain(quest.chapter);
    }
  });

  it('cargo_definitions_haveUniqueIdsAndExistingQuests', () => {
    expect(new Set(ids(CARGO)).size).toBe(CARGO.length);
    for (const cargo of CARGO) {
      expect(getQuest(cargo.questId), cargo.id).toBeDefined();
      if (cargo.source.type !== 'granted') {
        expect(cargo.source.chance).toBeGreaterThan(0);
        expect(cargo.source.chance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('achievements_tiers_haveAscendingThresholds', () => {
    expect(new Set(ids(ACHIEVEMENTS)).size).toBe(ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) {
      const thresholds = achievement.tiers.map((tier) => tier.threshold);
      expect(thresholds, achievement.id).toEqual([...thresholds].sort((a, b) => a - b));
      expect(new Set(thresholds).size, achievement.id).toBe(thresholds.length);
    }
  });

  it('achievements_questAndChapterTiers_areReachable', () => {
    const tierMax = (id: string) => Math.max(...ACHIEVEMENTS.find((a) => a.id === id)!.tiers.map((t) => t.threshold));

    expect(tierMax('trusted_hand')).toBeLessThanOrEqual(QUESTS.length);
    expect(tierMax('saga')).toBe(STORY_CHAPTERS.length);
    expect(tierMax('pathfinder')).toBe(LOCATIONS.length);
  });
});

describe('world layout', () => {
  const { width, height } = DEFAULT_WORLD_BOUNDS;

  it('locations_areInsideTheWorld', () => {
    for (const location of LOCATIONS) {
      expect(location.x, location.id).toBeGreaterThanOrEqual(0);
      expect(location.x, location.id).toBeLessThan(width);
      expect(location.y, location.id).toBeGreaterThanOrEqual(0);
      expect(location.y, location.id).toBeLessThan(height);
    }
  });

  it('stations_haveALocationEach', () => {
    for (const station of STARBASES) {
      expect(LOCATIONS.some((l) => l.kind === 'station' && l.x === station.x && l.y === station.y)).toBe(true);
    }
  });

  it('npcOrbits_stayInsideTheWorld', () => {
    // Orbits that cross the world edge would need wrap-around handling in the renderers
    const orbits = [
      ...HOSTILE_ARCHETYPE_IDS.map((id) => hostileOrbit(HOSTILE_ARCHETYPES[id])),
      ...CONTACTS.map(contactOrbit),
    ];
    for (const orbit of orbits) {
      expect(orbit.centerX - orbit.radius).toBeGreaterThanOrEqual(0);
      expect(orbit.centerX + orbit.radius).toBeLessThan(width);
      expect(orbit.centerY - orbit.radius).toBeGreaterThanOrEqual(0);
      expect(orbit.centerY + orbit.radius).toBeLessThan(height);
    }
  });

  it('aggressiveShips_cannotReachContactsOrLocationEdges', () => {
    // A lair can be scouted (visit objective) without triggering an ambush
    for (const id of HOSTILE_ARCHETYPE_IDS) {
      const archetype = HOSTILE_ARCHETYPES[id];
      if (!archetype.aggressive) continue;
      const home = LOCATIONS.find((l) => l.id === archetype.home)!;
      expect(archetype.orbitRadius + archetype.aggroRadius, id).toBeLessThan(home.radius);
    }
  });

  it('hostileSpawns_haveUniqueSlotAndLevelOffsetCombinations', () => {
    const keys = HOSTILE_ARCHETYPE_IDS.flatMap((id) =>
      HOSTILE_ARCHETYPES[id].spawns.map((spawn) => `${spawn.slot}:${spawn.levelOffset}`)
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of HOSTILE_ARCHETYPE_IDS) {
      for (const spawn of HOSTILE_ARCHETYPES[id].spawns) {
        expect(spawn.slot).toBeGreaterThanOrEqual(0);
        expect(spawn.slot).toBeLessThan(10);
        // Slot 0 is shared by the pirates; every other spawn owns its slot
        if (id !== 'pirate') expect(spawn.slot).toBeGreaterThan(0);
      }
    }
  });
});

describe('quest texts', () => {
  const catalogs = { en: en.quests, de: de.quests } as Record<string, Record<string, Record<string, unknown>>>;

  for (const [locale, quests] of Object.entries(catalogs)) {
    it(`locale_${locale}_hasTextsForEveryDefinition`, () => {
      for (const quest of QUESTS) {
        const texts = quests.quest[quest.id] as Record<string, unknown> | undefined;
        expect(texts, `quest ${quest.id}`).toBeDefined();
        expect(texts!.title, `${quest.id}.title`).toBeTruthy();
        expect(texts!.offer, `${quest.id}.offer`).toBeTruthy();
        expect(texts!.completion, `${quest.id}.completion`).toBeTruthy();
        // Stage texts are keyed "1".."n"
        const stages = texts!.stages as Record<string, string>;
        expect(Object.keys(stages), `${quest.id}.stages`).toEqual(quest.stages.map((_, index) => String(index + 1)));
      }
      for (const cargo of CARGO) expect(quests.cargo[cargo.id], `cargo ${cargo.id}`).toBeTruthy();
      for (const location of LOCATIONS) expect(quests.locations[location.id], `location ${location.id}`).toBeTruthy();
      for (const contact of CONTACTS) expect(quests.contacts[contact.id], `contact ${contact.id}`).toBeTruthy();
      for (const chapter of STORY_CHAPTERS) expect(quests.chapters[String(chapter)], `chapter ${chapter}`).toBeTruthy();
      for (const achievement of ACHIEVEMENTS) {
        expect(quests.achievements[achievement.id], `achievement ${achievement.id}`).toBeTruthy();
      }
      for (const id of HOSTILE_ARCHETYPE_IDS) expect(quests.hostiles[id], `hostile ${id}`).toBeTruthy();
    });
  }
});
