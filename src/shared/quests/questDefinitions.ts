// ---
// All missions, quest cargo and achievements of the game.
// Texts (titles, briefings, dialogue) live in the locale files under `quests.*`, keyed by id.
// `doc/quests.md` is generated from this file: run `npm run quest-doc` after every change.
// ---

import type { AchievementDefinition, CargoDefinition, QuestDefinition } from './questTypes';

/** Titles of the story chapters are in the locale files (`quests.chapters.<n>`). */
export const STORY_CHAPTERS = [1, 2, 3, 4] as const;

export const QUESTS: readonly QuestDefinition[] = [
  // -------------------------------------------------------------------------
  // Chapter 1 — Dockside Work (Quartermaster Vess, Ironstrike Station)
  // -------------------------------------------------------------------------
  {
    id: 'c1_first_haul',
    giver: 'vess',
    chapter: 1,
    prerequisites: { quests: [] },
    stages: [{ objectives: [{ type: 'collect', objectType: 'asteroid', count: 3 }], reportTo: 'vess' }],
    rewards: { xp: 150, iron: 500 },
  },
  {
    id: 'c1_salvage_rights',
    giver: 'vess',
    chapter: 1,
    prerequisites: { quests: ['c1_first_haul'] },
    stages: [{ objectives: [{ type: 'gather', cargoId: 'hull_plating', count: 2 }], reportTo: 'vess' }],
    rewards: { xp: 200, iron: 800 },
  },
  {
    id: 'c1_pirate_trouble',
    giver: 'vess',
    chapter: 1,
    prerequisites: { quests: ['c1_first_haul'] },
    stages: [{ objectives: [{ type: 'defeat', target: 'pirate', count: 1 }], reportTo: 'vess' }],
    rewards: { xp: 300, iron: 1500 },
  },
  {
    id: 'c1_dispatch_to_meridian',
    giver: 'vess',
    chapter: 1,
    prerequisites: { quests: ['c1_salvage_rights', 'c1_pirate_trouble'] },
    stages: [
      {
        grants: [{ cargoId: 'sealed_dispatch', quantity: 1 }],
        objectives: [{ type: 'gather', cargoId: 'sealed_dispatch', count: 1 }],
        reportTo: 'quill',
      },
    ],
    rewards: { xp: 250, iron: 500 },
  },

  // -------------------------------------------------------------------------
  // Chapter 2 — Eyes in the Dark (Professor Quill, Meridian Observatory)
  // -------------------------------------------------------------------------
  {
    id: 'c2_charting_the_dark',
    giver: 'quill',
    chapter: 2,
    prerequisites: { quests: ['c1_dispatch_to_meridian'] },
    stages: [
      {
        objectives: [
          { type: 'visit', locationId: 'azure_drift' },
          { type: 'visit', locationId: 'listening_post_tau' },
        ],
        reportTo: 'quill',
      },
    ],
    rewards: { xp: 350, iron: 1000 },
  },
  {
    id: 'c2_lost_and_found',
    giver: 'quill',
    chapter: 2,
    prerequisites: { quests: ['c1_dispatch_to_meridian'] },
    stages: [{ objectives: [{ type: 'collect', objectType: 'escape_pod', count: 2 }], reportTo: 'quill' }],
    rewards: { xp: 300, iron: 800 },
  },
  {
    id: 'c2_voices_of_the_dead',
    giver: 'quill',
    chapter: 2,
    prerequisites: { quests: ['c2_charting_the_dark'] },
    stages: [
      { objectives: [{ type: 'visit', locationId: 'anvil_graveyard' }] },
      { objectives: [{ type: 'gather', cargoId: 'flight_recorder', count: 3 }], reportTo: 'quill' },
    ],
    rewards: { xp: 450, iron: 1500 },
  },
  {
    id: 'c2_the_trail',
    giver: 'quill',
    chapter: 2,
    prerequisites: { quests: ['c2_voices_of_the_dead', 'c2_lost_and_found'] },
    stages: [
      { objectives: [{ type: 'visit', locationId: 'hordes_reach' }], reportTo: 'quill' },
      {
        grants: [{ cargoId: 'decoded_coordinates', quantity: 1 }],
        objectives: [{ type: 'gather', cargoId: 'decoded_coordinates', count: 1 }],
        reportTo: 'halden',
      },
    ],
    rewards: { xp: 500, iron: 1500 },
  },

  // -------------------------------------------------------------------------
  // Chapter 3 — The Bastion Line (Captain Halden, Bastion Outpost)
  // -------------------------------------------------------------------------
  {
    id: 'c3_thin_the_herd',
    giver: 'halden',
    chapter: 3,
    prerequisites: { quests: ['c2_the_trail'], minLevel: 2 },
    stages: [{ objectives: [{ type: 'defeat', target: 'pirate', count: 3 }], reportTo: 'halden' }],
    rewards: { xp: 500, iron: 3000 },
  },
  {
    id: 'c3_colours_of_the_horde',
    giver: 'halden',
    chapter: 3,
    prerequisites: { quests: ['c3_thin_the_herd'] },
    stages: [{ objectives: [{ type: 'gather', cargoId: 'horde_insignia', count: 2 }], reportTo: 'halden' }],
    rewards: { xp: 600, iron: 4000 },
  },
  {
    id: 'c3_rogue_signals',
    giver: 'halden',
    chapter: 3,
    prerequisites: { quests: ['c3_thin_the_herd'] },
    stages: [{ objectives: [{ type: 'gather', cargoId: 'drone_core', count: 2 }], reportTo: 'quill' }],
    rewards: { xp: 500, iron: 2500 },
  },

  // -------------------------------------------------------------------------
  // Chapter 4 — Breaking the Horde
  // -------------------------------------------------------------------------
  {
    id: 'c4_war_council',
    giver: 'halden',
    chapter: 4,
    prerequisites: { quests: ['c3_colours_of_the_horde', 'c3_rogue_signals'], minLevel: 3 },
    stages: [
      { grants: [{ cargoId: 'battle_plans', quantity: 1 }], objectives: [], reportTo: 'vess' },
      { objectives: [], reportTo: 'quill' },
      { objectives: [{ type: 'gather', cargoId: 'battle_plans', count: 1 }], reportTo: 'halden' },
    ],
    rewards: { xp: 400, iron: 2000 },
  },
  {
    id: 'c4_head_of_the_serpent',
    giver: 'halden',
    chapter: 4,
    prerequisites: { quests: ['c4_war_council'] },
    stages: [
      {
        objectives: [
          { type: 'defeat', target: 'warlord', count: 1 },
          { type: 'gather', cargoId: 'warlord_cipher', count: 1 },
        ],
        reportTo: 'halden',
      },
    ],
    rewards: { xp: 1500, iron: 10000, commander: true },
  },
  {
    id: 'c4_a_quiet_sky',
    giver: 'vess',
    chapter: 4,
    prerequisites: { quests: ['c4_head_of_the_serpent'] },
    stages: [
      {
        objectives: [
          { type: 'visit', locationId: 'meridian_observatory' },
          { type: 'visit', locationId: 'bastion_outpost' },
        ],
        reportTo: 'vess',
      },
    ],
    rewards: { xp: 500, iron: 3000 },
  },

  // -------------------------------------------------------------------------
  // Side quests (Old Tam, Drifter's Rock)
  // -------------------------------------------------------------------------
  {
    id: 'side_tams_ore',
    giver: 'tam',
    prerequisites: { quests: [] },
    stages: [{ objectives: [{ type: 'gather', cargoId: 'ore_sample', count: 3 }], reportTo: 'tam' }],
    rewards: { xp: 300, iron: 1200 },
  },
  {
    id: 'side_tams_stash',
    giver: 'tam',
    prerequisites: { quests: ['side_tams_ore'] },
    stages: [
      { objectives: [{ type: 'visit', locationId: 'azure_drift' }] },
      { objectives: [{ type: 'visit', locationId: 'listening_post_tau' }] },
      { objectives: [], reportTo: 'tam' },
    ],
    rewards: { xp: 350, iron: 0, commander: true },
  },

  // -------------------------------------------------------------------------
  // Contracts (repeatable)
  // -------------------------------------------------------------------------
  {
    id: 'contract_scrap_run',
    giver: 'vess',
    repeatable: true,
    prerequisites: { quests: ['c1_salvage_rights'] },
    stages: [
      {
        objectives: [
          { type: 'collect', objectType: 'asteroid', count: 5 },
          { type: 'collect', objectType: 'shipwreck', count: 2 },
        ],
        reportTo: 'vess',
      },
    ],
    rewards: { xp: 100, iron: 600 },
  },
  {
    id: 'contract_search_and_rescue',
    giver: 'quill',
    repeatable: true,
    prerequisites: { quests: ['c2_lost_and_found'] },
    stages: [{ objectives: [{ type: 'collect', objectType: 'escape_pod', count: 3 }], reportTo: 'quill' }],
    rewards: { xp: 150, iron: 500 },
  },
  {
    id: 'contract_standing_bounty',
    giver: 'halden',
    repeatable: true,
    prerequisites: { quests: ['c3_thin_the_herd'] },
    stages: [{ objectives: [{ type: 'defeat', target: 'any', count: 3 }], reportTo: 'halden' }],
    rewards: { xp: 250, iron: 2500 },
  },
];

