// UI tests for GamePageClient afterburner button controls
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

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
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    const iconButton = screen.getByTitle('Afterburner');
    expect(iconButton).toHaveProperty('disabled', false);
    
    // Click to expand the panel
    fireEvent.click(iconButton);

    // Now the activate button should be visible
    await waitFor(() => {
      expect(screen.getByText(/🔥 Activate/)).toBeDefined();
    });
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
      const afterburnerIcon = screen.getByTitle('Afterburner');
      expect(afterburnerIcon).toBeDefined();
    });

    // Click to expand the afterburner panel
    fireEvent.click(screen.getByTitle('Afterburner'));

    // Now the active status should be visible
    await waitFor(() => {
      expect(screen.getByText(/Active \(15s\)/)).toBeDefined();
    });
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
      const afterburnerIcon = screen.getByTitle('Afterburner');
      expect(afterburnerIcon).toBeDefined();
    });

    // Click to expand the afterburner panel
    fireEvent.click(screen.getByTitle('Afterburner'));

    // Now the cooldown status should be visible
    await waitFor(() => {
      expect(screen.getByText(/Cooldown \(1h 0m\)/)).toBeDefined();
    });
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

  it('afterburnerPanel_hasIconButton_showsAfterburnerIcon', async () => {
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
      const iconButton = screen.getByTitle('Afterburner');
      expect(iconButton).toBeDefined();
      expect(iconButton.textContent).toBe('🔥');
    });
  });

  it('afterburnerPanel_clickIcon_togglesVisibility', async () => {
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
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    const iconButton = screen.getByTitle('Afterburner');
    
    // Initially, the activate button should not be visible
    expect(screen.queryByText(/🔥 Activate/)).toBeNull();

    // Click to expand the panel
    fireEvent.click(iconButton);

    // Now the activate button should be visible
    await waitFor(() => {
      expect(screen.getByText(/🔥 Activate/)).toBeDefined();
    });

    // Click again to collapse the panel
    fireEvent.click(iconButton);

    // The activate button should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText(/🔥 Activate/)).toBeNull();
    });
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
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    // Click icon to expand the afterburner panel
    fireEvent.click(screen.getByTitle('Afterburner'));

    // Now look for the activate button
    await waitFor(() => {
      expect(screen.getByText(/🔥 Activate/)).toBeDefined();
    });

    const activateButton = screen.getByText(/🔥 Activate/);
    fireEvent.click(activateButton);

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
      const afterburnerIcon = screen.getByTitle('Afterburner');
      expect(afterburnerIcon).toBeDefined();
    });

    // Click to expand the afterburner panel
    fireEvent.click(screen.getByTitle('Afterburner'));

    // Now the cooldown status should be visible
    await waitFor(() => {
      expect(screen.getByText(/Cooldown \(2m 30s\)/)).toBeDefined();
    });
  });

  it('speedSlider_afterburnerActive_usesBoostedSpeedAsMax', async () => {
    const afterburner: AfterburnerStatus = {
      isActive: true,
      boostRemainingMs: 20000,
      cooldownRemainingMs: 0,
      canActivate: false,
      durationResearchLevel: 1,
      boostedSpeed: 50, // boosted max is 50 while normal maxSpeed is 25
    };
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(afterburner));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    // Click navigation icon to expand and access the speed slider
    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    // The speed slider should use boostedSpeed (50) as max, not normal maxSpeed (25)
    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    expect(speedSlider).toHaveAttribute('max', '50');
  });

  it('speedSlider_afterburnerNotActive_usesNormalMaxSpeed', async () => {
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
      expect(getShipStats).toHaveBeenCalled();
    });

    // Click navigation icon to expand and access the speed slider
    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    // The speed slider should use normal maxSpeed (25) when afterburner is not active
    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    expect(speedSlider).toHaveAttribute('max', '25');
  });

  it('speedInput_afterburnerExpiresDuringPolling_updatesToServerCappedSpeed', async () => {
    vi.useFakeTimers();

    const activeAfterburner: AfterburnerStatus = {
      isActive: true,
      boostRemainingMs: 5000,
      cooldownRemainingMs: 0,
      canActivate: false,
      durationResearchLevel: 1,
      boostedSpeed: 50,
    };
    const expiredAfterburner: AfterburnerStatus = {
      isActive: false,
      boostRemainingMs: 0,
      cooldownRemainingMs: 3600000,
      canActivate: false,
      durationResearchLevel: 1,
      boostedSpeed: 0,
    };

    // First call returns active afterburner at boosted speed (50),
    // subsequent calls return expired afterburner with speed capped at normal maxSpeed (25).
    vi.mocked(getShipStats)
      .mockResolvedValueOnce({ ...makeShipStats(activeAfterburner), speed: 50 })
      .mockResolvedValue({ ...makeShipStats(expiredAfterburner), speed: 25 });

    render(<GamePageClient auth={defaultAuth} />);

    // Flush initial async effects (initial getShipStats call + React state updates)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Advance past the 1-second polling interval to trigger the second getShipStats call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // Click navigation icon to expand and access the speed slider
    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    // The speed input should now show the server-capped speed (25), not the boosted speed (50)
    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    expect(speedSlider).toHaveAttribute('value', '25');

    vi.useRealTimers();
  });
});
