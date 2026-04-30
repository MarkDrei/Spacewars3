import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePageClient from '@/app/home/HomePageClient';

const useTechCountsMock = vi.fn();
const useDefenseValuesMock = vi.fn();
const useBattleStatusMock = vi.fn();
const useUserStatsMock = vi.fn();

vi.mock('@/components/Layout/AuthenticatedLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/app/home/OrbitalCommandHub', () => ({
  __esModule: true,
  OrbitalCommandHub: () => <div>Orbital Command Hub</div>,
}));

vi.mock('@/lib/client/hooks/useTechCounts', () => ({
  useTechCounts: () => useTechCountsMock(),
}));

vi.mock('@/lib/client/hooks/useDefenseValues', () => ({
  useDefenseValues: () => useDefenseValuesMock(),
}));

vi.mock('@/lib/client/hooks/useBattleStatus', () => ({
  useBattleStatus: () => useBattleStatusMock(),
}));

vi.mock('@/lib/client/hooks/useUserStats', () => ({
  useUserStats: () => useUserStatsMock(),
}));

vi.mock('next-intl', async () => {
  const { default: en } = await import('../../../locales/en.json');
  return {
    useTranslations: (namespace: string) => {
      return (key: string, params?: Record<string, string | number>) => {
        const ns = (en as unknown as Record<string, Record<string, string>>)[namespace] ?? {};
        let value: string = ns[key] ?? key;
        if (params) {
          for (const [paramKey, paramValue] of Object.entries(params)) {
            value = value.replace(`{${paramKey}}`, String(paramValue));
          }
        }
        return value;
      };
    },
    useLocale: () => 'en',
  };
});

describe('HomePageClient defense recovery timers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useTechCountsMock.mockReturnValue({
      techCounts: null,
      weapons: {},
      defenses: {},
      isLoading: false,
      error: null,
    });

    useBattleStatusMock.mockReturnValue({
      battleStatus: null,
    });

    useUserStatsMock.mockReturnValue({
      xp: 0,
      level: 1,
      xpForNextLevel: 100,
      score: 0,
      isLoading: true,
      bonuses: {},
    });
  });

  it('defenseTimers_activeRepairsAndShieldRecharge_renderAdditionalRows', () => {
    useDefenseValuesMock.mockReturnValue({
      defenseValues: {
        hull: { name: 'Hull', current: 75, max: 100, regenRate: 1 },
        armor: { name: 'Armor', current: 25, max: 100, regenRate: 1 },
        shield: { name: 'Shield', current: 80, max: 100, regenRate: 2 },
      },
      recoveryTimers: {
        repairs: 45,
        shield: 10,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      shipPictureId: null,
    });

    render(<HomePageClient auth={{ userId: 1, username: 'captain' }} initialMessages={[]} />);

    const defenseTable = screen.getByText('Defense Values').closest('table');
    expect(defenseTable).not.toBeNull();

    const defenseTableQueries = within(defenseTable!);
    expect(defenseTableQueries.getByText('00:45')).toBeInTheDocument();
    expect(defenseTableQueries.getByText('00:10')).toBeInTheDocument();
    expect(defenseTableQueries.getByText('Repair (Hull + Armor)')).toBeInTheDocument();
    expect(defenseTableQueries.getByText('Shield Recharge')).toBeInTheDocument();
  });

  it('defenseTimers_noActiveRecovery_hideAdditionalRows', () => {
    useDefenseValuesMock.mockReturnValue({
      defenseValues: {
        hull: { name: 'Hull', current: 100, max: 100, regenRate: 0 },
        armor: { name: 'Armor', current: 100, max: 100, regenRate: 0 },
        shield: { name: 'Shield', current: 100, max: 100, regenRate: 2 },
      },
      recoveryTimers: {
        repairs: null,
        shield: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      shipPictureId: null,
    });

    render(<HomePageClient auth={{ userId: 1, username: 'captain' }} initialMessages={[]} />);

    const defenseTable = screen.getByText('Defense Values').closest('table');
    expect(defenseTable).not.toBeNull();

    const defenseTableQueries = within(defenseTable!);
    expect(defenseTableQueries.queryByText('Repair (Hull + Armor)')).not.toBeInTheDocument();
    expect(defenseTableQueries.queryByText('Shield Recharge')).not.toBeInTheDocument();
  });
});
