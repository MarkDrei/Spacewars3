// ---
// Texts derived from quest definitions (objectives, cargo sources), from the `quests` locale
// namespace. Used by the game UI and by the generated quest document (doc/quests.md).
// ---

import { getLocation } from './locations';
import type { CargoSource, QuestObjective } from './questTypes';

export type QuestTranslate = (key: string, params?: Record<string, string | number>) => string;

/** What an objective asks for, without the count ("Collect asteroids", "Fly to Azure Drift (300, 2700)"). */
export function objectiveText(t: QuestTranslate, objective: QuestObjective): string {
  switch (objective.type) {
    case 'collect':
      return t(`objectives.collect.${objective.objectType}`);
    case 'defeat':
      return objective.target === 'any'
        ? t('objectives.defeatAny')
        : t('objectives.defeat', { target: t(`hostiles.${objective.target}.name`) });
    case 'visit': {
      const location = getLocation(objective.locationId);
      return t('objectives.visit', {
        location: t(`locations.${objective.locationId}.name`),
        x: location.x,
        y: location.y,
      });
    }
    case 'gather':
      return t('objectives.gather', { cargo: t(`cargo.${objective.cargoId}.name`) });
  }
}

/** Where a cargo type comes from ("Found when salvaging shipwrecks (35% chance each)."). */
export function cargoSourceText(t: QuestTranslate, source: CargoSource): string {
  const chance = 'chance' in source ? Math.round(source.chance * 100) : 0;
  switch (source.type) {
    case 'granted':
      return t('cargoSource.granted');
    case 'collect':
      return t(`cargoSource.collect.${source.objectType}`, { chance });
    case 'defeat':
      return source.target === 'any'
        ? t('cargoSource.defeatAny', { chance })
        : t('cargoSource.defeat', { target: t(`hostiles.${source.target}.name`), chance });
  }
}
