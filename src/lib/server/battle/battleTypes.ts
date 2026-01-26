// ---
// Battle system type definitions - shared between client and server
// Contains:
//   - Battle state and stats interfaces
//   - Battle event types for logging
//   - DAMAGE_CALC_DEFAULTS constants for TechFactory.calculateWeaponDamage
//   - Database row mapping types for battleRepo
// ---

/**
 * Default damage calculation modifiers
 * These are used when calling TechFactory.calculateWeaponDamage
 * and can be adjusted for future game balance or special effects
 */
export const DAMAGE_CALC_DEFAULTS = {
  /** Bonus accuracy percentage (0-100+) from attacker's systems */
  POSITIVE_ACCURACY_MODIFIER: 0,
  /** Accuracy penalty as decimal (0-1) from target's evasion/agility */
  NEGATIVE_ACCURACY_MODIFIER: 0,
  /** Damage multiplier as decimal (e.g., 1.0 = 100%, 1.5 = 150%) */
  BASE_DAMAGE_MODIFIER: 1.0,
  /** ECM jamming effectiveness as decimal (0-1), affects guided weapons */
  ECM_EFFECTIVENESS: 0,
  /** Damage spread multiplier as decimal (e.g., 0.8-1.2 for randomization) */
  SPREAD_VALUE: 1.0
} as const;

export interface Battle {
  id: number;
  attackerId: number;
  attackeeId: number;
  battleStartTime: number;
  battleEndTime: number | null;
  winnerId: number | null;
  loserId: number | null;
  attackerWeaponCooldowns: WeaponCooldowns;
  attackeeWeaponCooldowns: WeaponCooldowns;
  attackerStartStats: BattleStats;
  attackeeStartStats: BattleStats;
  attackerEndStats: BattleStats | null;
  attackeeEndStats: BattleStats | null;
  battleLog: BattleEvent[];
  attackerTotalDamage: number;
  attackeeTotalDamage: number;
}

export interface WeaponCooldowns {
  [weaponType: string]: number; // timestamp of last fire
}

export interface BattleStats {
  hull: { current: number; max: number };
  armor: { current: number; max: number };
  shield: { current: number; max: number };
  weapons: {
    [weaponType: string]: {
      count: number;
      damage: number;
      cooldown: number;
    };
  };
}

export interface BattleEvent {
  timestamp: number;
  type: 'shot_fired' | 'damage_dealt' | 'shield_broken' | 'armor_broken' | 'hull_destroyed' | 'battle_started' | 'battle_ended';
  actor: 'attacker' | 'attackee';
  data: {
    weaponType?: string;
    damageDealt?: number;
    targetDefense?: 'shield' | 'armor' | 'hull';
    remainingValue?: number;
    message?: string;
    [key: string]: unknown;
  };
}

export type BattleState = 'not_in_battle' | 'in_battle';

// For database row mapping (used in battleRepo)
export interface BattleRow {
  id: number;
  attacker_id: number;
  attackee_id: number;
  battle_start_time: number;
  battle_end_time: number | null;
  winner_id: number | null;
  loser_id: number | null;
  attacker_weapon_cooldowns: string; // JSON
  attackee_weapon_cooldowns: string; // JSON
  attacker_start_stats: string; // JSON
  attackee_start_stats: string; // JSON
  attacker_end_stats: string | null; // JSON
  attackee_end_stats: string | null; // JSON
  battle_log: string; // JSON
  attacker_total_damage: number;
  attackee_total_damage: number;
}