export const CARGO: readonly CargoDefinition[] = [
  { id: 'hull_plating', questId: 'c1_salvage_rights', source: { type: 'collect', objectType: 'shipwreck', chance: 1 } },
  { id: 'sealed_dispatch', questId: 'c1_dispatch_to_meridian', source: { type: 'granted' } },
  { id: 'flight_recorder', questId: 'c2_voices_of_the_dead', source: { type: 'collect', objectType: 'shipwreck', chance: 1 } },
  { id: 'decoded_coordinates', questId: 'c2_the_trail', source: { type: 'granted' } },
  { id: 'horde_insignia', questId: 'c3_colours_of_the_horde', source: { type: 'defeat', target: 'marauder', chance: 1 } },
  { id: 'drone_core', questId: 'c3_rogue_signals', source: { type: 'defeat', target: 'drone', chance: 1 } },
  { id: 'battle_plans', questId: 'c4_war_council', source: { type: 'granted' } },
  { id: 'warlord_cipher', questId: 'c4_head_of_the_serpent', source: { type: 'defeat', target: 'warlord', chance: 1 } },
  { id: 'ore_sample', questId: 'side_tams_ore', source: { type: 'collect', objectType: 'asteroid', chance: 0.5 } },
];

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'rock_breaker', counter: 'asteroidsCollected', tiers: [{ threshold: 10, xp: 50 }, { threshold: 50, xp: 150 }, { threshold: 250, xp: 400 }] },
  { id: 'wreck_diver', counter: 'shipwrecksCollected', tiers: [{ threshold: 5, xp: 50 }, { threshold: 25, xp: 150 }, { threshold: 100, xp: 400 }] },
  { id: 'lifeline', counter: 'escapePodsCollected', tiers: [{ threshold: 3, xp: 50 }, { threshold: 15, xp: 150 }, { threshold: 50, xp: 400 }] },
  { id: 'horde_hunter', counter: 'npcsDefeated', tiers: [{ threshold: 1, xp: 100 }, { threshold: 10, xp: 300 }, { threshold: 50, xp: 800 }] },
  { id: 'ambush_breaker', counter: 'aggressorsDefeated', tiers: [{ threshold: 1, xp: 100 }, { threshold: 5, xp: 250 }, { threshold: 25, xp: 600 }] },
  { id: 'kingslayer', counter: 'warlordsDefeated', tiers: [{ threshold: 1, xp: 500 }] },
  { id: 'duelist', counter: 'pvpWins', tiers: [{ threshold: 1, xp: 100 }, { threshold: 5, xp: 300 }, { threshold: 25, xp: 800 }] },
  { id: 'trusted_hand', counter: 'questsCompleted', tiers: [{ threshold: 1, xp: 50 }, { threshold: 5, xp: 150 }, { threshold: 12, xp: 300 }, { threshold: 19, xp: 600 }] },
  { id: 'contractor', counter: 'contractsCompleted', tiers: [{ threshold: 3, xp: 100 }, { threshold: 10, xp: 250 }, { threshold: 30, xp: 600 }] },
  { id: 'saga', counter: 'chaptersCompleted', tiers: [{ threshold: 1, xp: 100 }, { threshold: 2, xp: 200 }, { threshold: 3, xp: 300 }, { threshold: 4, xp: 500 }] },
  { id: 'pathfinder', counter: 'locationsDiscovered', tiers: [{ threshold: 3, xp: 100 }, { threshold: 8, xp: 400 }] },
];

const QUESTS_BY_ID = new Map(QUESTS.map((quest) => [quest.id, quest]));
const CARGO_BY_ID = new Map(CARGO.map((cargo) => [cargo.id, cargo]));

export function getQuest(questId: string): QuestDefinition | undefined {
  return QUESTS_BY_ID.get(questId);
}

export function getCargo(cargoId: string): CargoDefinition | undefined {
  return CARGO_BY_ID.get(cargoId);
}
