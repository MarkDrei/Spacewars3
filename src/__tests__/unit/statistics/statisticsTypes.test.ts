// ---
// Unit tests for statisticsTypes
// Tests type guard logic and createEmptyUserStats helper.
// ---

import { describe, it, expect } from 'vitest';
import {
  createEmptyUserStats,
  StatEventType,
} from '@/lib/server/statistics/statisticsTypes';

describe('statisticsTypes', () => {
  // ── createEmptyUserStats ───────────────────────────────────────────────────

  it('createEmptyUserStats_noArgs_returnsAllZeroes', () => {
    const stats = createEmptyUserStats();

    expect(stats.battlesWon).toBe(0);
    expect(stats.battlesLost).toBe(0);
    expect(stats.totalDamageDealt).toBe(0);
    expect(stats.totalDamageReceived).toBe(0);
    expect(stats.totalIronTransferred).toBe(0);
    expect(stats.totalXpAwarded).toBe(0);
    expect(stats.totalBattleDurationSec).toBe(0);
    expect(stats.asteroidsCollected).toBe(0);
    expect(stats.shipwrecksCollected).toBe(0);
    expect(stats.escapePodsCollected).toBe(0);
    expect(stats.totalIronFromCollection).toBe(0);
    expect(stats.totalIronSpentOnResearch).toBe(0);
    expect(stats.researchCount).toBe(0);
    expect(stats.totalIronSpentOnBuilds).toBe(0);
    expect(stats.totalBuildsCompleted).toBe(0);
  });

  it('createEmptyUserStats_calledTwice_returnsIndependentObjects', () => {
    const stats1 = createEmptyUserStats();
    const stats2 = createEmptyUserStats();

    stats1.battlesWon = 5;

    // Mutations to stats1 should not affect stats2
    expect(stats2.battlesWon).toBe(0);
  });

  // ── StatEventType values ───────────────────────────────────────────────────

  it('statEventType_battleCompleted_isValidLiteralType', () => {
    const type: StatEventType = 'battle_completed';
    expect(type).toBe('battle_completed');
  });

  it('statEventType_itemCollected_isValidLiteralType', () => {
    const type: StatEventType = 'item_collected';
    expect(type).toBe('item_collected');
  });

  it('statEventType_researchSpent_isValidLiteralType', () => {
    const type: StatEventType = 'research_spent';
    expect(type).toBe('research_spent');
  });

  it('statEventType_techSpent_isValidLiteralType', () => {
    const type: StatEventType = 'tech_spent';
    expect(type).toBe('tech_spent');
  });

  it('createEmptyUserStats_hasAllExpectedFields', () => {
    const stats = createEmptyUserStats();
    const keys = Object.keys(stats);

    expect(keys).toContain('battlesWon');
    expect(keys).toContain('battlesLost');
    expect(keys).toContain('totalDamageDealt');
    expect(keys).toContain('totalDamageReceived');
    expect(keys).toContain('totalIronTransferred');
    expect(keys).toContain('totalXpAwarded');
    expect(keys).toContain('totalBattleDurationSec');
    expect(keys).toContain('asteroidsCollected');
    expect(keys).toContain('shipwrecksCollected');
    expect(keys).toContain('escapePodsCollected');
    expect(keys).toContain('totalIronFromCollection');
    expect(keys).toContain('totalIronSpentOnResearch');
    expect(keys).toContain('researchCount');
    expect(keys).toContain('totalIronSpentOnBuilds');
    expect(keys).toContain('totalBuildsCompleted');
  });
});
