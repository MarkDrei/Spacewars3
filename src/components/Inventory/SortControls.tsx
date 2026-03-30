'use client';

import React from 'react';
import { CommanderStatKey, COMMANDER_STAT_LABELS, SortStatKey, SortDirection } from '@/shared/inventoryShared';

interface SortControlsProps {
  sortBy: SortStatKey | null;
  sortDir: SortDirection;
  onSortChange: (sortBy: SortStatKey | null, sortDir: SortDirection) => void;
  /** Accent color used for the active button border/glow. Defaults to #4fc3f7. */
  accentColor?: string;
}

const STAT_KEYS: CommanderStatKey[] = [
  'shipSpeed',
  'projectileWeaponDamage',
  'projectileWeaponReloadRate',
  'projectileWeaponAccuracy',
  'energyWeaponDamage',
  'energyWeaponReloadRate',
  'energyWeaponAccuracy',
];

/** Short labels used inside the compact sort buttons. */
const SORT_BUTTON_LABELS: Record<CommanderStatKey | 'total', string> = {
  shipSpeed: 'Speed',
  projectileWeaponDamage: 'Proj. Dmg',
  projectileWeaponReloadRate: 'Proj. Reload',
  projectileWeaponAccuracy: 'Proj. Acc.',
  energyWeaponDamage: 'Enrg. Dmg',
  energyWeaponReloadRate: 'Enrg. Reload',
  energyWeaponAccuracy: 'Enrg. Acc.',
  total: 'Total',
};

const SortControls: React.FC<SortControlsProps> = ({
  sortBy,
  sortDir,
  onSortChange,
  accentColor = '#4fc3f7',
}) => {
  const handleStatClick = (stat: SortStatKey) => {
    if (sortBy === stat) {
      // Toggle direction if already sorted by this stat
      onSortChange(stat, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // New stat: start descending (highest first)
      onSortChange(stat, 'desc');
    }
  };

  const handleClearSort = () => {
    onSortChange(null, 'desc');
  };

  const allKeys: SortStatKey[] = [...STAT_KEYS, 'total'];

  return (
    <div className="sort-controls" aria-label="Sort controls">
      <span className="sort-controls-label">Sort:</span>
      <div className="sort-controls-buttons">
        {allKeys.map((key) => {
          const active = sortBy === key;
          return (
            <button
              key={key}
              type="button"
              className={`sort-btn${active ? ' sort-btn--active' : ''}`}
              style={active ? { borderColor: accentColor, color: accentColor } : undefined}
              onClick={() => handleStatClick(key)}
              title={key === 'total' ? 'Sum of all stats' : COMMANDER_STAT_LABELS[key as CommanderStatKey]}
            >
              {SORT_BUTTON_LABELS[key]}
              {active && (
                <span className="sort-btn-dir" aria-label={sortDir === 'asc' ? 'ascending' : 'descending'}>
                  {sortDir === 'asc' ? ' ↑' : ' ↓'}
                </span>
              )}
            </button>
          );
        })}
        {sortBy !== null && (
          <button
            type="button"
            className="sort-btn sort-btn--clear"
            onClick={handleClearSort}
            title="Clear sorting"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default SortControls;
