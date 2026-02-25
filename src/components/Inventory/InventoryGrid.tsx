'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { InventoryGrid as InventoryGridType, InventorySlot, SlotCoordinate, INVENTORY_COLS, DEFAULT_INVENTORY_SLOTS } from '@/shared/inventoryShared';

export interface ExternalDropSource {
  gridKey: string;
  row: number;
  col: number;
}

interface InventoryGridProps {
  grid: InventoryGridType;
  selectedSlot: SlotCoordinate | null;
  onSelectSlot: (slot: SlotCoordinate) => void;
  onMoveItem: (from: SlotCoordinate, to: SlotCoordinate) => void;
  /** Total number of available inventory slots (from InventorySlots research). Defaults to DEFAULT_INVENTORY_SLOTS. */
  maxSlots?: number;
  /** Identifier for this grid used in drag data. Defaults to 'inventory'. */
  gridKey?: string;
  /** Number of columns. Defaults to INVENTORY_COLS (8). */
  cols?: number;
  /** Called when an item is dropped from a different grid (gridKey mismatch). */
  onExternalDrop?: (from: ExternalDropSource, to: SlotCoordinate) => void;
  /** Notifies parent that dragging has started for a slot. */
  onDragStartExternal?: (source: ExternalDropSource) => void;
  /** Notifies parent that dragging has ended (either drop or cancel). */
  onDragEndExternal?: () => void;
}

const InventoryGridComponent: React.FC<InventoryGridProps> = ({
  grid,
  selectedSlot,
  onSelectSlot,
  onMoveItem,
  maxSlots = DEFAULT_INVENTORY_SLOTS,
  gridKey = 'inventory',
  cols: colsProp,
  onExternalDrop,
  onDragStartExternal,
  onDragEndExternal,
}) => {
  const cols = colsProp ?? INVENTORY_COLS;
  const rows = Math.ceil(maxSlots / cols);
  const [dragSource, setDragSource] = useState<SlotCoordinate | null>(null);
  const [dragOver, setDragOver] = useState<SlotCoordinate | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  const isSelected = (row: number, col: number) =>
    selectedSlot?.row === row && selectedSlot?.col === col;

  const isDragOver = (row: number, col: number) =>
    dragOver?.row === row && dragOver?.col === col;

  const isDragSource = (row: number, col: number) =>
    dragSource?.row === row && dragSource?.col === col;

  const handleDragStart = (e: React.DragEvent, row: number, col: number) => {
    const slot: InventorySlot = grid[row][col];
    if (slot === null) {
      e.preventDefault();
      return;
    }
    const source = { gridKey, row, col };
    setDragSource({ row, col });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(source));
    onDragStartExternal?.(source);
  };

  const handleDragOver = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ row, col });
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    setDragOver(null);
    let sourceGridKey = gridKey;
    let sourceRow: number | undefined;
    let sourceCol: number | undefined;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      sourceGridKey = data.gridKey ?? gridKey;
      sourceRow = data.row;
      sourceCol = data.col;
    } catch {
      // fallback to dragSource state
    }
    if (sourceRow === undefined || sourceCol === undefined) {
      if (!dragSource) return;
      sourceRow = dragSource.row;
      sourceCol = dragSource.col;
    }
    const to = { row, col };
    if (sourceGridKey !== gridKey) {
      // Cross-grid drop
      onExternalDrop?.({ gridKey: sourceGridKey, row: sourceRow, col: sourceCol }, to);
      setDragSource(null);
      return;
    }
    const from = { row: sourceRow, col: sourceCol };
    if (from.row === row && from.col === col) return;
    onMoveItem(from, to);
    setDragSource(null);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOver(null);
    onDragEndExternal?.();
  };

  const handleClick = (row: number, col: number) => {
    onSelectSlot({ row, col });
  };

  const getSlotClassName = (row: number, col: number): string => {
    const classes = ['inv-slot'];
    const item = grid[row]?.[col];
    if (item !== null && item !== undefined) classes.push('inv-slot--occupied');
    if (isSelected(row, col)) classes.push('inv-slot--selected');
    if (isDragOver(row, col)) classes.push('inv-slot--drag-over');
    if (isDragSource(row, col)) classes.push('inv-slot--drag-source');
    return classes.join(' ');
  };

  return (
    <div className="inv-grid" ref={dragImageRef}>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const item = grid[row]?.[col] ?? null;
          return (
            <div
              key={`${row}-${col}`}
              className={getSlotClassName(row, col)}
              onClick={() => handleClick(row, col)}
              draggable={item !== null}
              onDragStart={(e) => handleDragStart(e, row, col)}
              onDragOver={(e) => handleDragOver(e, row, col)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, row, col)}
              onDragEnd={handleDragEnd}
              title={item ? (item.itemType === 'commander' ? item.name : item.itemType) : ''}
            >
              {item !== null ? (
                <Image
                  src={
                    item.itemType === 'commander'
                      ? `/assets/images/inventory/commander${item.imageId}.png`
                      : `/assets/images/inventory/${item.itemType}.png`
                  }
                  alt={item.itemType === 'commander' ? item.name : item.itemType}
                  width={48}
                  height={48}
                  style={{ objectFit: 'contain', pointerEvents: 'none' }}
                  unoptimized
                />
              ) : (
                <Image
                  src="/assets/images/inventory/empty.png"
                  alt="Empty slot"
                  width={48}
                  height={48}
                  style={{ objectFit: 'contain', pointerEvents: 'none', opacity: 0.2 }}
                  unoptimized
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default InventoryGridComponent;
