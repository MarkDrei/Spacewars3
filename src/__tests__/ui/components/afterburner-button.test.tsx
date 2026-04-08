// UI tests for GamePageClient afterburner button controls
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ─────────── Module mocks ───────────────────────────────────────────────────
vi.mock('@/components/Layout/AuthenticatedLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/DataAgeIndicator/DataAgeIndicator', () => ({
  __esModule: true,
  default: () => null,
}));

// Mock Game + initGame — the canvas API is not available in jsdom
vi.mock('@/lib/client/game/Game', () => ({
  initGame: vi.fn(),
  Game: vi.fn(),
}));

vi.mock('@/lib/client/hooks/useWorldData', () => ({
  useWorldData: vi.fn(() => ({
    worldData: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    lastUpdateTime: 0,
  })),
}));

vi.mock('@/lib/client/services/userStatsService', () => ({
  userStatsService: {
    getUserStats: vi.fn(),
  },
}));

vi.mock('@/lib/client/services/navigationService', () => ({
  navigateShip: vi.fn(),
  setShipDirection: vi.fn(),
  interceptTarget: vi.fn(),
}));

vi.mock('@/lib/client/services/shipStatsService', () => ({
  getShipStats: vi.fn(),
}));

vi.mock('@/lib/client/services/afterburnerService', () => ({
  activateAfterburner: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// ─────────── Re-import after mocks ──────────────────────────────────────────
import { userStatsService, UserStatsResponse } from '@/lib/client/services/userStatsService';
import { getShipStats } from '@/lib/client/services/shipStatsService';
import { activateAfterburner } from '@/lib/client/services/afterburnerService';
import type { ShipStatsResponse } from '@/lib/client/services/shipStatsService';
import type { AfterburnerStatus } from '@/lib/client/services/afterburnerService';
import GamePageClient from '@/app/game/GamePageClient';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─────────── Helpers ─────────────────────────────────────────────────────────
const makeUserStats = (overrides: Partial<UserStatsResponse> = {}): UserStatsResponse => ({
  iron: 100,
  last_updated: 1000,
  ironPerSecond: 1,
  maxIronCapacity: 1000,
  xp: 50,
  level: 1,
  xpForNextLevel: 100,
  timeMultiplier: 1,
  teleportCharges: 0,
  teleportMaxCharges: 0,
  teleportRechargeTimeSec: 86400,
  teleportRechargeSpeed: 1,
  ...overrides,
});

const makeShipStats = (afterburner?: AfterburnerStatus): ShipStatsResponse => ({
  x: 100,
  y: 200,
  speed: 10,
  angle: 45,
  maxSpeed: 25,
  last_position_update_ms: Date.now(),
  defenseValues: {
    hull: { name: 'Hull', current: 100, max: 100, regenRate: 0 },
    armor: { name: 'Armor', current: 50, max: 100, regenRate: 1 },
    shield: { name: 'Shield', current: 50, max: 100, regenRate: 2 },
  },
  afterburner,
});

const defaultAuth = { userId: 1, username: 'testuser', shipId: 42 };

// ─────────── GamePageClient afterburner controls UI tests ────────────────────
describe('GamePageClient afterburner controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default: userStats returns minimal stats
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(makeUserStats());
  });

  it('afterburnerButton_notResearched_isInvisible', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 0,
      canActivate: false,
      durationResearchLevel: 0,
      boostedSpeed: 0,
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    // When not researched (level 0), the afterburner button should be invisible
    expect(screen.queryByText(/Afterburner/)).toBeNull();
    expect(screen.queryByText(/🔥/)).toBeNull();
  });

  it('afterburnerButton_canActivate_showsActivateButton', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 0,
      canActivate: true,
      durationResearchLevel: 1,
      boostedSpeed: 0,
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByText('🔥 Afterburner')).toBeDefined();
    });

    const button = screen.getByText('🔥 Afterburner');
    expect(button).toHaveProperty('disabled', false);
  });

  it('afterburnerPanel_isActive_showsActiveWithTimer', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: true,
      boostRemainingMs: 15000,
      cooldownRemainingMs: 0,
      canActivate: false,
      durationResearchLevel: 1,
      boostedSpeed: 50,
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByText(/Active \(15s\)/)).toBeDefined();
    });

    const button = screen.getByText(/Active \(15s\)/);
    expect(button).toHaveProperty('disabled', true);
  });

  it('afterburnerPanel_onCooldown_showsCooldownWithTimer', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 3600000, // 1 hour
      canActivate: false,
      durationResearchLevel: 1,
      boostedSpeed: 0,
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByText(/Cooldown \(1h 0m\)/)).toBeDefined();
    });

    const button = screen.getByText(/Cooldown \(1h 0m\)/);
    expect(button).toHaveProperty('disabled', true);
  });

  it('afterburnerPanel_noAfterburnerStatus_panelNotRendered', async () => {
    // ship-stats returns no afterburner field
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(undefined));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    expect(screen.queryByText(/Activate Afterburner/)).toBeNull();
    expect(screen.queryByText(/Afterburner \(Not Researched\)/)).toBeNull();
  });

  it('abilitiesPanel_hasHeading_showsAbilitiesHeading', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 0,
      canActivate: true,
      durationResearchLevel: 2,
      boostedSpeed: 0,
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /abilities/i })).toBeDefined();
    });
  });

  it('abilitiesPanel_collapsed_hidesAfterburnerButton', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 0,
      canActivate: true,
      durationResearchLevel: 1,
      boostedSpeed: 0,
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByText('🔥 Afterburner')).toBeDefined();
    });

    // Find the collapse button in the abilities panel
    const heading = screen.getByRole('heading', { name: /abilities/i });
    const panelHeadingRow = heading.parentElement!;
    const collapseButton = panelHeadingRow.querySelector('.collapse-button') as HTMLElement;
    expect(collapseButton).toBeTruthy();

    fireEvent.click(collapseButton);

    // Button text should no longer be visible
    expect(screen.queryByText('🔥 Afterburner')).toBeNull();
    // But heading should still be visible
    expect(screen.getByRole('heading', { name: /abilities/i })).toBeDefined();
  });

  it('afterburnerButton_activateClick_callsService', async () => {
    const afterburnerBefore: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 0,
      canActivate: true,
      durationResearchLevel: 1,
      boostedSpeed: 0,
    };
    const afterburnerAfter: AfterburnerStatus = {
      isActive: true,
      boostRemainingMs: 30000,
      cooldownRemainingMs: 0,
      canActivate: false,
      durationResearchLevel: 1,
      boostedSpeed: 50,
    };

    vi.mocked(getShipStats)
      .mockResolvedValueOnce(makeShipStats(afterburnerBefore))
      .mockResolvedValue(makeShipStats(afterburnerAfter));

    vi.mocked(activateAfterburner).mockResolvedValue({
      success: true,
      boostedSpeed: 50,
      previousSpeed: 25,
      durationMs: 30000,
      cooldownMs: 3600000,
      maxSpeed: 25,
    });

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByText('🔥 Afterburner')).toBeDefined();
    });

    const button = screen.getByText('🔥 Afterburner');
    fireEvent.click(button);

    await waitFor(() => {
      expect(activateAfterburner).toHaveBeenCalledTimes(1);
    });
  });

  it('afterburnerPanel_cooldownShortDuration_showsMinutesAndSeconds', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 150000, // 2m 30s
      canActivate: false,
      durationResearchLevel: 1,
      boostedSpeed: 0,
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByText(/Cooldown \(2m 30s\)/)).toBeDefined();
    });
  });
});
