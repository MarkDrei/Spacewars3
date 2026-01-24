// ---
// Battle system type definitions - shared between client and server
// Includes:
//   - Battle, BattleStats, BattleEvent interfaces
//   - DAMAGE_CALC_DEFAULTS constants for TechFactory.calculateWeaponDamage
//   - Database row mapping types for battleRepo
// ---

/**
 * Default damage calculation modifiers used with TechFactory.calculateWeaponDamage.
 * These values can be adjusted for future game balance or special effects.
 * 
 * Parameter details:
 * - POSITIVE_ACCURACY_MODIFIER: Added to weapon's baseAccuracy percentage (e.g., 10 = +10% accuracy)
 * - NEGATIVE_ACCURACY_MODIFIER: Decimal multiplier reducing accuracy (e.g., 0.2 = 20% accuracy reduction)
 * - BASE_DAMAGE_MODIFIER: Decimal damage multiplier (e.g., 1.0 = 100% normal damage, 1.5 = 150% damage)
 * - ECM_EFFECTIVENESS: Decimal ECM effectiveness vs guided weapons (e.g., 0.5 = 50% less likely to hit)
 * - SPREAD_VALUE: Decimal hit randomization multiplier (e.g., 1.0 = normal hit calculation)
 */
export const DAMAGE_CALC_DEFAULTS = {
  /** Added to weapon's baseAccuracy percentage (e.g., 10 = +10% accuracy bonus) */
  POSITIVE_ACCURACY_MODIFIER: 0,
  /** Decimal reducing accuracy via multiplication (e.g., 0.2 = 20% accuracy reduction) */
  NEGATIVE_ACCURACY_MODIFIER: 0,
  /** Decimal damage multiplier (e.g., 1.0 = 100% normal damage, 1.5 = 150% damage) */
  BASE_DAMAGE_MODIFIER: 1.0,
  /** Decimal ECM effectiveness vs guided weapons (e.g., 0.5 = rockets 50% less likely to hit) */
  ECM_EFFECTIVENESS: 0,
  /** Decimal hit randomization multiplier (e.g., 1.0 = normal hit calculation) */
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
