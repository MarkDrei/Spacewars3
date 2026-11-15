# Development Plan: NPCs, Missions and Achievements

Branch: `feature/npc-quests` (based on `d2173eb`).

## Goal

Expand the rudimentary NPCs into a mission system: friendly contacts that give missions, aggressive and
passive hostile ships, more stations, mission items in the inventory, achievements and XP, a storyline
with multi-step missions, and a document that lists every mission for manual testing.

## Where to look

| What | Where |
| --- | --- |
| All missions, prerequisites, expected messages, manual test steps | [doc/quests.md](./quests.md) (generated: `npm run quest-doc`) |
| Requirements | [functional-requirements.md, Cap12](./functional-requirements.md#cap12-missions-contacts--npc-ships), test tools in Cap09_Feat005 |
| Architecture | [arc42, 5.2.6](./architecture/arc42-architecture.md#526-missions-contacts-and-npc-ships) |
| Known limitations | [TechnicalDebt.md](./TechnicalDebt.md) (entries of 2026-11-15) |
| Content (missions, cargo, achievements) | `src/shared/quests/questDefinitions.ts` |
| Contacts, hostile ships | `src/shared/quests/npcArchetypes.ts` |
| Locations, stations | `src/shared/quests/locations.ts`, `src/shared/starbases.ts` |
| Texts | `quests` namespace in `src/locales/en.json` and `de.json` |

## Completed

- [x] Three stations (Ironstrike Station, Meridian Observatory, Bastion Outpost), all with the starbase shop; same picture for all
- [x] Eight named locations, marked on the map; discovery pays XP
- [x] Hostile ships per player in four kinds: passive pirates, marauders and drones that attack only while a mission of the player targets them (ambush with grace period), mission-bound Warlord Krag
- [x] Four friendly contacts that circle stations/landmarks; hail by clicking the ship or from the mission tracker
- [x] Mission rules as a pure engine (`questEngine.ts`): accept, steps, objectives (collect, defeat, visit, cargo), report, abandon, rewards, repeatable contracts
- [x] 19 missions: 14 story missions in 4 chapters, 2 side missions, 3 contracts
- [x] Mission cargo in the inventory (stacked, protected against deleting/selling/bridge)
- [x] 11 achievements with tiers that pay XP
- [x] Server: `QuestService`, `QuestRepo`, table `quest_progress` with migration, `GET/POST /api/quests`, events from harvest, battles and the world poll
- [x] UI: Missions page (Active, Available, Story, Achievements, Sector), mission cards, hail panel, mission tracker on the game page, tooltips for contacts and aggressive ships, navigation entry, English and German texts
- [x] Developer test tools on the Missions page (`POST /api/admin/quests`): force accept, fulfil step, force report, reset, respawn hostile ships, jump to
- [x] Mission document `doc/quests.md`, generated from definitions, texts and the engine; a unit test fails when it is out of date
- [x] Tests: engine, cargo, texts, views, document, API routes (unit), mission flow against the database (integration)
- [x] Documentation: functional requirements, arc42, technical debt

## Open

- [ ] Review by Mark: what fits, what does not (content, texts, UI, balancing)
- [ ] Replace the station pictures when the additional images are in the repository
- [ ] UI tests for `QuestTracker`, `QuestCard` and the Missions page; unit test for `npcAmbush`
- [ ] Items of [TechnicalDebt.md](./TechnicalDebt.md): non-atomic mission effects, NPC state in memory only, visits and ambushes depend on the world poll

## Open decisions (balancing)

Numbers are first proposals. Totals: all missions once pay 7650 XP and 37400 iron plus 2 commanders; all achievement tiers pay 9300 XP (level 6 needs 15000 XP).

1. **Defeat against an NPC ship**: the player loses all iron aboard (rule of the existing NPC battles). Marauders and drones attack on their own only while a mission against them is active (decided 2026-11-15: no attacks without a related mission, because ships keep flying while their owner is offline). Keep the loss, reduce it to a share, or no loss after an ambush?
2. **Iron rewards and storage capacity**: mission iron above the storage capacity is lost (same as for selling and battle loot). The 10000 iron of "Head of the Serpent" can exceed a small storage. Keep, or hold back the rest?
3. **Victory iron of hostile ships**: 3000–10000 iron × ship level per victory, as before for the pirates. Marauders return after 20 minutes, drones after 15, the warlord after 10 while his mission is active — this can be farmed.
4. **Level-up brings back all hostile ships** (they are regenerated at the new level), a restart of the server as well.
5. **Level requirements**: chapter 3 needs level 2, chapter 4 level 3. The story XP before these chapters is enough to reach them without other XP sources.
6. **Ambush** (only during a mission against that ship kind): attack range 300 (marauder) / 220 (drone), 90 seconds grace after every NPC battle.
7. **Cargo finds**: 100 % for story cargo, 50 % for Tam's ore samples.
8. **Counting rule**: objectives only count while their step is active (a pirate defeated before accepting does not count).
