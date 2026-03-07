'use client';

import React from 'react';
import Image from 'next/image';
import { CommanderData, COMMANDER_STAT_LABELS } from '@/shared/inventoryShared';
import './CommanderCard.css';

interface CommanderCardProps {
  commander: CommanderData;
  price: number;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}

const CommanderCard: React.FC<CommanderCardProps> = ({
  commander,
  price,
  actionLabel,
  onAction,
  disabled = false,
}) => {
  return (
    <div className="commander-card">
      <div className="commander-card-image-wrap">
        <Image
          src={`/assets/images/inventory/commander${commander.imageId}.png`}
          alt={commander.name}
          width={60}
          height={60}
          style={{ objectFit: 'contain' }}
          unoptimized
        />
      </div>
      <div className="commander-card-info">
        <h3 className="commander-card-name">{commander.name}</h3>
        <ul className="commander-card-bonuses">
          {commander.statBonuses.map((bonus) => (
            <li key={bonus.stat} className="commander-card-bonus">
              <span className="bonus-stat">{COMMANDER_STAT_LABELS[bonus.stat]}</span>
              <span className="bonus-value">+{bonus.value.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="commander-card-footer">
        <span className="commander-card-price">⚙ {price.toLocaleString()} Iron</span>
        <button
          className="commander-card-action-btn"
          onClick={onAction}
          disabled={disabled}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default CommanderCard;
