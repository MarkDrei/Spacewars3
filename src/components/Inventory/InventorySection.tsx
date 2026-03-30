'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InventoryGrid as InventoryGridType, InventoryItemData, SlotCoordinate, DEFAULT_INVENTORY_SLOTS, getInventoryRows, INVENTORY_COLS, SortStatKey, SortDirection, sortGrid, findItemSlot } from '@/shared/inventoryShared';
import InventoryGridComponent, { ExternalDropSource } from './InventoryGrid';
import ItemDetailsPanel from './ItemDetailsPanel';
import SortControls from './SortControls';

const makeEmptyGrid = (maxSlots: number): InventoryGridType =>
  Array.from({ length: getInventoryRows(maxSlots) }, () =>
    Array.from({ length: INVENTORY_COLS }, () => null)
  );

interface InventorySectionProps {
  /** Bump this value to force a re-fetch of inventory data (e.g. after a bridge→inventory transfer). */
  refreshTrigger?: number;
  /** Called after a successful bridge→inventory cross-transfer so the bridge can refresh. */
  onCrossTransferDone?: () => void;
  /** Optional callbacks to inform a parent when a drag begins/ends inside the grid. */
  onDragStart?: (source: ExternalDropSource) => void;
  onDragEnd?: () => void;
  /** Bump this value to clear the active sort (e.g. after an auto-assign drop into this section). */
  clearSortTrigger?: number;
}

