// ---
// Battle system type definitions - shared between client and server
// ---

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

/**
 * Default parameters for TechFactory.calculateWeaponDamage when no modifiers are available.
 * These defaults represent a "neutral" state with no bonuses or penalties.
 * 
 * @property POSITIVE_ACCURACY_MODIFIER - Additive accuracy bonus (e.g., 10 for +10%)
 * @property NEGATIVE_ACCURACY_MODIFIER - Additive accuracy penalty (e.g., 10 for -10%)
 * @property BASE_DAMAGE_MODIFIER - Multiplicative damage modifier (1.0 = no change, 1.5 = +50% damage)
 * @property ECM_EFFECTIVENESS - Electronic countermeasure strength (0-100, typically 0 for no ECM)
 * @property SPREAD_VALUE - Weapon spread/scatter (1.0 = no spread, higher = more spread)
 */
export const DAMAGE_CALC_DEFAULTS = {
  POSITIVE_ACCURACY_MODIFIER: 0,
  NEGATIVE_ACCURACY_MODIFIER: 0,
  BASE_DAMAGE_MODIFIER: 1.0,
  ECM_EFFECTIVENESS: 0,
  SPREAD_VALUE: 1.0
} as const;

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
