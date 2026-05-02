import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

vi.mock('@/components/Layout/AuthenticatedLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/DataAgeIndicator/DataAgeIndicator', () => ({
  __esModule: true,
  default: () => null,
}));

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
  deactivateAfterburner: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock next-intl so components using useTranslations work without a provider
vi.mock('next-intl', async () => {
  const { default: en } = await import('../../../locales/en.json');
  return {
    useTranslations: (namespace: string) => {
      const t = (key: string, params?: Record<string, string | number>) => {
        const ns = (en as unknown as Record<string, Record<string, string>>)[namespace] ?? {};
        let value: string = ns[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            value = value.replace(`{${k}}`, String(v));
          }
        }
        return value;
      };
      t.raw = (key: string) => {
        const ns = (en as unknown as Record<string, Record<string, string>>)[namespace] ?? {};
        return ns[key] ?? key;
      };
      return t;
    },
    useLocale: () => 'en',
  };
});

import { userStatsService, UserStatsResponse } from '@/lib/client/services/userStatsService';
import { getShipStats } from '@/lib/client/services/shipStatsService';
import { activateAfterburner, deactivateAfterburner } from '@/lib/client/services/afterburnerService';
import { navigateShip } from '@/lib/client/services/navigationService';
import type { ShipStatsResponse } from '@/lib/client/services/shipStatsService';
import type { AfterburnerStatus } from '@/lib/client/services/afterburnerService';
import { initGame } from '@/lib/client/game/Game';
import GamePageClient from '@/app/game/GamePageClient';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

