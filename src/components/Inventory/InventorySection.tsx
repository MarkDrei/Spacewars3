'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { InventoryGrid as InventoryGridType, InventoryItemData, SlotCoordinate, DEFAULT_INVENTORY_SLOTS, getInventoryRows, INVENTORY_COLS } from '@/shared/inventoryShared';
import InventoryGridComponent from './InventoryGrid';
import ItemDetailsPanel from './ItemDetailsPanel';

const makeEmptyGrid = (maxSlots: number): InventoryGridType =>
  Array.from({ length: getInventoryRows(maxSlots) }, () =>
    Array.from({ length: INVENTORY_COLS }, () => null)
  );

const InventorySection: React.FC = () => {
  const [maxSlots, setMaxSlots] = useState<number>(DEFAULT_INVENTORY_SLOTS);
  const [grid, setGrid] = useState<InventoryGridType>(makeEmptyGrid(DEFAULT_INVENTORY_SLOTS));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotCoordinate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  const handleSelectSlot = (slot: SlotCoordinate) => {
    const item = grid[slot.row]?.[slot.col];
    if (item === null || item === undefined) {
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot(
      selectedSlot?.row === slot.row && selectedSlot?.col === slot.col ? null : slot
    );
  };

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

  const selectedItem: InventoryItemData | null =
    selectedSlot !== null ? (grid[selectedSlot.row]?.[selectedSlot.col] ?? null) : null;

  return (
    <section className="inventory-section">
      <h2 className="inventory-heading">Inventory</h2>

      {statusMessage && (
        <div className="inventory-status-message">{statusMessage}</div>
      )}

      {isLoading && <p className="inventory-loading">Loading inventory…</p>}
      {error && <p className="inventory-error">{error}</p>}

      {!isLoading && !error && (
        <div className="inventory-layout">
          <InventoryGridComponent
            grid={grid}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSelectSlot}
            onMoveItem={handleMoveItem}
            maxSlots={maxSlots}
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
              <p>Click an item to see its details.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default InventorySection;
