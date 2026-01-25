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
 * Default values for damage calculation parameters
 * Used when calling TechFactory.calculateWeaponDamage
 */
export const DAMAGE_CALC_DEFAULTS = {
  /** Positive accuracy bonus (e.g., targeting computer bonus) */
  POSITIVE_ACCURACY_MODIFIER: 0,
  /** Negative accuracy penalty (e.g., evasion, ECM) */
  NEGATIVE_ACCURACY_MODIFIER: 0,
  /** Base damage multiplier (1.0 = normal damage, modified by tech tree) */
  BASE_DAMAGE_MODIFIER: 1.0,
  /** Electronic countermeasure effectiveness (0 = no ECM) */
  ECM_EFFECTIVENESS: 0,
  /** Damage spread/variance (1.0 = normal spread) */
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
