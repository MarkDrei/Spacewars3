'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { InventoryItemData, CargoItemData, CommanderData, SlotCoordinate } from '@/shared/inventoryShared';
import { getCargo } from '@/shared/quests/questDefinitions';
import { cargoSourceText } from '@/shared/quests/questTexts';

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

/** Mission cargo: what it is, how much is aboard, which mission needs it and where it comes from. */
const CargoDetails: React.FC<{ data: CargoItemData }> = ({ data }) => {
  const t = useTranslations('ship');
  const tQuests = useTranslations('quests');
  const definition = getCargo(data.cargoId);
  return (
    <div className="item-details-cargo">
      <div className="item-details-image-wrap">
        <Image
          src="/assets/images/inventory/cargo.svg"
          alt={tQuests(`cargo.${data.cargoId}.name`)}
          width={200}
          height={200}
          style={{ objectFit: 'contain' }}
          unoptimized
        />
      </div>
      <h3 className="item-details-name">{tQuests(`cargo.${data.cargoId}.name`)}</h3>
      <p className="item-details-type">{t('cargoType')}</p>
      <p className="item-details-text">{tQuests(`cargo.${data.cargoId}.description`)}</p>
      <ul className="item-details-bonuses">
        <li className="item-details-bonus">
          <span className="bonus-stat">{t('cargoQuantity')}</span>
          <span className="bonus-value">{data.quantity}</span>
        </li>
        {definition && (
          <li className="item-details-bonus">
            <span className="bonus-stat">{t('cargoMission')}</span>
            <span className="bonus-value">{tQuests(`quest.${definition.questId}.title`)}</span>
          </li>
        )}
      </ul>
      {definition && <p className="item-details-text">{cargoSourceText(tQuests, definition.source)}</p>}
      <p className="item-details-text item-details-text--hint">{t('cargoKeepHint')}</p>
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
      {item.itemType === 'cargo' && <CargoDetails data={item} />}
      {/* Mission cargo belongs to its mission and cannot be discarded */}
      {item.itemType !== 'cargo' && (
        <button
          className="item-details-delete-btn"
          onClick={() => onDelete(slot)}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting…' : '🗑 Delete Item'}
        </button>
      )}
    </div>
  );
};

export default ItemDetailsPanel;
