import type { CommanderData } from '@/lib/server/inventory/Commander';

export function commanderSellPrice(commander: CommanderData): number {
  const totalBonus = commander.statBonuses.reduce((sum, b) => sum + b.value, 0);
  return Math.round(totalBonus / 0.1) * 100;
}

export function commanderBuyPrice(commander: CommanderData): number {
  const totalBonus = commander.statBonuses.reduce((sum, b) => sum + b.value, 0);
  return Math.round(totalBonus / 0.1) * 500;
}
