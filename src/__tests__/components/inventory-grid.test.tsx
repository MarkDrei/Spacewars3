import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InventoryGridComponent from '@/components/Inventory/InventoryGrid';
import { InventoryItemData } from '@/shared/inventoryShared';

describe('InventoryGridComponent drag callbacks', () => {
  const sampleItem: InventoryItemData = {
    itemType: 'commander',
    name: 'Draggy',
    imageId: 0,
    statBonuses: [],
  };

  it('calls onDragStartExternal and onDragEndExternal when dragging', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();

    const grid = [[sampleItem]]; // single-slot grid

    const { getByTitle } = render(
      <InventoryGridComponent
        grid={grid}
        selectedSlot={null}
        onSelectSlot={() => {}}
        onMoveItem={() => {}}
        maxSlots={1}
        gridKey="inventory"
        onDragStartExternal={onDragStart}
        onDragEndExternal={onDragEnd}
      />
    );

    const slot = getByTitle('Draggy');

    // verify that the <img> src uses the correct imageId
    const img = slot.querySelector('img');
    expect(img).not.toBeNull();
    if (img) {
      expect(img.getAttribute('src')).toContain('commander0.png');
    }

    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
    } as unknown as DataTransfer;

    fireEvent.dragStart(slot, { dataTransfer });
    expect(onDragStart).toHaveBeenCalledWith({ gridKey: 'inventory', row: 0, col: 0 });

    fireEvent.dragEnd(slot);
    expect(onDragEnd).toHaveBeenCalled();
  });
});
