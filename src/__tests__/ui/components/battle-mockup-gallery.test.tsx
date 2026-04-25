import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BattleMockupGallery from '@/components/BattleMockupGallery/BattleMockupGallery';
import type { BattleStatus } from '@/lib/client/hooks/useBattleStatus';
import type { DefenseValues } from '@/shared/defenseValues';

const mockBattleStatus: BattleStatus = {
  inBattle: true,
  battle: {
    id: 99,
    isAttacker: true,
    opponentId: 42,
    battleStartTime: 1_700_000_000,
    battleEndTime: null,
    winnerId: null,
    loserId: null,
    weaponCooldowns: {
      gauss_rifle: 1_700_000_150,
      pulse_laser: 1_700_000_132,
    },
    battleLog: [
      {
        timestamp: 1_700_000_001,
        type: 'battle_started',
        actor: 'attacker',
        data: {
          message: 'Battle initiated at distance 25.0 units',
        },
      },
      {
        timestamp: 1_700_000_030,
        type: 'damage_dealt',
        actor: 'attacker',
        data: {
          weaponType: 'gauss_rifle',
          damageDealt: 87,
        },
      },
      {
        timestamp: 1_700_000_060,
        type: 'shield_broken',
        actor: 'attacker',
        data: {},
      },
    ],
    myTotalDamage: 210,
    opponentTotalDamage: 160,
    myStartStats: {
      hull: { current: 500, max: 500 },
      armor: { current: 400, max: 400 },
      shield: { current: 300, max: 300 },
    },
    opponentStartStats: {
      hull: { current: 520, max: 520 },
      armor: { current: 430, max: 430 },
      shield: { current: 280, max: 280 },
    },
    myEndStats: null,
    opponentEndStats: null,
  },
};

const mockDefenseValues: DefenseValues = {
  hull: { name: 'Hull', current: 480, max: 500, regenRate: 1 },
  armor: { name: 'Armor', current: 350, max: 400, regenRate: 1 },
  shield: { name: 'Shield', current: 120, max: 300, regenRate: 2 },
};

describe('BattleMockupGallery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-11-14T22:15:25.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('battleMockupGallery_liveBattleShowsDurationAndBackendFields', () => {
    render(
      <BattleMockupGallery
        battleStatus={mockBattleStatus}
        defenseValues={mockDefenseValues}
        isLoading={false}
      />
    );

    expect(screen.getByText('Battle Mockup Lab')).toBeInTheDocument();
    expect(screen.getByText('Running for')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument();
    expect(screen.getByText('battle.myStartStats')).toBeInTheDocument();
    expect(screen.getAllByText(/persisted model snapshot/i).length).toBeGreaterThan(0);
  });

  it('battleMockupGallery_canSwitchDesignsAndRevealTelemetryLayout', () => {
    render(
      <BattleMockupGallery
        battleStatus={mockBattleStatus}
        defenseValues={mockDefenseValues}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Design 9: Raw Telemetry' }));

    expect(screen.getByRole('tab', { name: 'Design 9: Raw Telemetry', selected: true })).toBeInTheDocument();
    expect(screen.getByText(/battleLogCount: 3/)).toBeInTheDocument();
    expect(screen.getByText(/cooldownCount: 2/)).toBeInTheDocument();
  });
});