const InventorySection: React.FC<InventorySectionProps> = ({ refreshTrigger, onCrossTransferDone, onDragStart, onDragEnd, clearSortTrigger }) => {
  const [maxSlots, setMaxSlots] = useState<number>(DEFAULT_INVENTORY_SLOTS);
  const [grid, setGrid] = useState<InventoryGridType>(makeEmptyGrid(DEFAULT_INVENTORY_SLOTS));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotCoordinate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortStatKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const fetchInventory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/inventory');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load inventory');
      }
      const data = await response.json();
      setMaxSlots(data.maxSlots ?? DEFAULT_INVENTORY_SLOTS);
      setGrid(data.grid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Re-fetch when the parent signals that bridge data changed
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchInventory();
    }
  }, [refreshTrigger, fetchInventory]);

  // Clear sort when the parent requests it (e.g. before an auto-assign drop lands here)
  useEffect(() => {
    if (clearSortTrigger !== undefined && clearSortTrigger > 0) {
      setSortBy(null);
    }
  }, [clearSortTrigger]);

  const displayGrid = useMemo(
    () => (sortBy !== null ? sortGrid(grid, INVENTORY_COLS, sortBy, sortDir) : grid),
    [grid, sortBy, sortDir],
  );

  // When sorting, translate click coordinates from display space → original grid space.
  const handleSelectSlot = (displaySlot: SlotCoordinate) => {
    if (sortBy !== null) {
      const item = displayGrid[displaySlot.row]?.[displaySlot.col];
      if (!item) { setSelectedSlot(null); return; }
      const orig = findItemSlot(grid, item);
      if (!orig) { setSelectedSlot(null); return; }
      setSelectedSlot(
        selectedSlot?.row === orig.row && selectedSlot?.col === orig.col ? null : orig
      );
    } else {
      const item = grid[displaySlot.row]?.[displaySlot.col];
      if (item === null || item === undefined) { setSelectedSlot(null); return; }
      setSelectedSlot(
        selectedSlot?.row === displaySlot.row && selectedSlot?.col === displaySlot.col ? null : displaySlot
      );
    }
  };

  // Pass selectedSlot to the grid in display coordinates so the right slot is highlighted.
  const displaySelectedSlot = useMemo<SlotCoordinate | null>(() => {
    if (sortBy === null || selectedSlot === null) return selectedSlot;
    const item = grid[selectedSlot.row]?.[selectedSlot.col];
    if (!item) return null;
    return findItemSlot(displayGrid, item);
  }, [sortBy, selectedSlot, grid, displayGrid]);

  const handleMoveItem = async (from: SlotCoordinate, to: SlotCoordinate) => {
    // Optimistic update
    const newGrid = grid.map((r) => [...r]);
    const item = newGrid[from.row][from.col];

    // Prevent moving to occupied slot (show error, no optimistic update)
    if (newGrid[to.row][to.col] !== null) {
      showStatus('❌ Target slot is occupied');
      return;
    }

    newGrid[to.row][to.col] = item;
    newGrid[from.row][from.col] = null;
    setGrid(newGrid);

    // Update selection to follow the moved item
    if (selectedSlot?.row === from.row && selectedSlot?.col === from.col) {
      setSelectedSlot(to);
    }

    try {
      const response = await fetch('/api/inventory/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      if (!response.ok) {
        const data = await response.json();
        showStatus(`❌ Move failed: ${data.error || 'Unknown error'}`);
        // Revert
        await fetchInventory();
      }
    } catch {
      showStatus('❌ Move failed. Please try again.');
      await fetchInventory();
    }
  };

  /** Handles an item dragged from the bridge onto an inventory slot. */
  const handleExternalDrop = async (from: ExternalDropSource, to: SlotCoordinate) => {
    if (from.gridKey !== 'bridge') return;
    try {
      const response = await fetch('/api/bridge/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'bridgeToInventory',
          from: { row: from.row, col: from.col },
          to,
        }),
      });
      if (response.ok) {
        showStatus('✅ Moved from bridge to inventory');
        await fetchInventory();
        onCrossTransferDone?.();
      } else {
        const data = await response.json();
        showStatus(`❌ Transfer failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      showStatus('❌ Transfer failed. Please try again.');
    }
  };

  const handleDelete = async (slot: SlotCoordinate) => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: slot.row, col: slot.col }),
      });
      if (response.ok) {
        const newGrid = grid.map((r) => [...r]);
        newGrid[slot.row][slot.col] = null;
        setGrid(newGrid);
        setSelectedSlot(null);
        showStatus('✅ Item deleted');
      } else {
        const data = await response.json();
        showStatus(`❌ Delete failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      showStatus('❌ Delete failed. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  /** Save the current sorted order to the backend, then clear sorting. */
  const handleSaveOrder = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/inventory/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid: displayGrid }),
      });
      if (response.ok) {
        setGrid(displayGrid);
        setSortBy(null);
        setSelectedSlot(null);
        showStatus('✅ Order saved');
      } else {
        const data = await response.json();
        showStatus(`❌ Save failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      showStatus('❌ Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedItem: InventoryItemData | null =
    selectedSlot !== null ? (grid[selectedSlot.row]?.[selectedSlot.col] ?? null) : null;

  const handleSortChange = useCallback((by: SortStatKey | null, dir: SortDirection) => {
    setSortBy(by);
    setSortDir(dir);
    setSelectedSlot(null);
  }, []);

  return (
    <section className="inventory-section">
      <div className="section-heading-row">
        <h2 className="inventory-heading">Inventory</h2>
        <SortControls
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
        />
        {sortBy !== null && (
          <button
            type="button"
            className="sort-save-btn"
            onClick={handleSaveOrder}
            disabled={isSaving}
            title="Save the current sorted order and re-enable drag & drop"
          >
            {isSaving ? 'Saving…' : '💾 Save order'}
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="inventory-status-message">{statusMessage}</div>
      )}

      {isLoading && <p className="inventory-loading">Loading inventory…</p>}
      {error && <p className="inventory-error">{error}</p>}

      {!isLoading && !error && (
        <div className="inventory-layout">
          <InventoryGridComponent
            grid={displayGrid}
            selectedSlot={displaySelectedSlot}
            onSelectSlot={handleSelectSlot}
            onMoveItem={handleMoveItem}
            maxSlots={maxSlots}
            gridKey="inventory"
            onExternalDrop={handleExternalDrop}
            onDragStartExternal={onDragStart}
            onDragEndExternal={onDragEnd}
            sortingActive={sortBy !== null}
          />
          {selectedItem !== null && selectedSlot !== null ? (
            <ItemDetailsPanel
              item={selectedItem}
              slot={selectedSlot}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
          ) : (
            <div className="inventory-no-selection">
              <p>{sortBy !== null ? 'Click an item to see details. Drag & drop is disabled while sorting.' : 'Click an item to see its details.'}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default InventorySection;
