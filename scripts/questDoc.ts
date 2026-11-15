// ---
// Renders doc/quests.md: reference and manual test guide of the mission system.
// Pure function of the quest definitions and the `quests` locale namespace, so a unit test can
// check that the committed document is up to date. Written to disk by generate-quest-doc.ts.
// The expected messages of each mission are produced by playing it with the quest engine.
// ---

import { LOCATIONS, LOCATION_DISCOVERY_XP, getLocation, type LocationId } from '../src/shared/quests/locations.js';
import {
  AMBUSH_GRACE_MS,
  CONTACTS,
  HAIL_RANGE,
  HOSTILE_ARCHETYPES,
  HOSTILE_ARCHETYPE_IDS,
  getContact,
  type ContactId,
  type HostileArchetype,
} from '../src/shared/quests/npcArchetypes.js';
import { ACHIEVEMENTS, CARGO, QUESTS, STORY_CHAPTERS, getCargo } from '../src/shared/quests/questDefinitions.js';
import {
  acceptQuest,
  createInitialQuestState,
  debugFulfilStage,
  debugUnlockPrerequisites,
  isStageComplete,
  reportQuest,
  type QuestContext,
} from '../src/shared/quests/questEngine.js';
import { questNotificationText } from '../src/shared/quests/questMessages.js';
import { cargoSourceText, objectiveText, type QuestTranslate } from '../src/shared/quests/questTexts.js';
import type {
  CargoHold,
  CargoStack,
  PlayerQuestState,
  QuestDefinition,
  QuestEngineResult,
  QuestObjective,
  QuestStage,
} from '../src/shared/quests/questTypes.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

type Texts = QuestTranslate;

const SIDE_QUESTS = QUESTS.filter((quest) => quest.chapter === undefined && !quest.repeatable);
const CONTRACTS = QUESTS.filter((quest) => quest.repeatable);

function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];
}

function title(t: Texts, questId: string): string {
  return t(`quest.${questId}.title`);
}

function questRef(t: Texts, questId: string): string {
  return `${title(t, questId)} (\`${questId}\`)`;
}

function place(t: Texts, locationId: LocationId): string {
  const location = getLocation(locationId);
  return `${t(`locations.${locationId}.name`)} (${location.x}, ${location.y})`;
}

function contactName(t: Texts, contactId: ContactId): string {
  return t(`contacts.${contactId}.name`);
}

/** "Quartermaster Vess — ISV Ledger, near Ironstrike Station (4000, 4000)" */
function contactWhere(t: Texts, contactId: ContactId): string {
  const contact = getContact(contactId);
  return `${contactName(t, contactId)} — ${contact.shipName}, near ${place(t, contact.home)}`;
}

function stacks(t: Texts, cargo: readonly CargoStack[]): string {
  return cargo.map((stack) => `${stack.quantity}× ${t(`cargo.${stack.cargoId}.name`)}`).join(', ');
}

function rewards(quest: QuestDefinition): string {
  const parts = [`${quest.rewards.xp} XP`];
  if (quest.rewards.iron > 0) parts.push(`${quest.rewards.iron} iron`);
  if (quest.rewards.commander) parts.push('a random commander');
  return parts.join(', ');
}

function questType(quest: QuestDefinition): string {
  if (quest.repeatable) return 'Contract (repeatable)';
  return quest.chapter === undefined ? 'Side mission' : `Story, chapter ${quest.chapter}`;
}

