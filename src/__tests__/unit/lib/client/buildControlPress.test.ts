import { describe, expect, test } from 'vitest';
import { LONG_PRESS_INITIAL_DELAY_MS, getLongPressRepeatDelayMs } from '@/lib/client/factory/buildControlPress';

describe('buildControlPress', () => {
  test('LONG_PRESS_INITIAL_DELAY_MS_slowsInitialRepeat', () => {
    expect(LONG_PRESS_INITIAL_DELAY_MS).toBeGreaterThan(150);
  });

  test('getLongPressRepeatDelayMs_longerHold_returnsFasterRepeats', () => {
    expect(getLongPressRepeatDelayMs(0)).toBe(260);
    expect(getLongPressRepeatDelayMs(800)).toBe(190);
    expect(getLongPressRepeatDelayMs(1300)).toBe(130);
    expect(getLongPressRepeatDelayMs(1900)).toBe(90);
    expect(getLongPressRepeatDelayMs(2600)).toBe(60);
  });
});
