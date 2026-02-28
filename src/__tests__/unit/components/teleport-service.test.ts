// Tests for teleportService and UserStatsResponse type
// Extracted from ui/components/teleport-controls.test.tsx (GamePageClient UI tests remain in ui/)
import { describe, it, expect, vi, beforeEach } from 'vitest';

// teleportService is NOT mocked — the real implementation is used
import { teleportShip, TeleportRequest, TeleportResponse } from '@/lib/client/services/teleportService';
import { UserStatsResponse } from '@/lib/client/services/userStatsService';

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
