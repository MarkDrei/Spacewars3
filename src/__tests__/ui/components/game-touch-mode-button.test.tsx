import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

import { initGame } from '@/lib/client/game/Game';
import { getShipStats } from '@/lib/client/services/shipStatsService';
import { userStatsService, UserStatsResponse } from '@/lib/client/services/userStatsService';
import type { ShipStatsResponse } from '@/lib/client/services/shipStatsService';
import GamePageClient from '@/app/game/GamePageClient';

const defaultAuth = { userId: 1, username: 'testuser', shipId: 42 };

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

const makeShipStats = (): ShipStatsResponse => ({
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
});

const makeMockGame = () => ({
  setDebugDrawingsEnabled: vi.fn(),
  setZoom: vi.fn(),
  setSafeAreaBottom: vi.fn(),
  setTeleportClickMode: vi.fn(),
  setAttackClickMode: vi.fn(),
  setPlayerLevel: vi.fn(),
  setMobileInteractionMode: vi.fn(),
  setMobileInfoMode: vi.fn(),
  stop: vi.fn(),
});

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('GamePageClient mobile tap mode button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(makeUserStats());
    vi.mocked(getShipStats).mockResolvedValue(makeShipStats());
    setMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('touchModeButton_desktop_buttonNotRendered', async () => {
    const mockGame = makeMockGame();
    vi.mocked(initGame).mockReturnValue(mockGame as never);

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(initGame).toHaveBeenCalled();
    });

    expect(screen.queryByTitle(/Tap mode:/i)).toBeNull();
    expect(mockGame.setMobileInteractionMode).toHaveBeenCalledWith(false);
  });

  it('touchModeButton_mobile_toggleEnablesInfoMode', async () => {
    const mockGame = makeMockGame();
    vi.mocked(initGame).mockReturnValue(mockGame as never);
    setMatchMedia(true);

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Tap mode: direct')).toBeDefined();
      expect(screen.getByTitle('Tap mode: direct').textContent).toContain('ℹ');
      expect(mockGame.setMobileInteractionMode).toHaveBeenCalledWith(true);
    });

    fireEvent.click(screen.getByTitle('Tap mode: direct'));

    await waitFor(() => {
      expect(screen.getByTitle('Tap mode: info')).toBeDefined();
      expect(mockGame.setMobileInfoMode).toHaveBeenLastCalledWith(true);
    });
  });

  it('zoomChange_doesNotReinitializeGame', async () => {
    const mockGame = makeMockGame();
    vi.mocked(initGame).mockReturnValue(mockGame as never);

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(initGame).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTitle('Navigation (angle, speed, zoom)'));
    fireEvent.change(screen.getByRole('slider', { name: /zoom/i }), { target: { value: '1.25' } });

    await waitFor(() => {
      expect(mockGame.setZoom).toHaveBeenLastCalledWith(1.25);
    });

    expect(initGame).toHaveBeenCalledTimes(1);
    expect(mockGame.stop).not.toHaveBeenCalled();
  });

  it('touchModeButton_mobile_savedPreference_restoresInfoModeAfterRemount', async () => {
    const firstGame = makeMockGame();
    const secondGame = makeMockGame();
    vi.mocked(initGame)
      .mockReturnValueOnce(firstGame as never)
      .mockReturnValueOnce(secondGame as never);
    setMatchMedia(true);

    const firstRender = render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Tap mode: direct')).toBeDefined();
    });

    fireEvent.click(screen.getByTitle('Tap mode: direct'));

    await waitFor(() => {
      expect(screen.getByTitle('Tap mode: info')).toBeDefined();
      expect(JSON.parse(localStorage.getItem('game-ui-preferences') ?? '{}')).toMatchObject({
        mobileTapInfoMode: true,
      });
    });

    firstRender.unmount();

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByTitle('Tap mode: info')).toBeDefined();
    });
  });
});