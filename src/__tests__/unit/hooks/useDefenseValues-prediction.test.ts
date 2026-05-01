import { describe, expect, it } from 'vitest';
import type { DefenseValues } from '@/shared/defenseValues';
import { calculateDefenseRecoveryTimers, projectDefenseValues } from '@/lib/client/hooks/useDefenseValues';

type DefenseValuesOverrides = {
  hull?: Partial<DefenseValues['hull']>;
  armor?: Partial<DefenseValues['armor']>;
  shield?: Partial<DefenseValues['shield']>;
};

const createDefenseValues = (overrides?: DefenseValuesOverrides): DefenseValues => ({
  hull: {
    name: 'Hull',
    current: 50,
    max: 100,
    regenRate: 1,
    ...overrides?.hull,
  },
  armor: {
    name: 'Armor',
    current: 0,
    max: 100,
    regenRate: 1,
    ...overrides?.armor,
  },
  shield: {
    name: 'Shield',
    current: 40,
    max: 100,
    regenRate: 2,
    ...overrides?.shield,
  },
});

describe('useDefenseValues prediction helpers', () => {
  it('projectDefenseValues_sharedRepairPool_redirectsFullRateAfterHullCompletes', () => {
    const defenseValues = createDefenseValues();

    const projected = projectDefenseValues(defenseValues, 60, 1);

    expect(projected.hull.current).toBe(100);
    expect(projected.armor.current).toBe(70);
    expect(projected.shield.current).toBe(100);
  });

  it('calculateDefenseRecoveryTimers_activeRepairsAndShieldRecharge_returnsRemainingTimes', () => {
    const defenseValues = createDefenseValues();

    const timers = calculateDefenseRecoveryTimers(defenseValues, 60, 1);

    expect(timers.repairs).toBe(15);
    expect(timers.shield).toBe(null);
  });

  it('calculateDefenseRecoveryTimers_pausedOrFullSystems_returnNullTimers', () => {
    const defenseValues = createDefenseValues({
      hull: { current: 75, regenRate: 0 },
      armor: { current: 90, regenRate: 0 },
      shield: { current: 100, regenRate: 2 },
    });

    const timers = calculateDefenseRecoveryTimers(defenseValues, 0, 1);

    expect(timers.repairs).toBe(null);
    expect(timers.shield).toBe(null);
  });
});
