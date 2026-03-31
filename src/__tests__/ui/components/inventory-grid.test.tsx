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

describe('InventoryGridComponent sortingActive', () => {
  const itemA: InventoryItemData = {
    itemType: 'commander',
    name: 'Alpha',
    imageId: 1,
    statBonuses: [{ stat: 'shipSpeed', value: 10 }],
  };
  const itemB: InventoryItemData = {
    itemType: 'commander',
    name: 'Beta',
    imageId: 2,
    statBonuses: [{ stat: 'shipSpeed', value: 3 }],
  };

  function makeDataTransfer() {
    let stored = '';
    return {
      setData: vi.fn((_type: string, val: string) => { stored = val; }),
      getData: vi.fn(() => stored),
      effectAllowed: '',
      dropEffect: '',
    } as unknown as DataTransfer;
  }

  it('dragStart_sortingActive_usesOriginalCoordsFromResolver', () => {
    // Display grid: [Beta, Alpha] (sorted by speed desc produces Beta first? No: Alpha=10, Beta=3)
    // Let's say display has Alpha at [0,0], Beta at [0,1], but original is reversed: Beta at [0,0], Alpha at [0,1]
    const displayGrid = [[itemA, itemB]];
    const onDragStart = vi.fn();
    const dataTransfer = makeDataTransfer();

    // resolveOriginalCoord: Alpha is at original [0,1], Beta at original [0,0]
    const resolveOriginalCoord = vi.fn((slot: { row: number; col: number }) => {
      // display [0,0] = Alpha → original [0,1]
      if (slot.row === 0 && slot.col === 0) return { row: 0, col: 1 };
      // display [0,1] = Beta → original [0,0]
      if (slot.row === 0 && slot.col === 1) return { row: 0, col: 0 };
      return null;
    });

    const { getByTitle } = render(
      <InventoryGridComponent
        grid={displayGrid}
        selectedSlot={null}
        onSelectSlot={() => {}}
        onMoveItem={() => {}}
        maxSlots={2}
        gridKey="inventory"
        onDragStartExternal={onDragStart}
        sortingActive={true}
        resolveOriginalCoord={resolveOriginalCoord}
      />
    );

    // Drag the display-slot-0 item (Alpha)
    const slot = getByTitle('Alpha');
    fireEvent.dragStart(slot, { dataTransfer });

    // onDragStartExternal should report original coords (row:0, col:1), not display (row:0, col:0)
    expect(onDragStart).toHaveBeenCalledWith({ gridKey: 'inventory', row: 0, col: 1 });
    expect(resolveOriginalCoord).toHaveBeenCalledWith({ row: 0, col: 0 });
  });

  it('dragOver_sortingActive_doesNotAllowDrop', () => {
    const grid = [[itemA, null]];
    const { getByTitle } = render(
      <InventoryGridComponent
        grid={grid}
        selectedSlot={null}
        onSelectSlot={() => {}}
        onMoveItem={() => {}}
        maxSlots={2}
        gridKey="inventory"
        sortingActive={true}
      />
    );

    const slot = getByTitle('Alpha');
    const event = new MouseEvent('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: makeDataTransfer() });
    // If sortingActive, preventDefault should NOT be called → drop is not allowed
    const prevented = !slot.dispatchEvent(event);
    expect(prevented).toBe(false);
  });

  it('dragStart_sortingActiveWithoutResolver_usesDisplayCoords', () => {
    // Fallback: no resolveOriginalCoord provided → display coords pass through
    const grid = [[itemA]];
    const onDragStart = vi.fn();
    const dataTransfer = makeDataTransfer();

    const { getByTitle } = render(
      <InventoryGridComponent
        grid={grid}
        selectedSlot={null}
        onSelectSlot={() => {}}
        onMoveItem={() => {}}
        maxSlots={1}
        gridKey="bridge"
        onDragStartExternal={onDragStart}
        sortingActive={true}
      />
    );

    const slot = getByTitle('Alpha');
    fireEvent.dragStart(slot, { dataTransfer });

    expect(onDragStart).toHaveBeenCalledWith({ gridKey: 'bridge', row: 0, col: 0 });
  });
});
