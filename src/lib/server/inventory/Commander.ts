// ---
// Commander - A crew member item that provides bonuses to ship stats
// ---

export type CommanderStatKey =
  | 'shipSpeed'
  | 'projectileWeaponDamage'
  | 'projectileWeaponReloadRate'
  | 'projectileWeaponAccuracy'
  | 'energyWeaponDamage'
  | 'energyWeaponReloadRate'
  | 'energyWeaponAccuracy';

export const COMMANDER_STAT_KEYS: CommanderStatKey[] = [
  'shipSpeed',
  'projectileWeaponDamage',
  'projectileWeaponReloadRate',
  'projectileWeaponAccuracy',
  'energyWeaponDamage',
  'energyWeaponReloadRate',
  'energyWeaponAccuracy',
];

/**
 * A stat bonus for a single stat, value in percent (0.1 .. 1.0).
 */
export interface CommanderStatBonus {
  stat: CommanderStatKey;
  /** Bonus percentage, e.g. 0.3 means +0.3% */
  value: number;
}

export interface CommanderData {
  readonly itemType: 'commander';
  readonly name: string;
  /** One to three stat bonuses */
  readonly statBonuses: CommanderStatBonus[];
}

/**
 * Immutable Commander value object.
 *
 * Use the static factory methods to create instances:
 *  - `Commander.withStats(name, bonuses)` – explicit construction
 *  - `Commander.random(name?)` – randomly determined stats
 */
export class Commander {
  readonly itemType = 'commander' as const;
  readonly name: string;
  readonly statBonuses: ReadonlyArray<CommanderStatBonus>;

  private constructor(name: string, statBonuses: CommanderStatBonus[]) {
    this.name = name;
    this.statBonuses = Object.freeze([...statBonuses]);
  }

  // ---------------------------------------------------------------------------
  // Factory methods
  // ---------------------------------------------------------------------------

  /**
   * Create a commander with explicitly provided stats.
   * @param name    Display name of the commander.
   * @param bonuses 1–3 stat bonuses. Throws if out of range or values invalid.
   */
  static withStats(name: string, bonuses: CommanderStatBonus[]): Commander {
    if (bonuses.length < 1 || bonuses.length > 3) {
      throw new Error(`Commander must have 1–3 stat bonuses, got ${bonuses.length}`);
    }
    for (const bonus of bonuses) {
      const rounded = Math.round(bonus.value * 10) / 10;
      if (rounded < 0.1 || rounded > 1.0) {
        throw new Error(`Stat bonus value must be between 0.1 and 1.0, got ${bonus.value}`);
      }
    }
    return new Commander(name, bonuses.map(b => ({ ...b, value: Math.round(b.value * 10) / 10 })));
  }

  /**
   * Create a commander with randomly determined stats.
   *
   * Number of stats:
   *   - 1 stat: 60% chance
   *   - 2 stats: 30% chance
   *   - 3 stats: 10% chance
   *
   * Each stat value is uniform over {0.1, 0.2, …, 1.0}.
   * Stats are chosen without replacement from the available stat pool.
   *
   * @param name Optional display name. Defaults to "Commander".
   * @param rng  Optional random-number generator (returns [0,1)). Defaults to Math.random.
   */
  static random(name = 'Commander', rng: () => number = Math.random): Commander {
    const statCount = Commander.rollStatCount(rng);
    const chosenStats = Commander.sampleStats(statCount, rng);
    const bonuses: CommanderStatBonus[] = chosenStats.map(stat => ({
      stat,
      value: Commander.rollStatValue(rng),
    }));
    return new Commander(name, bonuses);
  }

  // ---------------------------------------------------------------------------
  // Serialisation helpers
  // ---------------------------------------------------------------------------

  toJSON(): CommanderData {
    return {
      itemType: 'commander',
      name: this.name,
      statBonuses: [...this.statBonuses],
    };
  }

  static fromJSON(data: CommanderData): Commander {
    if (data.itemType !== 'commander') {
      throw new Error(`Expected itemType 'commander', got '${data.itemType}'`);
    }
    return Commander.withStats(data.name, data.statBonuses);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Roll the number of stats. 60% → 1, 30% → 2, 10% → 3 */
  private static rollStatCount(rng: () => number): number {
    const roll = rng();
    if (roll < 0.6) return 1;
    if (roll < 0.9) return 2;
    return 3;
  }

  /** Roll a stat value uniformly from {0.1, 0.2, …, 1.0} */
  private static rollStatValue(rng: () => number): number {
    // 10 equally-spaced steps: floor(rng * 10) gives 0-9, +1 gives 1-10, /10 gives 0.1-1.0
    return (Math.floor(rng() * 10) + 1) / 10;
  }

  /** Sample `count` distinct stats from the pool without replacement */
  private static sampleStats(count: number, rng: () => number): CommanderStatKey[] {
    const pool = [...COMMANDER_STAT_KEYS];
    const result: CommanderStatKey[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rng() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }
}
