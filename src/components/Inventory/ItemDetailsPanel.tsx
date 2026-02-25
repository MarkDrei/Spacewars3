'use client';

import React from 'react';
import Image from 'next/image';
import { InventoryItemData, CommanderData, SlotCoordinate, COMMANDER_STAT_LABELS } from '@/shared/inventoryShared';

interface ItemDetailsPanelProps {
  item: InventoryItemData;
  slot: SlotCoordinate;
  onDelete: (slot: SlotCoordinate) => void;
  isDeleting: boolean;
}

const CommanderDetails: React.FC<{ data: CommanderData }> = ({ data }) => (
  <div className="item-details-commander">
    <div className="item-details-image-wrap">
      <Image
        src={`/assets/images/inventory/commander${data.imageId}.png`}
        alt={data.name}
        width={80}
        height={80}
        style={{ objectFit: 'contain' }}
        unoptimized
      />
    </div>
    <h3 className="item-details-name">{data.name}</h3>
    <p className="item-details-type">Commander</p>
    <ul className="item-details-bonuses">
      {data.statBonuses.map((bonus) => (
        <li key={bonus.stat} className="item-details-bonus">
          <span className="bonus-stat">{COMMANDER_STAT_LABELS[bonus.stat]}</span>
          <span className="bonus-value">+{bonus.value.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  </div>
);

const ItemDetailsPanel: React.FC<ItemDetailsPanelProps> = ({
  item,
  slot,
  onDelete,
  isDeleting,
}) => {
  return (
    <div className="item-details-panel">
      <h2 className="item-details-heading">Selected Item</h2>
      <p className="item-details-slot">
        Slot: row {slot.row}, col {slot.col}
      </p>
      {item.itemType === 'commander' && <CommanderDetails data={item} />}
      <button
        className="item-details-delete-btn"
        onClick={() => onDelete(slot)}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting…' : '🗑 Delete Item'}
      </button>
    </div>
  );
};

export default ItemDetailsPanel;
