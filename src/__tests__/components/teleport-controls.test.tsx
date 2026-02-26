import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ────────────────────────────────────────────────────────────────────────────
// Mocks — set up before importing the component under test
// ────────────────────────────────────────────────────────────────────────────

vi.mock('@/components/Layout/AuthenticatedLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/DataAgeIndicator/DataAgeIndicator', () => ({
  __esModule: true,
  default: () => <div data-testid="data-age-indicator" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Prevent canvas/WebGL errors in jsdom
vi.mock('@/lib/client/game/Game', () => ({
  initGame: vi.fn(() => ({
    updateWorldData: vi.fn(),
    setRefetchFunction: vi.fn(),
    setNavigationCallback: vi.fn(),
    setAttackSuccessCallback: vi.fn(),
    getDebugDrawingsEnabled: vi.fn(() => true),
    setDebugDrawingsEnabled: vi.fn(),
    setTeleportClickMode: vi.fn(),
    onTeleportClick: null,
    getWorld: vi.fn(() => ({ getShip: vi.fn(() => null) })),
    stop: vi.fn(),
  })),
  Game: vi.fn(),
}));

vi.mock('@/lib/client/hooks/useWorldData', () => ({
  useWorldData: vi.fn(() => ({
    worldData: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    lastUpdateTime: null,
  })),
}));

vi.mock('@/lib/client/services/navigationService', () => ({
  navigateShip: vi.fn(),
}));

vi.mock('@/lib/client/services/shipStatsService', () => ({
  getShipStats: vi.fn(() => Promise.resolve({ maxSpeed: 100, defenseValues: {} })),
}));

vi.mock('@/lib/client/services/teleportService', () => ({
  teleportShip: vi.fn(() => Promise.resolve({
    success: true,
    ship: { x: 100, y: 200, speed: 0, angle: 0 },
    remainingCharges: 0,
  })),
}));

// useTeleportData mock — overridden per-test below
const mockUseTeleportData = vi.fn();
vi.mock('@/lib/client/hooks/useTeleportData', () => ({
  useTeleportData: (...args: unknown[]) => mockUseTeleportData(...args),
}));

// ────────────────────────────────────────────────────────────────────────────
// Import component after mocks are registered
// ────────────────────────────────────────────────────────────────────────────

import GamePageClient from '@/app/game/GamePageClient';
import { teleportShip } from '@/lib/client/services/teleportService';

const baseAuth = { userId: 1, username: 'testuser', shipId: 42 };

function makeTeleportData(overrides: Partial<{
  teleportCharges: number;
  teleportMaxCharges: number;
  teleportRechargeTimeSec: number;
  teleportRechargeSpeed: number;
}> = {}) {
  return {
    teleportCharges: 1,
    teleportMaxCharges: 2,
    teleportRechargeTimeSec: 0,
    teleportRechargeSpeed: 86400,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('Teleport Controls — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('teleportControls_noTeleportResearch_controlsNotRendered', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({ teleportMaxCharges: 0 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    expect(screen.queryByText(/Teleport Charges/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Teleport$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Teleport to Click/i })).toBeNull();
  });

  it('teleportControls_withTeleportResearch_controlsRendered', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({ teleportMaxCharges: 2, teleportCharges: 1 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    expect(screen.getByText(/Teleport Charges: 1\/2/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /^Teleport$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Teleport to Click/i })).toBeDefined();
  });

  it('teleportControls_noCharges_buttonsDisabled', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({ teleportMaxCharges: 2, teleportCharges: 0 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    const teleportBtn = screen.getByRole('button', { name: /^Teleport$/i });
    const clickBtn = screen.getByRole('button', { name: /Teleport to Click/i });

    expect((teleportBtn as HTMLButtonElement).disabled).toBe(true);
    expect((clickBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('teleportControls_withCharges_buttonsEnabled', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({ teleportMaxCharges: 2, teleportCharges: 1 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    const teleportBtn = screen.getByRole('button', { name: /^Teleport$/i });
    const clickBtn = screen.getByRole('button', { name: /Teleport to Click/i });

    expect((teleportBtn as HTMLButtonElement).disabled).toBe(false);
    expect((clickBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('teleportControls_rechargeTimer_showsCorrectTime — hours', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({
        teleportMaxCharges: 2,
        teleportCharges: 0,
        teleportRechargeTimeSec: 7380, // 2h 3m 0s
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    expect(screen.getByText(/Next charge in:.*2h 3m 0s/i)).toBeDefined();
  });

  it('teleportControls_rechargeTimer_showsCorrectTime — minutes only', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({
        teleportMaxCharges: 2,
        teleportCharges: 0,
        teleportRechargeTimeSec: 185, // 3m 5s
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    expect(screen.getByText(/Next charge in:.*3m 5s/i)).toBeDefined();
  });

  it('teleportControls_rechargeTimer_hiddenWhenAtMaxCharges', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({
        teleportMaxCharges: 2,
        teleportCharges: 2, // at max — no recharge timer
        teleportRechargeTimeSec: 50000,
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    expect(screen.queryByText(/Next charge in:/i)).toBeNull();
  });

  it('teleportControls_coordinateTeleport_callsTeleportShip', async () => {
    const mockRefetch = vi.fn();
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({ teleportMaxCharges: 1, teleportCharges: 1 }),
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<GamePageClient auth={baseAuth} />);

    const xInput = screen.getByLabelText('X:') as HTMLInputElement;
    const yInput = screen.getByLabelText('Y:') as HTMLInputElement;
    fireEvent.change(xInput, { target: { value: '1234' } });
    fireEvent.change(yInput, { target: { value: '5678' } });

    const teleportBtn = screen.getByRole('button', { name: /^Teleport$/i });
    fireEvent.click(teleportBtn);

    await waitFor(() => {
      expect(teleportShip).toHaveBeenCalledWith({ x: 1234, y: 5678, preserveVelocity: false });
    });
  });

  it('teleportControls_teleportToClickButton_togglesActiveState', async () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: makeTeleportData({ teleportMaxCharges: 2, teleportCharges: 1 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.useFakeTimers();

    await act(async () => {
      render(<GamePageClient auth={baseAuth} />);
    });

    // Flush requestAnimationFrame used by game initialisation
    await act(async () => {
      vi.runAllTimers();
    });

    vi.useRealTimers();

    const clickBtn = screen.getByRole('button', { name: /Teleport to Click/i });
    expect(clickBtn.className).not.toContain('active');

    await act(async () => {
      fireEvent.click(clickBtn);
    });

    // After activation: button label changes and hint appears
    expect(screen.getByRole('button', { name: /Cancel Click Teleport/i })).toBeDefined();
    expect(screen.getByText(/Click on map to teleport/i)).toBeDefined();
  });

  it('teleportControls_nullTeleportData_controlsNotRendered', () => {
    mockUseTeleportData.mockReturnValue({
      teleportData: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<GamePageClient auth={baseAuth} />);

    expect(screen.queryByText(/Teleport Charges/i)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Business logic: formatRechargeTime
// (extracted from component — test pure function behaviour)
// ────────────────────────────────────────────────────────────────────────────

function formatRechargeTime(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

describe('formatRechargeTime', () => {
  it('returns empty string for 0 seconds', () => {
    expect(formatRechargeTime(0)).toBe('');
  });

  it('returns seconds only for < 60s', () => {
    expect(formatRechargeTime(45)).toBe('45s');
  });

  it('returns minutes and seconds for < 1h', () => {
    expect(formatRechargeTime(185)).toBe('3m 5s');
  });

  it('returns hours minutes seconds', () => {
    expect(formatRechargeTime(7380)).toBe('2h 3m 0s');
  });

  it('returns 24h format correctly', () => {
    expect(formatRechargeTime(86400)).toBe('24h 0m 0s');
  });
});
