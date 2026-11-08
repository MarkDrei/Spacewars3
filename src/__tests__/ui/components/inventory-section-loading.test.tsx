import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InventorySection from '@/components/Inventory/InventorySection';
import { DEFAULT_INVENTORY_SLOTS } from '@/shared/inventoryShared';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Child components are not under test here
vi.mock('@/components/Inventory/InventoryGrid', () => ({
  default: () => <div data-testid="inventory-grid" />,
}));
vi.mock('@/components/Inventory/ItemDetailsPanel', () => ({
  default: () => null,
}));
vi.mock('@/components/Inventory/SortControls', () => ({
  default: ({ onSortChange }: { onSortChange: (by: 'total' | null, dir: 'asc' | 'desc') => void }) => (
    <button type="button" onClick={() => onSortChange('total', 'desc')}>sort-by-total</button>
  ),
}));

const okResponse = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ maxSlots: DEFAULT_INVENTORY_SLOTS, grid: [[null, null, null, null]] }),
  } as Response);

describe('InventorySection loading', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inventorySection_initialLoad_showsLoadingThenGrid', async () => {
    fetchMock.mockImplementation(okResponse);

    render(<InventorySection />);

    expect(screen.getByText('loadingInventory')).toBeDefined();
    await waitFor(() => expect(screen.getByTestId('inventory-grid')).toBeDefined());
    expect(screen.queryByText('loadingInventory')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/inventory');
  });

  it('inventorySection_loadFails_showsServerError', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'Inventory unavailable' }) } as Response);

    render(<InventorySection />);

    await waitFor(() => expect(screen.getByText('Inventory unavailable')).toBeDefined());
    expect(screen.queryByTestId('inventory-grid')).toBeNull();
  });

  it('inventorySection_refreshTriggerBumped_refetchesWithoutHidingGrid', async () => {
    fetchMock.mockImplementation(okResponse);
    const { rerender } = render(<InventorySection refreshTrigger={0} />);
    await waitFor(() => expect(screen.getByTestId('inventory-grid')).toBeDefined());

    rerender(<InventorySection refreshTrigger={1} />);

    // Background refresh: grid stays visible, no loading indicator
    expect(screen.getByTestId('inventory-grid')).toBeDefined();
    expect(screen.queryByText('loadingInventory')).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('inventorySection_clearSortTriggerBumped_clearsActiveSort', async () => {
    fetchMock.mockImplementation(okResponse);
    const { rerender } = render(<InventorySection clearSortTrigger={0} />);
    await waitFor(() => expect(screen.getByTestId('inventory-grid')).toBeDefined());

    fireEvent.click(screen.getByText('sort-by-total'));
    expect(screen.getByText('💾 Save order')).toBeDefined();

    rerender(<InventorySection clearSortTrigger={1} />);

    expect(screen.queryByText('💾 Save order')).toBeNull();
  });
});
