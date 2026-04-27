'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { InventoryItemData, CommanderData, SlotCoordinate } from '@/shared/inventoryShared';

interface ItemDetailsPanelProps {
  item: InventoryItemData;
  slot: SlotCoordinate;
  onDelete: (slot: SlotCoordinate) => void;
  isDeleting: boolean;
}

const CommanderDetails: React.FC<{ data: CommanderData }> = ({ data }) => {
  const t = useTranslations('ship');
  return (
  <div className="item-details-commander">
    <div className="item-details-image-wrap">
      <Image
        src={`/assets/images/inventory/commander${data.imageId}.png`}
        alt={data.name}
        width={200}
        height={200}
        style={{ objectFit: 'contain' }}
        unoptimized
      />
    </div>
    <h3 className="item-details-name">{data.name}</h3>
    <p className="item-details-type">{t('commanderType')}</p>
    <ul className="item-details-bonuses">
      {data.statBonuses.map((bonus) => (
        <li key={bonus.stat} className="item-details-bonus">
          <span className="bonus-stat">{t(`commanderStats.${bonus.stat}` as Parameters<typeof t>[0])}</span>
          <span className="bonus-value">+{bonus.value.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  </div>
  );
};

const ItemDetailsPanel: React.FC<ItemDetailsPanelProps> = ({
  item,
  slot,
  onDelete,
  isDeleting,
}) => {
  const t = useTranslations('ship');
  return (
    <div className="item-details-panel">
      <h2 className="item-details-heading">{t('selectedItemHeading')}</h2>
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
