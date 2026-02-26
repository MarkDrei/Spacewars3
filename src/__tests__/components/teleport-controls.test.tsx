// Tests for teleport service, teleport-related types, and GamePageClient teleport UI
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
// teleportService is NOT mocked at module level so the real implementation is used in service tests
import { teleportShip, TeleportRequest, TeleportResponse } from '@/lib/client/services/teleportService';
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

// ─────────── teleportService tests ───────────────────────────────────────────
describe('teleportService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls POST /api/teleport with correct payload', async () => {
    const mockResponse: TeleportResponse = {
      success: true,
      ship: { x: 100, y: 200, speed: 0, angle: 0 },
      remainingCharges: 2,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const request: TeleportRequest = { x: 100, y: 200, preserveVelocity: false };
    const result = await teleportShip(request);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/teleport',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(request),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('returns correct remainingCharges from response', async () => {
    const mockResponse: TeleportResponse = {
      success: true,
      ship: { x: 500, y: 500, speed: 10, angle: 45 },
      remainingCharges: 0,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await teleportShip({ x: 500, y: 500, preserveVelocity: true });
    expect(result.remainingCharges).toBe(0);
    expect(result.success).toBe(true);
  });

  it('sends preserveVelocity: true when specified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, ship: { x: 0, y: 0, speed: 5, angle: 90 }, remainingCharges: 1 }),
    });

    await teleportShip({ x: 0, y: 0, preserveVelocity: true });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.preserveVelocity).toBe(true);
  });

  it('throws error with server message when response not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No charges remaining' }),
    });

    await expect(teleportShip({ x: 100, y: 100, preserveVelocity: false })).rejects.toThrow(
      'No charges remaining'
    );
  });

  it('throws generic error when response not ok and no error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(teleportShip({ x: 100, y: 100, preserveVelocity: false })).rejects.toThrow(
      'Teleport failed'
    );
  });

  it('includes credentials in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, ship: { x: 0, y: 0, speed: 0, angle: 0 }, remainingCharges: 3 }),
    });

    await teleportShip({ x: 0, y: 0, preserveVelocity: false });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/teleport',
      expect.objectContaining({ credentials: 'include' })
    );
  });
});

// ─────────── UserStatsResponse type tests ────────────────────────────────────
describe('UserStatsResponse includes teleport fields', () => {
  it('UserStatsResponse type has teleport fields', () => {
    const stats: UserStatsResponse = makeUserStats({ teleportCharges: 2, teleportMaxCharges: 3, teleportRechargeTimeSec: 7200, teleportRechargeSpeed: 1 });
    expect(stats.teleportCharges).toBe(2);
    expect(stats.teleportMaxCharges).toBe(3);
    expect(stats.teleportRechargeTimeSec).toBe(7200);
    expect(stats.teleportRechargeSpeed).toBe(1);
  });

  it('teleportMaxCharges can be 0 when teleport not researched', () => {
    const stats: UserStatsResponse = makeUserStats({ teleportCharges: 0, teleportMaxCharges: 0 });
    expect(stats.teleportMaxCharges).toBe(0);
  });
});

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
      expect(screen.getByText(/^Teleport$/i)).toBeDefined();
    });
  });

  it('teleportControls_noCharges_teleportButtonDisabled', async () => {
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(
      makeUserStats({ teleportMaxCharges: 2, teleportCharges: 0 })
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      expect(screen.getByText(/^Teleport$/i)).toBeDefined();
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
      expect(screen.getByText(/^Teleport$/i)).toBeDefined();
    });

    const teleportButton = screen.getByRole('button', { name: /^Teleport$/ });
    expect(teleportButton).toHaveProperty('disabled', false);
  });

  it('teleportControls_rechargeTimer_showsCorrectTime', async () => {
    vi.mocked(userStatsService.getUserStats).mockResolvedValue(
      makeUserStats({ teleportMaxCharges: 2, teleportCharges: 1, teleportRechargeTimeSec: 7200 })
    );

    render(<GamePageClient auth={defaultAuth} />);

    await waitFor(() => {
      // 7200 seconds = 2.0 hours
      expect(screen.getByText(/2\.0h per charge/i)).toBeDefined();
    });
  });
});
