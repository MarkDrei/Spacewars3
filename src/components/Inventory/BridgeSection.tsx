'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BridgeGrid, InventoryItemData, SlotCoordinate, BRIDGE_COLS, getBridgeRows } from '@/shared/inventoryShared';
import InventoryGridComponent, { ExternalDropSource } from './InventoryGrid';
import ItemDetailsPanel from './ItemDetailsPanel';

const makeEmptyBridgeGrid = (maxSlots: number): BridgeGrid => {
  if (maxSlots === 0) return [];
  return Array.from({ length: getBridgeRows(maxSlots) }, () =>
    Array.from({ length: BRIDGE_COLS }, () => null)
  );
};

interface BridgeSectionProps {
  /** Bump this value to force a re-fetch of bridge data (e.g. after an inventory→bridge transfer). */
  refreshTrigger?: number;
  /** Called after a successful inventory→bridge cross-transfer so the inventory can refresh. */
  onCrossTransferDone?: () => void;
  /** Propagate drag start/end events so a parent can show global drop zones. */
  onDragStart?: (source: ExternalDropSource) => void;
  onDragEnd?: () => void;
}

const BridgeSection: React.FC<BridgeSectionProps> = ({ refreshTrigger, onCrossTransferDone, onDragStart, onDragEnd }) => {
  const [maxBridgeSlots, setMaxBridgeSlots] = useState<number>(0);
  const [grid, setGrid] = useState<BridgeGrid>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotCoordinate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const fetchBridge = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/bridge');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load bridge');
      }
      const data = await response.json();
      setMaxBridgeSlots(data.maxBridgeSlots ?? 0);
      setGrid(data.grid ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bridge');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBridge();
  }, [fetchBridge]);

  // Re-fetch when the parent signals that inventory data changed
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchBridge();
    }
  }, [refreshTrigger, fetchBridge]);

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

  /** Move an item within the bridge. */
  const handleMoveItem = async (from: SlotCoordinate, to: SlotCoordinate) => {
    const newGrid = grid.map((r) => [...r]);
    const item = newGrid[from.row]?.[from.col];

    if (newGrid[to.row]?.[to.col] !== null) {
      showStatus('❌ Target slot is occupied');
      return;
    }

    // Optimistic update
    newGrid[to.row][to.col] = item ?? null;
    newGrid[from.row][from.col] = null;
    setGrid(newGrid);

    if (selectedSlot?.row === from.row && selectedSlot?.col === from.col) {
      setSelectedSlot(to);
    }

    try {
      const response = await fetch('/api/bridge/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      if (!response.ok) {
        const data = await response.json();
        showStatus(`❌ Move failed: ${data.error || 'Unknown error'}`);
        await fetchBridge();
      }
    } catch {
      showStatus('❌ Move failed. Please try again.');
      await fetchBridge();
    }
  };

  /** Handles an item dragged from the inventory onto a bridge slot. */
  const handleExternalDrop = async (from: ExternalDropSource, to: SlotCoordinate) => {
    if (from.gridKey !== 'inventory') return;
    try {
      const response = await fetch('/api/bridge/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'inventoryToBridge',
          from: { row: from.row, col: from.col },
          to,
        }),
      });
      if (response.ok) {
        showStatus('✅ Moved from inventory to bridge');
        await fetchBridge();
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
      const response = await fetch('/api/bridge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: slot.row, col: slot.col }),
      });
      if (response.ok) {
        const newGrid = grid.map((r) => [...r]);
        newGrid[slot.row][slot.col] = null;
        setGrid(newGrid);
        setSelectedSlot(null);
        showStatus('✅ Item removed from bridge');
      } else {
        const data = await response.json();
        showStatus(`❌ Remove failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      showStatus('❌ Remove failed. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedItem: InventoryItemData | null =
    selectedSlot !== null ? (grid[selectedSlot.row]?.[selectedSlot.col] ?? null) : null;

  // If the player hasn't researched bridge slots yet, show a locked message
  if (!isLoading && !error && maxBridgeSlots === 0) {
    return (
      <section className="bridge-section bridge-section--locked">
        <h2 className="bridge-heading">Bridge</h2>
        <p className="bridge-locked-message">
          🔒 Research <strong>Bridge Slots</strong> to unlock your bridge crew system.
        </p>
      </section>
    );
  }

  return (
    <section className="bridge-section">
      <h2 className="bridge-heading">Bridge</h2>
      <p className="bridge-intro">
        Assign commanders to bridge positions. Drag items from Inventory to assign, or drag them back.
      </p>

      {statusMessage && (
        <div className="bridge-status-message">{statusMessage}</div>
      )}

      {isLoading && <p className="bridge-loading">Loading bridge…</p>}
      {error && <p className="bridge-error">{error}</p>}

      {!isLoading && !error && (
        <div className="inventory-layout">
          <InventoryGridComponent
            grid={grid.length > 0 ? grid : makeEmptyBridgeGrid(maxBridgeSlots)}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSelectSlot}
            onMoveItem={handleMoveItem}
            maxSlots={maxBridgeSlots}
            gridKey="bridge"
            cols={BRIDGE_COLS}
            onExternalDrop={handleExternalDrop}
            onDragStartExternal={onDragStart}
            onDragEndExternal={onDragEnd}
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
              <p>Drag a commander here from Inventory, or click an assigned commander to see details.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default BridgeSection;
