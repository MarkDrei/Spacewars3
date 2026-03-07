/**
 * Client-side price calculation helpers for the Starbase shop.
 * These are pure functions mirroring the server-side commanderPrice.ts.
 */
import type { CommanderData } from '@/shared/inventoryShared';

function totalBonusValue(commander: CommanderData): number {
  return commander.statBonuses.reduce((sum, b) => sum + b.value, 0);
}

export function commanderSellPrice(commander: CommanderData): number {
  return Math.round(totalBonusValue(commander) / 0.1) * 100;
}

export function commanderBuyPrice(commander: CommanderData): number {
  return Math.round(totalBonusValue(commander) / 0.1) * 500;
}
