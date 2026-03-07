import { describe, it, expect } from 'vitest';
import { commanderSellPrice, commanderBuyPrice } from '@/lib/server/starbase/commanderPrice';
import type { CommanderData } from '@/lib/server/inventory/Commander';

function makeCommander(bonuses: { stat: 'shipSpeed'; value: number }[]): CommanderData {
  return {
    itemType: 'commander',
    name: 'Test',
    imageId: 0,
    statBonuses: bonuses,
  };
}

describe('commanderSellPrice', () => {
  it('commanderSellPrice_singleBonus0point1_returns100', () => {
    const c = makeCommander([{ stat: 'shipSpeed', value: 0.1 }]);
    expect(commanderSellPrice(c)).toBe(100);
  });

  it('commanderSellPrice_threeBonus0point2each_returns600', () => {
    const c = makeCommander([
      { stat: 'shipSpeed', value: 0.2 },
      { stat: 'shipSpeed', value: 0.2 },
      { stat: 'shipSpeed', value: 0.2 },
    ]);
    expect(commanderSellPrice(c)).toBe(600);
  });
});

describe('commanderBuyPrice', () => {
  it('commanderBuyPrice_singleBonus0point1_returns500', () => {
    const c = makeCommander([{ stat: 'shipSpeed', value: 0.1 }]);
    expect(commanderBuyPrice(c)).toBe(500);
  });

  it('commanderBuyPrice_threeBonus0point2each_returns3000', () => {
    const c = makeCommander([
      { stat: 'shipSpeed', value: 0.2 },
      { stat: 'shipSpeed', value: 0.2 },
      { stat: 'shipSpeed', value: 0.2 },
    ]);
    expect(commanderBuyPrice(c)).toBe(3000);
  });
});
