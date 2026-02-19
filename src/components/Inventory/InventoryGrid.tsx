'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { InventoryGrid as InventoryGridType, InventorySlot, SlotCoordinate } from '@/shared/inventoryShared';

interface InventoryGridProps {
  grid: InventoryGridType;
  selectedSlot: SlotCoordinate | null;
  onSelectSlot: (slot: SlotCoordinate) => void;
  onMoveItem: (from: SlotCoordinate, to: SlotCoordinate) => void;
}

const InventoryGridComponent: React.FC<InventoryGridProps> = ({
  grid,
  selectedSlot,
  onSelectSlot,
  onMoveItem,
}) => {
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
    setDragSource({ row, col });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ row, col }));
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
    if (!dragSource) return;
    if (dragSource.row === row && dragSource.col === col) return;
    // Only allow dropping on empty slot or swap is handled by the service
    onMoveItem(dragSource, { row, col });
    setDragSource(null);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOver(null);
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
      {Array.from({ length: 10 }, (_, row) =>
        Array.from({ length: 10 }, (_, col) => {
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
                  src={`/assets/images/inventory/${item.itemType}.png`}
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
