// UI tests for GamePageClient teleport controls
// Pure service/type tests extracted to unit/components/teleport-service.test.ts
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// ─────────── Re-import after mocks ──────────────────────────────────────────
import { userStatsService, UserStatsResponse } from '@/lib/client/services/userStatsService';
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

const defaultAuth = { userId: 1, username: 'testuser', shipId: 42 };

// ─────────── GamePageClient teleport controls UI tests ───────────────────────
describe('GamePageClient teleport controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('teleportControls_noTeleportResearch_controlsNotRendered', async () => {
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(
      makeUserStats({ teleportMaxCharges: 0, teleportCharges: 0 })
    );

    render(<GamePageClient auth={defaultAuth} />);

    // Wait for async getUserStats call to resolve
    await waitFor(() => {
      expect(userStatsService.getUserStats).toHaveBeenCalled();
    });

    // Teleport section should not be visible when maxCharges is 0
    expect(screen.queryByText(/^Teleport$/i)).toBeNull();
  });

  it('teleportControls_withTeleportResearch_controlsRendered', async () => {
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(
      makeUserStats({ teleportMaxCharges: 3, teleportCharges: 2 })
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Teleport$/i })).toBeDefined();
    });
  });

  it('teleportControls_noCharges_teleportButtonDisabled', async () => {
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(
      makeUserStats({ teleportMaxCharges: 2, teleportCharges: 0 })
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Teleport$/i })).toBeDefined();
    });

    const teleportButton = screen.getByRole('button', { name: /^Teleport$/ });
    expect(teleportButton).toHaveProperty('disabled', true);
  });

  it('teleportControls_withCharges_teleportButtonEnabled', async () => {
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(
      makeUserStats({ teleportMaxCharges: 2, teleportCharges: 1 })
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Teleport$/i })).toBeDefined();
    });

    const teleportButton = screen.getByRole('button', { name: /^Teleport$/ });
    expect(teleportButton).toHaveProperty('disabled', false);
  });

  it('teleportControls_rechargeTimer_showsCorrectTime', async () => {
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(
      makeUserStats({ teleportMaxCharges: 2, teleportCharges: 1.5, teleportRechargeTimeSec: 7200 })
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      // 0.5 charges remaining * 7200 seconds = 3600 seconds = 1h 0m
      expect(screen.getByText(/Next in: 1h 0m/i)).toBeDefined();
    });
  });
});