function requirements(t: Texts, quest: QuestDefinition): string {
  const parts = quest.prerequisites.quests.map((questId) => questRef(t, questId));
  if (quest.prerequisites.minLevel !== undefined) parts.push(`player level ${quest.prerequisites.minLevel}`);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function unlockedBy(questId: string): QuestDefinition[] {
  return QUESTS.filter((quest) => quest.prerequisites.quests.includes(questId));
}

function behaviour(archetype: HostileArchetype): string {
  return archetype.aggressive
    ? `attacks a player ship within ${archetype.aggroRadius} of it`
    : 'never attacks first';
}

function respawn(archetype: HostileArchetype): string {
  return archetype.respawnMinutes === null ? 'at midnight (UTC)' : `${archetype.respawnMinutes} min after its defeat`;
}

function levelOffsets(archetype: HostileArchetype): string {
  return archetype.spawns
    .map((spawn) => (spawn.levelOffset === 0 ? '±0' : spawn.levelOffset > 0 ? `+${spawn.levelOffset}` : `−${-spawn.levelOffset}`))
    .join(', ');
}

/** Message text without the type prefix of the message system ("P: ", "N: ", "A: "). */
function message(text: string): string {
  return `“${text.replace(/^[PNA]: /, '')}”`;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

/** What the tester has to do for an objective, with the facts needed to do it. */
function objectiveHowTo(t: Texts, objective: QuestObjective, stage: QuestStage): string {
  const text = objectiveText(t, objective);
  switch (objective.type) {
    case 'collect':
      return `${text} ×${objective.count}`;
    case 'defeat': {
      if (objective.target === 'any') return `${text} ×${objective.count}`;
      const archetype = HOSTILE_ARCHETYPES[objective.target];
      return `${text} ×${objective.count} — circles ${place(t, archetype.home)} at a distance of ${archetype.orbitRadius}, ${behaviour(archetype)}`;
    }
    case 'visit':
      return `${text} — counts within ${getLocation(objective.locationId).radius} of the centre, with the game page open`;
    case 'gather': {
      const granted = (stage.grants ?? []).some((grant) => grant.cargoId === objective.cargoId);
      const source = getCargo(objective.cargoId)?.source;
      const origin = granted || !source ? 'handed over with this step' : cargoSourceText(t, source);
      return `${text} ×${objective.count} — ${origin}`;
    }
  }
}

function objectiveShort(t: Texts, objective: QuestObjective): string {
  const text = objectiveText(t, objective);
  return objective.type === 'visit' ? text : `${text} ×${objective.count}`;
}

// ---------------------------------------------------------------------------
// Walkthrough: the mission played with the quest engine
// ---------------------------------------------------------------------------

interface WalkthroughRow {
  action: string;
  shortcut: string;
  expected: string[];
}

function applyCargo(hold: CargoHold, result: QuestEngineResult): void {
  for (const stack of result.effects.cargoAdd) {
    if (!hold.counts[stack.cargoId]) hold.freeSlots -= 1;
    hold.counts[stack.cargoId] = (hold.counts[stack.cargoId] ?? 0) + stack.quantity;
  }
  for (const stack of result.effects.cargoRemove) {
    const left = (hold.counts[stack.cargoId] ?? 0) - stack.quantity;
    if (left > 0) {
      hold.counts[stack.cargoId] = left;
    } else {
      delete hold.counts[stack.cargoId];
      hold.freeSlots += 1;
    }
  }
}

/** Messages and inventory changes of an engine result (achievements depend on the account's history). */
function outcome(t: Texts, result: QuestEngineResult, showAddedCargo: boolean): string[] {
  const lines = result.effects.notifications
    .filter((notification) => notification.kind !== 'achievementUnlocked')
    .map((notification) => `Message ${message(questNotificationText(t, notification))}`);
  if (showAddedCargo && result.effects.cargoAdd.length > 0) {
    lines.push(`Inventory: + ${stacks(t, result.effects.cargoAdd)}`);
  }
  if (result.effects.cargoRemove.length > 0) {
    lines.push(`Inventory: − ${stacks(t, result.effects.cargoRemove)}`);
  }
  if (result.effects.commanders > 0) {
    lines.push('Inventory: + a random commander (needs a free slot)');
  }
  return lines;
}

/**
 * Plays a mission from accepting it to its completion and records what the player has to do and
 * what the game answers. Steps whose objectives are already fulfilled when they start only need
 * the report.
 */
function walkthrough(t: Texts, quest: QuestDefinition): WalkthroughRow[] {
  const hold: CargoHold = { counts: {}, freeSlots: 20 };
  const ctx = (): QuestContext => ({
    now: 0,
    level: 99,
    cargo: hold,
    contactsInRange: CONTACTS.map((contact) => contact.id),
    rng: () => 0,
  });
  const play = (result: QuestEngineResult): QuestEngineResult => {
    applyCargo(hold, result);
    return result;
  };

  let state: PlayerQuestState = play(debugUnlockPrerequisites(createInitialQuestState(), quest.id, ctx())).state;
  const rows: WalkthroughRow[] = [];

  const accepted = play(acceptQuest(state, quest.id, ctx()));
  state = accepted.state;
  rows.push({
    action: `Fly within ${HAIL_RANGE} of the ${getContact(quest.giver).shipName}, hail ${contactName(t, quest.giver)} and accept the mission`,
    shortcut: 'Force accept',
    expected: outcome(t, accepted, true),
  });

  while (state.quests[quest.id].status === 'active') {
    const stageIndex = state.quests[quest.id].stage;
    const stage = quest.stages[stageIndex];
    const step = `Step ${stageIndex + 1}`;

    if (!isStageComplete(state, quest, hold)) {
      const fulfilled = play(debugFulfilStage(state, quest.id, ctx()));
      state = fulfilled.state;
      rows.push({
        action: `${step}: ${stage.objectives.map((objective) => objectiveHowTo(t, objective, stage)).join('; ')}`,
        shortcut: 'Fulfil step',
        expected: outcome(t, fulfilled, false),
      });
      if (!stage.reportTo) continue;
    }

    const reportTo = stage.reportTo;
    if (!reportTo) throw new Error(`Step ${stageIndex + 1} of ${quest.id} can neither be fulfilled nor reported`);
    const reported = play(reportQuest(state, quest.id, reportTo, ctx()));
    state = reported.state;
    rows.push({
      action: `${step}: fly within ${HAIL_RANGE} of the ${getContact(reportTo).shipName} and report to ${contactName(t, reportTo)}`,
      shortcut: 'Force report',
      expected: outcome(t, reported, true),
    });
  }

  const unlocks = unlockedBy(quest.id);
  if (unlocks.length > 0) {
    rows[rows.length - 1].expected.push(
      `Now on offer (if their other requirements are met): ${unlocks.map((unlocked) => title(t, unlocked.id)).join(', ')}`
    );
  }
  if (quest.repeatable) {
    rows[rows.length - 1].expected.push('The contract is on offer again');
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function intro(): string[] {
  return [
    '# Missions — reference and manual test guide',
    '',
    '> Generated by `npm run quest-doc` from the definitions in `src/shared/quests/` and the English texts in',
    '> `src/locales/en.json` (namespace `quests`). Do not edit this file by hand: change the definitions and run',
    '> the generator again. The unit test `src/__tests__/unit/quests/questDoc.test.ts` fails when the file is out of date.',
    '',
    `The game has ${QUESTS.length} missions: ${QUESTS.length - SIDE_QUESTS.length - CONTRACTS.length} story missions in ${STORY_CHAPTERS.length} chapters, ${SIDE_QUESTS.length} side missions and ${CONTRACTS.length} repeatable contracts, offered by ${CONTACTS.length} contacts. On top of that there are ${ACHIEVEMENTS.length} achievements and ${LOCATIONS.length} locations to discover.`,
    '',
    '## Contents',
    '',
    '1. [How missions work](#1-how-missions-work)',
    '2. [Test tools](#2-test-tools)',
    '3. [Overview](#3-overview)',
    '4. [The sector](#4-the-sector)',
    '5. [Missions in detail](#5-missions-in-detail)',
    '6. [Achievements](#6-achievements)',
    '',
  ];
}

function rules(): string[] {
  return [
    '## 1. How missions work',
    '',
    `- **Contacts** are friendly ships that circle a station or landmark. A contact can be hailed while the player's ship is within ${HAIL_RANGE} of the contact's ship: click the ship on the map (touch devices: tap it again when the tooltip says “tap again to hail”), or use the hail button of the mission tracker on the game page. Hailing opens the Missions page (\`/missions\`) with the contact's offers and open reports. Contacts cannot be attacked.`,
    '- **Accepting** a mission needs its giver in hailing range, all required missions completed and, for some missions, a minimum player level. Any number of missions can be active at the same time.',
    '- A mission consists of one or more **steps**. A step lists objectives and usually a contact to report to. A step without a contact finishes by itself as soon as its objectives are fulfilled; otherwise the player has to hail the contact and report in. The contact of a step is not always the giver of the mission.',
    '- **Objectives**: collect asteroids / shipwrecks / escape pods, defeat hostile NPC ships, fly to a location, or have mission cargo aboard. Counters only count while the step is active — a pirate defeated before accepting the mission does not count.',
    '- **Mission cargo** lies in the ship inventory, one stack (one slot) per cargo type. It is either handed over by a contact or found while the step that asks for it is active. It cannot be discarded or sold, is handed over when the step is reported and is removed when the mission is abandoned. If the inventory is full, a find is lost and the player is told to free a slot.',
    '- **Locations** are visited by flying within their radius while the game page is open (the check runs with the regular world update, not while the player is in a battle).',
    `- Visiting a location for the first time discovers it and is worth ${LOCATION_DISCOVERY_XP} XP, with or without a mission.`,
    '- **Rewards** are paid when the last step is reported: XP, iron (limited by the iron storage capacity — iron above the capacity is lost) and sometimes a random commander, which needs a free inventory slot at that moment.',
    '- **Abandoning** an active mission deletes its progress and its cargo. It can be accepted again from its giver.',
    '- **Contracts** are repeatable: after completion they are on offer again.',
    `- **Hostile ships** exist once per player; other players do not see or fight them. Aggressive ships open fire on a player ship that comes within their attack range. After every battle against an NPC ship the player is safe from ambushes for ${AMBUSH_GRACE_MS / 1000} seconds. A player who loses against an NPC ship loses all iron aboard.`,
    '- Every change (accepted, step finished, cargo found, location discovered, achievement unlocked, ambush) is sent to the player as a message. The Missions page also shows the answer to an action directly, and the contact\'s closing words when a mission is completed.',
    '',
  ];
}

function testTools(): string[] {
  return [
    '## 2. Test tools',
    '',
    'Developer accounts (see `src/shared/adminAccess.ts`) get shortcuts on the Missions page, so a mission can be tested without playing everything before it. They call `POST /api/admin/quests`.',
    '',
    ...table(
      ['Tool', 'Where', 'What it does'],
      [
        ['Force accept', 'Mission card (missions that are not active)', 'Marks all required missions as completed (without their XP, iron or commander; they count for the achievements) and accepts the mission, regardless of player level and distance to the giver. A completed story or side mission cannot be accepted again — reset first.'],
        ['Fulfil step', 'Mission card (active missions)', 'Fulfils the objectives of the current step: counters are set to their target and missing mission cargo is put into the inventory. A step with a contact still has to be reported.'],
        ['Force report', 'Mission card (active missions)', 'Fulfils the current step and reports it to its contact from any distance. Click it once per step to walk through a mission; the last click pays the reward.'],
        ['Reset all mission progress', '“🛠 Test tools (developers only)”, a collapsed box at the top of the Missions page', 'Deletes all missions, counters, achievements, discovered locations and mission cargo of the account. XP, iron and commanders that were already paid stay.'],
        ['Respawn hostile ships', 'Test tools', 'Brings back all defeated hostile ships of the account. Not possible while one of them is in a battle.'],
        ['Jump to', 'Test tools', 'Puts the ship next to a contact or into the centre of a location and stops it. Not possible during a battle. Jumping to Horde’s Reach or the Anvil Graveyard lands inside the patrols.'],
      ]
    ),
    '',
    'A typical test of one mission: **Reset** (optional) → **Force accept** on the mission card (Story tab) → play the step or click **Fulfil step** → fly to the contact (or **Jump to**) and report, or click **Force report**. The tables in [section 5](#5-missions-in-detail) list both ways for every mission.',
    '',
    'The level requirement only applies to the normal “Accept mission” button. The seeded developer account `a` (password `a`) can be used on a development system.',
    '',
  ];
}

function mermaidNode(t: Texts, quest: QuestDefinition): string {
  const level = quest.prerequisites.minLevel !== undefined ? `<br/>level ${quest.prerequisites.minLevel}` : '';
  return `    ${quest.id}["${title(t, quest.id)}${level}"]`;
}

function overview(t: Texts): string[] {
  const groups: { label: string; quests: QuestDefinition[] }[] = [
    ...STORY_CHAPTERS.map((chapter) => ({
      label: `Chapter ${chapter} — ${t(`chapters.${chapter}.title`)}`,
      quests: QUESTS.filter((quest) => quest.chapter === chapter),
    })),
    { label: 'Side missions', quests: SIDE_QUESTS },
    { label: 'Contracts (repeatable)', quests: CONTRACTS },
  ];

  const graph = ['```mermaid', 'graph TD'];
  groups.forEach((group, index) => {
    graph.push(`  subgraph g${index}["${group.label}"]`, ...group.quests.map((quest) => mermaidNode(t, quest)), '  end');
  });
  for (const quest of QUESTS) {
    for (const prerequisite of quest.prerequisites.quests) {
      graph.push(`  ${prerequisite} --> ${quest.id}`);
    }
  }
  graph.push('```');

  return [
    '## 3. Overview',
    '',
    '### Dependencies',
    '',
    'An arrow means “must be completed before”. A mission with several incoming arrows needs all of them.',
    '',
    ...graph,
    '',
    '### All missions',
    '',
    'In an order in which they can be played. The checkbox column is for a manual test run.',
    '',
    ...table(
      ['Tested', 'Mission', 'Type', 'Giver', 'Requires', 'Steps', 'Reward'],
      QUESTS.map((quest) => [
        '☐',
        `[${title(t, quest.id)}](#${anchor(quest)})`,
        questType(quest),
        contactName(t, quest.giver),
        quest.prerequisites.quests.map((questId) => title(t, questId)).join(', ') +
          (quest.prerequisites.minLevel !== undefined
            ? `${quest.prerequisites.quests.length > 0 ? ', ' : ''}level ${quest.prerequisites.minLevel}`
            : '') || '—',
        String(quest.stages.length),
        rewards(quest),
      ])
    ),
    '',
    `Total of all missions completed once: ${QUESTS.reduce((sum, quest) => sum + quest.rewards.xp, 0)} XP and ${QUESTS.reduce((sum, quest) => sum + quest.rewards.iron, 0)} iron, plus ${QUESTS.filter((quest) => quest.rewards.commander).length} commanders.`,
    '',
  ];
}

function sector(t: Texts): string[] {
  return [
    '## 4. The sector',
    '',
    '### Contacts',
    '',
    ...table(
      ['Contact', 'Role', 'Ship', 'Circles', 'Orbit radius', 'Offers'],
      CONTACTS.map((contact) => [
        `${contactName(t, contact.id)} (\`${contact.id}\`)`,
        t(`contacts.${contact.id}.role`),
        contact.shipName,
        place(t, contact.home),
        String(contact.orbitRadius),
        QUESTS.filter((quest) => quest.giver === contact.id)
          .map((quest) => title(t, quest.id))
          .join(', '),
      ])
    ),
    '',
    '### Locations',
    '',
    ...table(
      ['Location', 'Kind', 'Position', 'Radius', 'Description'],
      LOCATIONS.map((location) => [
        `${t(`locations.${location.id}.name`)} (\`${location.id}\`)`,
        location.kind.replace('_', ' '),
        `(${location.x}, ${location.y})`,
        String(location.radius),
        t(`locations.${location.id}.description`),
      ])
    ),
    '',
    'The three stations are starbases: the ship can dock there and trade commanders. All stations use the same picture for now.',
    '',
    '### Hostile ships',
    '',
    'Each player has their own set. The level of a ship is the player level plus the listed offset (at least 1).',
    '',
    ...table(
      ['Ship', 'Behaviour', 'Circles', 'Orbit radius', 'Ships (level offset)', 'Strength', 'Iron for a victory', 'Returns'],
      HOSTILE_ARCHETYPE_IDS.map((id) => {
        const archetype = HOSTILE_ARCHETYPES[id];
        return [
          `${t(`hostiles.${id}.name`)} (\`${id}\`)`,
          (archetype.aggressive ? `Aggressive: ${behaviour(archetype)}` : 'Passive: never attacks first') +
            (archetype.questBound ? '. Only present while an active mission step asks for it' : ''),
          place(t, archetype.home),
          String(archetype.orbitRadius),
          `${archetype.spawns.length} (${levelOffsets(archetype)})`,
          `×${archetype.strength}`,
          `${archetype.ironPerLevel} × ship level`,
          respawn(archetype),
        ];
      })
    ),
    '',
    '### Mission cargo',
    '',
    ...table(
      ['Cargo', 'Mission', 'Source', 'Description'],
      CARGO.map((cargo) => [
        `${t(`cargo.${cargo.id}.name`)} (\`${cargo.id}\`)`,
        title(t, cargo.questId),
        cargoSourceText(t, cargo.source),
        t(`cargo.${cargo.id}.description`),
      ])
    ),
    '',
  ];
}

function anchor(quest: QuestDefinition): string {
  return quest.id;
}

function questSection(t: Texts, quest: QuestDefinition): string[] {
  const unlocks = unlockedBy(quest.id);
  const cargo = CARGO.filter((definition) => definition.questId === quest.id);
  return [
    `<a id="${anchor(quest)}"></a>`,
    '',
    `#### ${questRef(t, quest.id)}`,
    '',
    ...table(
      ['', ''],
      [
        ['Type', questType(quest)],
        ['Offered by', contactWhere(t, quest.giver)],
        ['Requires', requirements(t, quest)],
        ['Unlocks', unlocks.length > 0 ? unlocks.map((unlocked) => title(t, unlocked.id)).join(', ') : '—'],
        ['Reward', rewards(quest)],
        ...(cargo.length > 0
          ? [['Mission cargo', cargo.map((definition) => `${t(`cargo.${definition.id}.name`)}: ${cargoSourceText(t, definition.source)}`).join(' ')]]
          : []),
      ]
    ),
    '',
    `Offer: *${t(`quest.${quest.id}.offer`)}*`,
    '',
    ...table(
      ['Step', 'Briefing', 'Objectives', 'Handed over at the start', 'Finished by'],
      quest.stages.map((stage, index) => [
        String(index + 1),
        t(`quest.${quest.id}.stages.${index + 1}`),
        stage.objectives.length > 0 ? stage.objectives.map((objective) => objectiveShort(t, objective)).join('; ') : '—',
        stage.grants && stage.grants.length > 0 ? stacks(t, stage.grants) : '—',
        stage.reportTo ? `report to ${contactName(t, stage.reportTo)}` : 'objectives fulfilled (no report)',
      ])
    ),
    '',
    `Completion: *${t(`quest.${quest.id}.completion`)}*`,
    '',
    '**Manual test**',
    '',
    ...table(
      ['#', 'Action', 'Shortcut', 'Expected'],
      walkthrough(t, quest).map((row, index) => [String(index + 1), row.action, row.shortcut, row.expected.join('<br/>') || '—'])
    ),
    '',
  ];
}

function missions(t: Texts): string[] {
  const lines = [
    '## 5. Missions in detail',
    '',
    'Each mission has a table “Manual test”: the actions of a normal playthrough, the test tool that replaces the action, and what the game answers. The expected messages are produced by the game rules themselves. In a real playthrough additional messages can appear: every piece of mission cargo found, locations discovered on the way and achievements.',
    '',
  ];
  for (const chapter of STORY_CHAPTERS) {
    lines.push(`### Chapter ${chapter} — ${t(`chapters.${chapter}.title`)}`, '', t(`chapters.${chapter}.summary`), '');
    for (const quest of QUESTS.filter((candidate) => candidate.chapter === chapter)) {
      lines.push(...questSection(t, quest));
    }
  }
  lines.push('### Side missions', '', t('ui.sideQuestsSummary'), '');
  for (const quest of SIDE_QUESTS) lines.push(...questSection(t, quest));
  lines.push('### Contracts', '', t('ui.contractsSummary'), '');
  for (const quest of CONTRACTS) lines.push(...questSection(t, quest));
  return lines;
}

const COUNTER_TEXT: Record<(typeof ACHIEVEMENTS)[number]['counter'], string> = {
  asteroidsCollected: 'asteroids collected',
  shipwrecksCollected: 'shipwrecks salvaged',
  escapePodsCollected: 'escape pods recovered',
  npcsDefeated: 'hostile NPC ships defeated',
  aggressorsDefeated: 'aggressive NPC ships defeated',
  warlordsDefeated: 'victories over Warlord Krag',
  pvpWins: 'battles won against other players',
  questsCompleted: 'different missions completed (a contract counts once)',
  contractsCompleted: 'contracts completed (every completion counts)',
  chaptersCompleted: 'story chapters with all missions completed',
  locationsDiscovered: 'locations discovered',
};

function achievements(t: Texts): string[] {
  return [
    '## 6. Achievements',
    '',
    'An achievement has one or more tiers. A tier unlocks when its counter reaches the threshold and pays XP once. The counters run independently of missions. Achievements are listed on the Missions page (tab “Achievements”).',
    '',
    ...table(
      ['Achievement', 'Counts', 'Tiers (threshold → XP)'],
      ACHIEVEMENTS.map((achievement) => [
        `${t(`achievements.${achievement.id}.name`)} (\`${achievement.id}\`)`,
        COUNTER_TEXT[achievement.counter],
        achievement.tiers.map((tier) => `${tier.threshold} → ${tier.xp} XP`).join(', '),
      ])
    ),
    '',
    `All tiers together: ${ACHIEVEMENTS.reduce((sum, achievement) => sum + achievement.tiers.reduce((xp, tier) => xp + tier.xp, 0), 0)} XP.`,
    '',
    'Testing: the counters for collecting, victories and discoveries only rise with the real event — “Fulfil step” fulfils an objective without touching them. Missions completed with the test tools (“Force report”, and the prerequisites completed by “Force accept”) count for “Trusted Hand”, “Contractor” and “Saga”.',
    '',
  ];
}

/** The whole document; `t` translates in the `quests` namespace of the English locale. */
export function renderQuestDoc(t: QuestTranslate): string {
  return [...intro(), ...rules(), ...testTools(), ...overview(t), ...sector(t), ...missions(t), ...achievements(t)].join('\n');
}
