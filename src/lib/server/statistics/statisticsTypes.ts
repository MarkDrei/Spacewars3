// ---
// Statistics system type definitions
// ---

import { ResearchType } from '@/lib/server/techs/techtree';

// ========================================
// Event Types
// ========================================

export type StatEventType = 'battle_completed' | 'item_collected' | 'research_spent' | 'tech_spent';

export interface BattleCompletedEventData {
  battleId: number;
  opponentId: number;
  won: boolean;
  damageDealt: number;
  damageReceived: number;
  ironTransferred: number;
  xpAwarded: number;
  durationSec: number;
}

export interface ItemCollectedEventData {
  objectType: 'asteroid' | 'shipwreck' | 'escape_pod';
  ironAwarded: number;
}

export interface ResearchSpentEventData {
  researchType: ResearchType;
  level: number;
  ironCost: number;
}

export interface TechSpentEventData {
  itemKey: string;
  itemType: string;
  ironCost: number;
  count: number;
}

export type StatEventData =
  | BattleCompletedEventData
  | ItemCollectedEventData
  | ResearchSpentEventData
  | TechSpentEventData;

export interface StatEvent {
  id: number;
  userId: number;
  eventType: StatEventType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventData: any;
  createdAt: bigint; // Unix timestamp in milliseconds
}

// ========================================
// Aggregates
// ========================================

export interface UserStatAggregates {
  // Combat
  battlesWon: number;
  battlesLost: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalIronTransferred: number;
  totalXpAwarded: number;
  totalBattleDurationSec: number;

  // Collection
  asteroidsCollected: number;
  shipwrecksCollected: number;
  escapePodsCollected: number;
  totalIronFromCollection: number;

  // Economy (research)
  totalIronSpentOnResearch: number;
  researchCount: number;

  // Economy (tech/builds)
  totalIronSpentOnBuilds: number;
  totalBuildsCompleted: number;
}

export interface TopEntry {
  userId: number;
  username: string;
  value: number;
}

export interface GlobalStatAggregates {
  totalPlayers: number;
  averages: UserStatAggregates;
  top5: {
    battlesWon: TopEntry[];
    totalDamageDealt: TopEntry[];
    totalIronTransferred: TopEntry[];
    totalIronFromCollection: TopEntry[];
    totalIronSpentOnResearch: TopEntry[];
  };
}

// ========================================
// Helper
// ========================================

export function createEmptyUserStats(): UserStatAggregates {
  return {
    battlesWon: 0,
    battlesLost: 0,
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    totalIronTransferred: 0,
    totalXpAwarded: 0,
    totalBattleDurationSec: 0,
    asteroidsCollected: 0,
    shipwrecksCollected: 0,
    escapePodsCollected: 0,
    totalIronFromCollection: 0,
    totalIronSpentOnResearch: 0,
    researchCount: 0,
    totalIronSpentOnBuilds: 0,
    totalBuildsCompleted: 0,
  };
}
