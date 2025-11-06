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

// For database row mapping
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

// Helper to convert DB row to Battle object
export function battleRowToBattle(row: BattleRow): Battle {
  return {
    id: row.id,
    attackerId: row.attacker_id,
    attackeeId: row.attackee_id,
    battleStartTime: row.battle_start_time,
    battleEndTime: row.battle_end_time,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    attackerWeaponCooldowns: JSON.parse(row.attacker_weapon_cooldowns),
    attackeeWeaponCooldowns: JSON.parse(row.attackee_weapon_cooldowns),
    attackerStartStats: JSON.parse(row.attacker_start_stats),
    attackeeStartStats: JSON.parse(row.attackee_start_stats),
    attackerEndStats: row.attacker_end_stats ? JSON.parse(row.attacker_end_stats) : null,
    attackeeEndStats: row.attackee_end_stats ? JSON.parse(row.attackee_end_stats) : null,
    battleLog: JSON.parse(row.battle_log),
    attackerTotalDamage: row.attacker_total_damage || 0,
    attackeeTotalDamage: row.attackee_total_damage || 0,
  };
}
