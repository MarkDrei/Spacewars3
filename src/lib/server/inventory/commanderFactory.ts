// ---
// Pure functions for generating random commanders from escape pods
// ---

import { Commander, CommanderStat, CommanderStatType } from '../../../shared/src/types/inventory';

/**
 * Space-themed commander names for random selection
 */
const COMMANDER_NAMES = [
  'Captain Nova',
  'Admiral Cosmos',
  'Lieutenant Storm',
  'Commander Stellar',
  'Major Nebula',
  'Colonel Vortex',
  'Captain Eclipse',
  'Admiral Phoenix',
  'Lieutenant Comet',
  'Commander Aurora',
  'Major Quasar',
  'Colonel Titan',
  'Captain Orion',
  'Admiral Sirius',
  'Lieutenant Astro',
  'Commander Zenith',
  'Major Pulsar',
  'Colonel Galaxy',
  'Captain Meteor',
  'Admiral Helios',
  'Lieutenant Lunar',
  'Commander Solaris',
  'Major Starlight',
  'Colonel Rocket',
  'Captain Thunder',
  'Admiral Horizon',
  'Lieutenant Cosmos',
  'Commander Voyager',
  'Major Odyssey',
  'Colonel Celestial',
];

/**
 * All available stat types that commanders can have
 */
const ALL_STAT_TYPES: CommanderStatType[] = [
  'shipSpeed',
  'projectileDamage',
  'projectileReloadRate',
  'projectileAccuracy',
  'energyDamage',
  'energyReloadRate',
  'energyAccuracy',
];

/**
 * Generate a random commander with random stats.
 * - UUID generated with crypto.randomUUID()
 * - Name randomly selected from predefined list
 * - 1-3 stats: 60% chance of 1, 30% chance of 2, 10% chance of 3
 * - Each stat has random type (no duplicates) and bonusPercent (10-100)
 * @returns A randomly generated commander
 */
export function generateCommander(): Commander {
  // Generate unique ID
  const id = crypto.randomUUID();

  // Select random name
  const name = COMMANDER_NAMES[Math.floor(Math.random() * COMMANDER_NAMES.length)];

  // Determine number of stats (1-3 with weighted probabilities)
  const rand = Math.random();
  let statCount: number;
  if (rand < 0.6) {
    statCount = 1; // 60% chance
  } else if (rand < 0.9) {
    statCount = 2; // 30% chance
  } else {
    statCount = 3; // 10% chance
  }

  // Generate unique random stats
  const stats: CommanderStat[] = [];
  const usedStatTypes = new Set<CommanderStatType>();

  for (let i = 0; i < statCount; i++) {
    // Pick a random stat type that hasn't been used
    let statType: CommanderStatType;
    do {
      statType = ALL_STAT_TYPES[Math.floor(Math.random() * ALL_STAT_TYPES.length)];
    } while (usedStatTypes.has(statType));
    usedStatTypes.add(statType);

    // Generate random bonus percentage (10-100, rounded to integer)
    const bonusPercent = Math.floor(Math.random() * (100 - 10 + 1)) + 10;

    stats.push({ statType, bonusPercent });
  }

  return { id, name, stats };
}

/**
 * Attempt to generate a commander from an escape pod collection.
 * 90% chance to generate a commander, 10% chance to return null (no survivors).
 * @returns A commander if successful, null if no survivors found
 */
export function tryGenerateCommanderFromEscapePod(): Commander | null {
  const rand = Math.random();
  if (rand < 0.9) {
    // 90% chance: commander generated
    return generateCommander();
  } else {
    // 10% chance: no commander
    return null;
  }
}