const makeAfterburnerStatus = (overrides: Partial<AfterburnerStatus> = {}): AfterburnerStatus => ({
  isActive: false,
  boostRemainingMs: 0,
  cooldownRemainingMs: 0,
  canActivate: false,
  durationResearchLevel: 1,
  boostedSpeed: 0,
  fuelRemainingMs: 0,
  fuelCapacityMs: 30000,
  fuelPercent: 100,
  timeToActivationMs: 0,
  activationThresholdPercent: 33,
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

const makeMockGame = () => ({
  setDebugDrawingsEnabled: vi.fn(),
  setZoom: vi.fn(),
  setSafeAreaBottom: vi.fn(),
  setTeleportClickMode: vi.fn(),
  setAttackClickMode: vi.fn(),
  setPlayerLevel: vi.fn(),
  setMobileInteractionMode: vi.fn(),
  setMobileInfoMode: vi.fn(),
  updateCanvasStrings: vi.fn(),
  setAfterburnerActive: vi.fn(),
  stop: vi.fn(),
});

describe('GamePageClient afterburner controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(initGame).mockReturnValue(makeMockGame() as never);
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(makeUserStats());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('afterburnerButton_notResearched_isInvisible', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(makeAfterburnerStatus({ durationResearchLevel: 0, canActivate: false })),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    expect(screen.queryByText(/Afterburner/)).toBeNull();
    expect(screen.queryByText(/🔥/)).toBeNull();
  });

  it('afterburnerButton_canActivate_showsEngageButton', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(makeAfterburnerStatus({ canActivate: true, fuelPercent: 100, fuelRemainingMs: 30000 })),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Afterburner'));

    await waitFor(() => {
      expect(screen.getByText('engage')).toBeDefined();
      expect(screen.getByText(/fuel 100%/i)).toBeDefined();
    });
  });

  it('afterburnerPanel_isActive_showsBurnTimerAndDisengageButton', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(
        makeAfterburnerStatus({
          isActive: true,
          boostRemainingMs: 15000,
          fuelPercent: 50,
          fuelRemainingMs: 15000,
          boostedSpeed: 50,
        }),
      ),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Afterburner'));

    await waitFor(() => {
      expect(screen.getByText(/burn: 15s/i)).toBeDefined();
      expect(screen.getByText('disengage')).toBeDefined();
      expect(screen.getByText(/fuel 50%/i)).toBeDefined();
    });
  });

  it('afterburnerPanel_belowThreshold_showsReadyTimer', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(
        makeAfterburnerStatus({
          canActivate: false,
          fuelPercent: 20,
          fuelRemainingMs: 6000,
          cooldownRemainingMs: 24000,
          timeToActivationMs: 7800,
        }),
      ),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Afterburner'));

    await waitFor(() => {
      expect(screen.getByText(/ready at 33% in 7s/i)).toBeDefined();
      expect(screen.getByText(/recharging/i)).toBeDefined();
      expect(screen.getByText(/fuel 20%/i)).toBeDefined();
    });
  });

  it('afterburnerPanel_noAfterburnerStatus_panelNotRendered', async () => {
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats(undefined));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    expect(screen.queryByText('engage')).toBeNull();
    expect(screen.queryByText('disengage')).toBeNull();
  });

  it('afterburnerPanel_hasIconButton_showsAfterburnerIcon', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(makeAfterburnerStatus({ canActivate: true, durationResearchLevel: 2 })),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      const iconButton = screen.getByTitle('Afterburner');
      expect(iconButton).toBeDefined();
      expect(iconButton.textContent).toBe('🔥');
    });
  });

  it('afterburnerPanel_clickIcon_togglesVisibility', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(makeAfterburnerStatus({ canActivate: true, fuelPercent: 100, fuelRemainingMs: 30000 })),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    const iconButton = screen.getByTitle('Afterburner');

    expect(screen.queryByText('engage')).toBeNull();

    fireEvent.click(iconButton);

    await waitFor(() => {
      expect(screen.getByText('engage')).toBeDefined();
    });

    fireEvent.click(iconButton);

    await waitFor(() => {
      expect(screen.queryByText('engage')).toBeNull();
    });
  });

  it('afterburnerButton_engageClick_callsService', async () => {
    const afterburnerBefore = makeAfterburnerStatus({ canActivate: true, fuelPercent: 60, fuelRemainingMs: 18000 });
    const afterburnerAfter = makeAfterburnerStatus({
      isActive: true,
      canActivate: false,
      boostRemainingMs: 18000,
      fuelPercent: 60,
      fuelRemainingMs: 18000,
      boostedSpeed: 50,
    });

    vi.mocked(getShipStats)
      .mockResolvedValueOnce(makeShipStats(afterburnerBefore))
      .mockResolvedValue(makeShipStats(afterburnerAfter));

    vi.mocked(activateAfterburner).mockResolvedValue({
      success: true,
      action: 'activated',
      boostedSpeed: 50,
      previousSpeed: 25,
      durationMs: 30000,
      cooldownMs: 3600000,
      maxSpeed: 25,
      fuelRemainingMs: 18000,
      fuelCapacityMs: 30000,
      fuelPercent: 60,
    });

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Afterburner'));

    await waitFor(() => {
      expect(screen.getByText('engage')).toBeDefined();
    });

    fireEvent.click(screen.getByText('engage'));

    await waitFor(() => {
      expect(activateAfterburner).toHaveBeenCalledTimes(1);
    });
  });

  it('afterburnerButton_disengageClick_callsService', async () => {
    const activeAfterburner = makeAfterburnerStatus({
      isActive: true,
      boostRemainingMs: 15000,
      fuelPercent: 50,
      fuelRemainingMs: 15000,
      boostedSpeed: 50,
    });
    const inactiveAfterburner = makeAfterburnerStatus({
      canActivate: true,
      fuelPercent: 50,
      fuelRemainingMs: 15000,
      cooldownRemainingMs: 15000,
    });

    vi.mocked(getShipStats)
      .mockResolvedValueOnce(makeShipStats(activeAfterburner))
      .mockResolvedValue(makeShipStats(inactiveAfterburner));

    vi.mocked(deactivateAfterburner).mockResolvedValue({
      success: true,
      action: 'deactivated',
      boostedSpeed: 0,
      previousSpeed: 50,
      durationMs: 30000,
      cooldownMs: 3600000,
      maxSpeed: 25,
      fuelRemainingMs: 15000,
      fuelCapacityMs: 30000,
      fuelPercent: 50,
    });

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Afterburner')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Afterburner'));

    await waitFor(() => {
      expect(screen.getByText('disengage')).toBeDefined();
    });

    fireEvent.click(screen.getByText('disengage'));

    await waitFor(() => {
      expect(deactivateAfterburner).toHaveBeenCalledTimes(1);
    });
  });

  it('speedSlider_afterburnerActive_usesBoostedSpeedAsMax', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(
        makeAfterburnerStatus({
          isActive: true,
          boostRemainingMs: 20000,
          fuelPercent: 66.7,
          fuelRemainingMs: 20000,
          boostedSpeed: 50,
        }),
      ),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    expect(speedSlider).toHaveAttribute('max', '100');
    expect(speedSlider).toHaveAttribute('data-speed-limit', '50.0');
  });

  it('speedSlider_afterburnerNotActive_usesNormalMaxSpeed', async () => {
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(makeAfterburnerStatus({ canActivate: true, fuelPercent: 100, fuelRemainingMs: 30000 })),
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    expect(speedSlider).toHaveAttribute('max', '100');
    expect(speedSlider).toHaveAttribute('data-speed-limit', '25.0');
  });

  it('speedInput_afterburnerExpiresDuringPolling_updatesToServerCappedSpeed', async () => {
    vi.useFakeTimers();

    const activeAfterburner = makeAfterburnerStatus({
      isActive: true,
      boostRemainingMs: 5000,
      fuelPercent: 16.7,
      fuelRemainingMs: 5000,
      boostedSpeed: 50,
    });
    const expiredAfterburner = makeAfterburnerStatus({
      canActivate: false,
      fuelPercent: 10,
      fuelRemainingMs: 3000,
      cooldownRemainingMs: 27000,
      timeToActivationMs: 6900,
      boostedSpeed: 0,
    });

    vi.mocked(getShipStats)
      .mockResolvedValueOnce({ ...makeShipStats(activeAfterburner), speed: 50 })
      .mockResolvedValue({ ...makeShipStats(expiredAfterburner), speed: 25 });

    render(<GamePageClient auth={defaultAuth} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    expect(speedSlider).toHaveAttribute('aria-valuetext', '25.0 / 25.0');
  });

  it('speedSlider_dragRelease_commitsReleasedSpeed', async () => {
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats());
    vi.mocked(navigateShip).mockResolvedValue({
      success: true,
      speed: 12.3,
      angle: 45,
      maxSpeed: 25,
    });

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    fireEvent.change(speedSlider, { target: { value: '50' } });
    fireEvent.mouseUp(speedSlider);

    await waitFor(() => {
      expect(navigateShip).toHaveBeenCalledWith({ speed: 12.5 });
    });
  });

  it('speedSlider_nearZero_snapsToZeroOnRelease', async () => {
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats());
    vi.mocked(navigateShip).mockResolvedValue({
      success: true,
      speed: 0,
      angle: 45,
      maxSpeed: 25,
    });

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    fireEvent.change(speedSlider, { target: { value: '5' } });
    fireEvent.mouseUp(speedSlider);

    await waitFor(() => {
      expect(navigateShip).toHaveBeenCalledWith({ speed: 0 });
    });

    expect(screen.getByText('0.0')).toBeDefined();
  });

  it('speedSlider_rightSnapZone_commitsMaxSpeed', async () => {
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats());
    vi.mocked(navigateShip).mockResolvedValue({
      success: true,
      speed: 25,
      angle: 45,
      maxSpeed: 25,
    });

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(getShipStats).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));

    const speedSlider = screen.getByRole('slider', { name: /speed/i });
    fireEvent.change(speedSlider, { target: { value: '96' } });
    fireEvent.mouseUp(speedSlider);

    await waitFor(() => {
      expect(navigateShip).toHaveBeenCalledWith({ speed: 25 });
    });
  });

  it('gameInit_savedUiPreferences_syncsZoomAndDebugStateToGame', async () => {
    const mockGame = makeMockGame();
    vi.mocked(initGame).mockReturnValue(mockGame as never);
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats());
    localStorage.setItem('game-ui-zoom', JSON.stringify(1.75));
    localStorage.setItem('game-ui-debug-enabled', JSON.stringify(true));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(initGame).toHaveBeenCalled();
      expect(mockGame.setZoom).toHaveBeenCalledWith(1.75);
      expect(mockGame.setDebugDrawingsEnabled).toHaveBeenCalledWith(true);
    });
  });

  it('gameInit_savedUiPreferences_restorePanelsAndModes', async () => {
    const mockGame = makeMockGame();
    vi.mocked(initGame).mockReturnValue(mockGame as never);
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(makeUserStats({ teleportMaxCharges: 2, teleportCharges: 1 }));
    vi.mocked(getShipStats).mockResolvedValue(
      makeShipStats(makeAfterburnerStatus({ canActivate: true, fuelPercent: 100, fuelRemainingMs: 30000 })),
    );
    localStorage.setItem('game-ui-preferences', JSON.stringify({
      zoom: 1.8,
      debugDrawingsEnabled: true,
      navOpen: true,
      teleportOpen: true,
      afterburnerOpen: true,
      teleportClickMode: true,
      attackClickMode: true,
    }));

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(initGame).toHaveBeenCalled();
      expect(mockGame.setZoom).toHaveBeenCalledWith(1.8);
      expect(mockGame.setDebugDrawingsEnabled).toHaveBeenCalledWith(true);
      expect(mockGame.setTeleportClickMode).toHaveBeenCalledWith(true);
      expect(mockGame.setAttackClickMode).toHaveBeenCalledWith(true);
      expect(screen.getByRole('slider', { name: /speed/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /^enter coordinates$/i })).toBeDefined();
      expect(screen.getByText('engage')).toBeDefined();
    });
  });
});