'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { InventoryGrid as InventoryGridType, InventorySlot, SlotCoordinate, INVENTORY_COLS, DEFAULT_INVENTORY_SLOTS } from '@/shared/inventoryShared';

const GRID_GAP_PX = 3;
const MAX_SLOT_SIZE_PX = 130;

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
  /** When true, dropping items INTO this grid is disabled (items can still be dragged OUT). */
  sortingActive?: boolean;
  /**
   * When sortingActive is true, translates a display-space slot coordinate to the
   * original (server-stored) coordinate. If omitted when sortingActive is true,
   * display coords are used as-is.
   */
  resolveOriginalCoord?: (displaySlot: SlotCoordinate) => SlotCoordinate | null;
  /** Preferred fallback column count when the full grid width does not fit. */
  fallbackCols?: number;
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
  sortingActive = false,
  resolveOriginalCoord,
  fallbackCols: fallbackColsProp,
}) => {
  const cols = colsProp ?? INVENTORY_COLS;
  const fallbackCols = Math.max(1, Math.min(fallbackColsProp ?? cols, cols));
  const [dragSource, setDragSource] = useState<SlotCoordinate | null>(null);
  const [dragOver, setDragOver] = useState<SlotCoordinate | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      setContainerWidth(node.clientWidth);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  let displayCols = cols;
  let slotSize = MAX_SLOT_SIZE_PX;

  if (containerWidth !== null && containerWidth > 0) {
    const fullGridWidth = cols * MAX_SLOT_SIZE_PX + (cols - 1) * GRID_GAP_PX;
    const fallbackGridWidth =
      fallbackCols * MAX_SLOT_SIZE_PX + (fallbackCols - 1) * GRID_GAP_PX;

    if (containerWidth < fullGridWidth) {
      displayCols = fallbackCols;

      if (containerWidth < fallbackGridWidth) {
        slotSize = Math.max(
          0,
          (containerWidth - (displayCols - 1) * GRID_GAP_PX) / displayCols,
        );
      }
    }
  }

  const slotStyle = {
    '--inv-display-cols': String(displayCols),
    '--inv-slot-size': `${slotSize}px`,
  } as React.CSSProperties;

  const slots = Array.from({ length: maxSlots }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    return {
      row,
      col,
      item: grid[row]?.[col] ?? null,
    };
  });

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
    // When sorting is active, translate display coords to original coords so server
    // operations target the correct persisted slot.
    let sourceRow = row;
    let sourceCol = col;
    if (sortingActive && resolveOriginalCoord) {
      const orig = resolveOriginalCoord({ row, col });
      if (!orig) { e.preventDefault(); return; }
      sourceRow = orig.row;
      sourceCol = orig.col;
    }
    const source = { gridKey, row: sourceRow, col: sourceCol };
    setDragSource({ row, col }); // display coords for visual highlight
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(source));
    onDragStartExternal?.(source);
  };

  const handleDragOver = (e: React.DragEvent, row: number, col: number) => {
    if (sortingActive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ row, col });
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    if (sortingActive) return;
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
    <div className="inv-grid-wrap" ref={containerRef}>
      <div
        className="inv-grid"
        ref={dragImageRef}
        style={slotStyle}
        data-display-cols={displayCols}
        data-slot-size={slotSize.toFixed(2)}
      >
        {slots.map(({ row, col, item }) => (
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
                width={120}
                height={120}
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '120px',
                  maxHeight: '120px',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                }}
                unoptimized
              />
            ) : (
              <Image
                src="/assets/images/inventory/empty.png"
                alt="Empty slot"
                width={120}
                height={120}
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '120px',
                  maxHeight: '120px',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  opacity: 0.2,
                }}
                unoptimized
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryGridComponent;
