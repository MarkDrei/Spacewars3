import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useResearchStatus } from '@/lib/client/hooks/useResearchStatus';
import { researchService, type TechTree } from '@/lib/client/services/researchService';

vi.mock('@/lib/client/services/researchService', () => ({
  researchService: {
    getTechTree: vi.fn(),
    isResearchActive: (techTree: { activeResearch?: unknown }) => !!techTree.activeResearch,
  },
}));

const mockGetTechTree = vi.mocked(researchService.getTechTree);

const techTree = (active: boolean) =>
  ({ activeResearch: active ? { type: 'IronHarvesting', remainingDuration: 30 } : undefined }) as unknown as TechTree;

const techTreeResponse = (active: boolean) =>
  ({ techTree: techTree(active), researches: {} }) as Awaited<ReturnType<typeof researchService.getTechTree>>;

describe('useResearchStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('useResearchStatus_successfulFetch_returnsTreeAndActiveFlag', async () => {
    mockGetTechTree.mockResolvedValue(techTreeResponse(true));

    const { result } = renderHook(() => useResearchStatus(60_000));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isResearchActive).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test('useResearchStatus_errorAfterAllRetries_setsError', async () => {
    vi.useFakeTimers();
    mockGetTechTree.mockResolvedValue({ error: 'Server error: 500' });

    const { result } = renderHook(() => useResearchStatus(600_000));

    // initial attempt + 3 retries, 2 s apart
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
    }

    expect(mockGetTechTree).toHaveBeenCalledTimes(4);
    expect(result.current.error).toBe('Server error: 500');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.techTree).toBeNull();
  });

  test('useResearchStatus_polling_fetchesAgainAfterInterval', async () => {
    vi.useFakeTimers();
    mockGetTechTree.mockResolvedValue(techTreeResponse(false));

    renderHook(() => useResearchStatus(5000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockGetTechTree).toHaveBeenCalledTimes(2);
  });
});
